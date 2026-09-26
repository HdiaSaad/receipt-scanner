import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/client.js';
import { uploadToCloudinary } from '../services/image.service.js';
import { runOcr } from '../services/ocr.service.js';
import type {
  ScanRequest, CreateReceiptRequest, UpdateReceiptRequest,
  ReceiptsListQuery, Receipt, StatsResponse,
} from '@receipt-scanner/shared';

function rowToReceipt(row: Record<string, unknown>, lineItems: unknown[]): Receipt {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    store: row.store as string | null,
    date: row.date as string | null,
    total: row.total as number | null,
    currency: (row.currency as string) ?? 'EUR',
    tax: row.tax as number | null,
    imageUrl: row.image_url as string | null,
    lineItems: lineItems as Receipt['lineItems'],
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export async function receiptsRoutes(fastify: FastifyInstance) {
  // All routes require auth
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /receipts/scan  — OCR only, does NOT save
  fastify.post<{ Body: ScanRequest }>(
    '/scan',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { imageBase64 } = request.body;
      const imageUrl = await uploadToCloudinary(imageBase64);
      const ocrResult = await runOcr(imageUrl);
      return reply.send({ ocrResult, imageUrl });
    },
  );

  // GET /receipts/stats — must come before /:id
  fastify.get('/stats', async (request) => {
    const { userId } = request.user;
    const db = getDb();

    const totalRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM receipts
      WHERE user_id = ? AND date >= date('now','start of month')
    `).get(userId) as { total: number };

    const weeklyRows = db.prepare(`
      SELECT date(date,'weekday 1','-6 days') as week,
             COALESCE(SUM(total),0) as total
      FROM receipts
      WHERE user_id = ? AND date >= date('now','-56 days')
      GROUP BY week ORDER BY week
    `).all(userId) as Array<{ week: string; total: number }>;

    const topStoreRows = db.prepare(`
      SELECT store, COUNT(*) as count, SUM(total) as total
      FROM receipts WHERE user_id = ? AND store IS NOT NULL
      GROUP BY store ORDER BY count DESC LIMIT 5
    `).all(userId) as Array<{ store: string; count: number; total: number }>;

    const avgRow = db.prepare(
      'SELECT COALESCE(AVG(total),0) as avg FROM receipts WHERE user_id = ?',
    ).get(userId) as { avg: number };

    const stats: StatsResponse = {
      totalThisMonth: totalRow.total,
      currency: 'EUR',
      weeklyTotals: weeklyRows,
      topStores: topStoreRows,
      averagePerReceipt: avgRow.avg,
    };
    return stats;
  });

  // POST /receipts — save after user review
  fastify.post<{ Body: CreateReceiptRequest }>('/', async (request, reply) => {
    const { userId } = request.user;
    const { store, date, total, currency, tax, imageUrl, rawOcr, lineItems } = request.body;
    const db = getDb();
    const id = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO receipts (id,user_id,store,date,total,currency,tax,image_url,raw_ocr,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, userId, store, date, total, currency ?? 'EUR', tax, imageUrl, rawOcr, now, now);

    const insertItem = db.prepare(
      'INSERT INTO line_items (id,receipt_id,description,quantity,unit_price,total) VALUES (?,?,?,?,?,?)',
    );
    for (const item of lineItems) {
      insertItem.run(uuidv4(), id, item.description, item.quantity, item.unitPrice, item.total);
    }

    const row = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as Record<string, unknown>;
    const items = db.prepare('SELECT * FROM line_items WHERE receipt_id = ?').all(id);
    return reply.status(201).send(rowToReceipt(row, items));
  });

  // GET /receipts
  fastify.get<{ Querystring: ReceiptsListQuery }>('/', async (request) => {
    const { userId } = request.user;
    const { page = 1, limit = 20, search, dateFrom, dateTo, minTotal, maxTotal } = request.query;
    const db = getDb();

    const conditions = ['user_id = ?'];
    const params: unknown[] = [userId];

    if (search) { conditions.push('store LIKE ?'); params.push(`%${search}%`); }
    if (dateFrom) { conditions.push('date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date <= ?'); params.push(dateTo); }
    if (minTotal !== undefined) { conditions.push('total >= ?'); params.push(minTotal); }
    if (maxTotal !== undefined) { conditions.push('total <= ?'); params.push(maxTotal); }

    const where = conditions.join(' AND ');
    const offset = (Number(page) - 1) * Number(limit);

    const rows = db.prepare(
      `SELECT * FROM receipts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, Number(limit), offset) as Array<Record<string, unknown>>;

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM receipts WHERE ${where}`)
      .get(...params) as { count: number };

    const receipts = rows.map(row => {
      const items = db.prepare('SELECT * FROM line_items WHERE receipt_id = ?').all(row.id as string);
      return rowToReceipt(row, items);
    });

    return { receipts, total: countRow.count, page: Number(page), limit: Number(limit) };
  });

  // GET /receipts/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM receipts WHERE id = ? AND user_id = ?').get(id, userId) as
      Record<string, unknown> | undefined;
    if (!row) return reply.status(404).send({ error: 'Receipt not found' });
    const items = db.prepare('SELECT * FROM line_items WHERE receipt_id = ?').all(id);
    return rowToReceipt(row, items);
  });

  // PUT /receipts/:id
  fastify.put<{ Params: { id: string }; Body: UpdateReceiptRequest }>(
    '/:id',
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;
      const db = getDb();
      const existing = db.prepare('SELECT id FROM receipts WHERE id = ? AND user_id = ?').get(id, userId);
      if (!existing) return reply.status(404).send({ error: 'Receipt not found' });

      const fields = request.body;
      const now = Date.now();
      const updates: string[] = ['updated_at = ?'];
      const values: unknown[] = [now];

      const colMap: Record<string, string> = {
        store: 'store', date: 'date', total: 'total', currency: 'currency',
        tax: 'tax', imageUrl: 'image_url', rawOcr: 'raw_ocr',
      };
      for (const [key, col] of Object.entries(colMap)) {
        if (key in fields) { updates.push(`${col} = ?`); values.push((fields as Record<string, unknown>)[key]); }
      }
      values.push(id, userId);
      db.prepare(`UPDATE receipts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

      if (fields.lineItems) {
        db.prepare('DELETE FROM line_items WHERE receipt_id = ?').run(id);
        const insertItem = db.prepare(
          'INSERT INTO line_items (id,receipt_id,description,quantity,unit_price,total) VALUES (?,?,?,?,?,?)',
        );
        for (const item of fields.lineItems) {
          insertItem.run(uuidv4(), id, item.description, item.quantity, item.unitPrice, item.total);
        }
      }

      const row = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as Record<string, unknown>;
      const items = db.prepare('SELECT * FROM line_items WHERE receipt_id = ?').all(id);
      return rowToReceipt(row, items);
    },
  );

  // DELETE /receipts/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const db = getDb();
    const result = db.prepare('DELETE FROM receipts WHERE id = ? AND user_id = ?').run(id, userId);
    if (result.changes === 0) return reply.status(404).send({ error: 'Receipt not found' });
    return reply.status(204).send();
  });
}

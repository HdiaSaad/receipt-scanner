import vision from '@google-cloud/vision';
import type { OcrResult } from '@receipt-scanner/shared';

const visionClient = new vision.ImageAnnotatorClient({
  apiKey: process.env.GOOGLE_VISION_API_KEY,
});

// ── Pure parser (unit-testable, no network) ──────────────

export function parseVisionText(text: string, confidence: number): OcrResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const store = lines[0] ?? null;

  // Date: matches DD/MM/YYYY or YYYY-MM-DD
  const dateMatch =
    text.match(/(\d{2})\/(\d{2})\/(\d{4})/) ||
    text.match(/(\d{4})-(\d{2})-(\d{2})/);
  let date: string | null = null;
  if (dateMatch) {
    if (dateMatch[0].includes('/')) {
      // DD/MM/YYYY → YYYY-MM-DD
      date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    } else {
      date = dateMatch[0];
    }
  }

  // Total: find line with TOTAL/MONTANT/à payer keywords
  const totalLine = [...lines].reverse().find(l =>
    /total|montant|à payer|net à payer/i.test(l),
  );
  const totalMatch = (totalLine ?? lines[lines.length - 1])?.match(/([\d]+[.,][\d]{2})/);
  const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : null;

  // TVA / Tax
  const taxLine = lines.find(l => /tva|tax|vat/i.test(l));
  const taxMatch = taxLine?.match(/([\d]+[.,][\d]{2})/);
  const tax = taxMatch ? parseFloat(taxMatch[1].replace(',', '.')) : null;

  // Currency: look for € $ £ symbols
  const currency = /€/.test(text) ? 'EUR' : /\$/.test(text) ? 'USD' : /£/.test(text) ? 'GBP' : 'EUR';

  // Line items: lines with a price at the end (but not the total/tax lines)
  const skipPatterns = /total|montant|tva|tax|vat|à payer/i;
  const lineItems = lines
    .filter(l => !skipPatterns.test(l))
    .map(l => {
      const priceMatch = l.match(/([\d]+[.,][\d]{2})\s*$/);
      if (!priceMatch) return null;
      const itemTotal = parseFloat(priceMatch[1].replace(',', '.'));
      const description = l.slice(0, priceMatch.index).trim();
      if (!description) return null;
      return { description, quantity: 1, unitPrice: itemTotal, total: itemTotal };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { store, date, total, currency, tax, lineItems, confidence, rawText: text };
}

// ── Network call ────────────────────────────────────────

export async function runOcr(imageUrl: string): Promise<OcrResult> {
  const [result] = await visionClient.textDetection(imageUrl);
  const annotation = result.textAnnotations?.[0];
  const rawText = annotation?.description ?? '';
  // Google Vision doesn't give a single confidence score for text detection.
  // We derive a proxy from whether text was found at all.
  const confidence = rawText.length > 20 ? 0.85 : rawText.length > 0 ? 0.4 : 0;
  return parseVisionText(rawText, confidence);
}

# Receipt Scanner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete MVP receipt scanning iOS app (Ionic React + Capacitor) with a Fastify backend in a PNPM monorepo, enabling users to photograph receipts, extract data via OCR, and track expenses.

**Architecture:** PNPM monorepo with `apps/mobile` (Ionic React + Capacitor), `apps/backend` (Fastify + SQLite), and `packages/shared` (TypeScript types). Mobile compresses images client-side and sends base64 to the backend; backend handles Cloudinary upload, Google Cloud Vision OCR, structured parsing, and SQLite persistence. JWT auth with Apple Sign In support.

**Tech Stack:** Ionic 8, React 18, Capacitor 6, Fastify 4, better-sqlite3 9, Cloudinary SDK 2, @google-cloud/vision 4, Zustand 4, Axios 1, react-hook-form 7, cropperjs 1 (via react-cropper), recharts 2, @capacitor-community/apple-sign-in 6, TypeScript 5, Vite 5, Vitest 1, PNPM 9.

## Global Constraints

- iOS deployment target: **15.0** — no iOS 16+ exclusive APIs
- Capacitor: **6.x** — pin all `@capacitor/*` to 6.x
- TypeScript **strict mode** in all packages (`"strict": true`)
- **No secrets in mobile** — all Google Vision and Cloudinary calls go through backend
- All backend routes except `/auth/*` require `Authorization: Bearer <token>`
- Every SQLite query touching `receipts` or `line_items` must `WHERE user_id = ?` from JWT payload
- Image compression before upload: **max 1920px** longest side, **JPEG quality 0.8** (Canvas API, client-side)
- Rate limiting: **5 req/min** on `/auth/*`, **10 req/min** on `/receipts/scan`
- PNPM workspaces — always run `pnpm install` from repo root
- Backend uses **ES modules** (`"type": "module"` in package.json), `.js` extensions in imports

---

## File Map

### packages/shared
```
packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── receipt.types.ts    # Receipt, LineItem, OcrResult, Currency
    ├── api.types.ts        # All API request/response interfaces
    └── index.ts            # Re-exports everything
```

### apps/backend
```
apps/backend/
├── package.json
├── tsconfig.json
├── .env.example
├── railway.toml
└── src/
    ├── index.ts                # Fastify server entry — registers plugins + routes
    ├── db/
    │   ├── client.ts           # better-sqlite3 singleton + initDb(path?)
    │   └── schema.ts           # createSchema(db) — all CREATE TABLE IF NOT EXISTS
    ├── plugins/
    │   ├── jwt.ts              # @fastify/jwt + authenticate preHandler decorator
    │   ├── cors.ts             # @fastify/cors
    │   └── rate-limit.ts       # @fastify/rate-limit with per-route config
    ├── services/
    │   ├── image.service.ts    # uploadToCloudinary(base64): Promise<string>
    │   └── ocr.service.ts      # runOcr(imageUrl): Promise<OcrResult>
    └── routes/
        ├── auth.ts             # POST register/login/apple/refresh, DELETE logout
        ├── receipts.ts         # POST scan, GET/POST/PUT/DELETE receipts, GET stats
        └── users.ts            # GET/PUT /users/me
```

### apps/mobile
```
apps/mobile/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── capacitor.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx                       # IonApp + IonTabs routing
    ├── theme/
    │   └── variables.css             # Ionic CSS variables
    ├── services/
    │   ├── api.ts                    # Axios instance, base URL, JWT interceptors
    │   └── storage.ts                # Capacitor Preferences wrapper for token storage
    ├── store/
    │   ├── auth.store.ts             # Zustand: user, tokens, login/logout actions
    │   └── receipts.store.ts         # Zustand: receipts list + selected receipt
    ├── hooks/
    │   ├── useCamera.ts              # @capacitor/camera wrapper, returns base64
    │   └── useImageCompressor.ts     # Canvas resize + JPEG encode, returns base64
    ├── components/
    │   ├── ReceiptCard.tsx           # IonCard list item for history
    │   ├── LineItemsList.tsx         # Editable line items in review form
    │   └── StatsChart.tsx            # Recharts BarChart wrapper
    └── pages/
        ├── auth/
        │   ├── LoginPage.tsx
        │   └── RegisterPage.tsx
        ├── scanner/
        │   ├── ScannerPage.tsx       # Camera + gallery entry point
        │   ├── CropPage.tsx          # react-cropper modal
        │   └── ReviewPage.tsx        # Pre-filled OCR form + save
        ├── history/
        │   └── HistoryPage.tsx       # List + search + filters + pagination
        ├── receipts/
        │   └── ReceiptDetailPage.tsx # View + edit + delete
        ├── stats/
        │   └── StatsPage.tsx
        └── profile/
            └── ProfilePage.tsx
```

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

**Interfaces:**
- Produces: working PNPM workspace; `pnpm install` succeeds from root

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "receipt-scanner",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev:backend": "pnpm --filter backend dev",
    "dev:mobile": "pnpm --filter mobile ionic serve",
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM"]
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.db
ios/
android/
.DS_Store
*.tsbuildinfo
```

- [ ] **Step 5: Install and verify**

```bash
pnpm install
```
Expected: lockfile created, no errors.

- [ ] **Step 6: Commit**

```bash
git init
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "feat: initialize PNPM monorepo"
```

---

## Task 2: Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/receipt.types.ts`
- Create: `packages/shared/src/api.types.ts`
- Create: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `@receipt-scanner/shared` importable by both `apps/backend` and `apps/mobile`

- [ ] **Step 1: Create packages/shared/package.json**

```json
{
  "name": "@receipt-scanner/shared",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/shared/src/receipt.types.ts**

```typescript
export type Currency = string; // ISO 4217: 'EUR', 'USD', 'GBP', etc.

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Receipt {
  id: string;
  userId: string;
  store: string | null;
  date: string | null;       // 'YYYY-MM-DD'
  total: number | null;
  currency: Currency;
  tax: number | null;
  imageUrl: string | null;
  lineItems: LineItem[];
  createdAt: number;         // Unix ms
  updatedAt: number;
}

export interface OcrResult {
  store: string | null;
  date: string | null;
  total: number | null;
  currency: Currency;
  tax: number | null;
  lineItems: Array<Omit<LineItem, 'id'>>;
  confidence: number;        // 0–1 from Google Vision
  rawText: string;
}
```

- [ ] **Step 4: Create packages/shared/src/api.types.ts**

```typescript
import type { OcrResult, Receipt, LineItem, Currency } from './receipt.types.js';

export interface UserProfile {
  id: string;
  email: string | null;
}

// ── Auth ────────────────────────────────────────────────
export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AppleSignInRequest {
  identityToken: string;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface RefreshRequest {
  refreshToken: string;
}

// ── Receipts ────────────────────────────────────────────
export interface ScanRequest {
  imageBase64: string; // base64 JPEG, no "data:image/jpeg;base64," prefix
}

export interface ScanResponse {
  ocrResult: OcrResult;
  imageUrl: string;
}

export interface CreateReceiptRequest {
  store: string | null;
  date: string | null;
  total: number | null;
  currency: Currency;
  tax: number | null;
  imageUrl: string;
  rawOcr: string;     // JSON.stringify(OcrResult)
  lineItems: Array<Omit<LineItem, 'id'>>;
}

export type UpdateReceiptRequest = Partial<CreateReceiptRequest>;

export interface ReceiptsListQuery {
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minTotal?: number;
  maxTotal?: number;
}

export interface ReceiptsListResponse {
  receipts: Receipt[];
  total: number;
  page: number;
  limit: number;
}

export interface StatsResponse {
  totalThisMonth: number;
  currency: string;
  weeklyTotals: Array<{ week: string; total: number }>;
  topStores: Array<{ store: string; count: number; total: number }>;
  averagePerReceipt: number;
}

// ── Users ────────────────────────────────────────────────
export interface UpdateUserRequest {
  email?: string;
}
```

- [ ] **Step 5: Create packages/shared/src/index.ts**

```typescript
export * from './receipt.types.js';
export * from './api.types.js';
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd packages/shared && pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared TypeScript types package"
```

---

## Task 3: Backend Scaffold (Fastify + DB + Plugins)

**Files:**
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/.env.example`
- Create: `apps/backend/railway.toml`
- Create: `apps/backend/src/index.ts`
- Create: `apps/backend/src/db/client.ts`
- Create: `apps/backend/src/db/schema.ts`
- Create: `apps/backend/src/plugins/jwt.ts`
- Create: `apps/backend/src/plugins/cors.ts`
- Create: `apps/backend/src/plugins/rate-limit.ts`

**Interfaces:**
- Produces:
  - `getDb(): Database` — returns initialized better-sqlite3 instance
  - `initDb(path?: string): void` — creates schema, call with `':memory:'` in tests
  - `closeDb(): void` — for test teardown
  - `server` — Fastify instance exported from `index.ts`
  - `fastify.authenticate` — preHandler to protect routes

- [ ] **Step 1: Create apps/backend/package.json**

```json
{
  "name": "backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.0",
    "@fastify/jwt": "^8.0.0",
    "@fastify/rate-limit": "^9.0.0",
    "@google-cloud/vision": "^4.3.0",
    "@receipt-scanner/shared": "workspace:*",
    "apple-signin-auth": "^1.7.3",
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^9.6.0",
    "cloudinary": "^2.4.0",
    "fastify": "^4.28.0",
    "fastify-plugin": "^4.5.1",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^20.0.0",
    "tsx": "^4.15.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create apps/backend/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/backend/.env.example**

```
JWT_SECRET=change_me_to_a_long_random_string
GOOGLE_VISION_API_KEY=your_google_vision_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
DATABASE_PATH=./data.db
PORT=3000
NODE_ENV=development
```

Copy this to `.env` and fill in real values before running.

- [ ] **Step 4: Create apps/backend/railway.toml**

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"

[[volumes]]
name = "sqlite-data"
mountPath = "/data"
```

Set `DATABASE_PATH=/data/receipts.db` in Railway environment variables.

- [ ] **Step 5: Create apps/backend/src/db/schema.ts**

```typescript
import type Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE,
      apple_id      TEXT UNIQUE,
      password_hash TEXT,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT NOT NULL,
      expires_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      store       TEXT,
      date        TEXT,
      total       REAL,
      currency    TEXT NOT NULL DEFAULT 'EUR',
      tax         REAL,
      image_url   TEXT,
      raw_ocr     TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id           TEXT PRIMARY KEY,
      receipt_id   TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
      description  TEXT,
      quantity     REAL,
      unit_price   REAL,
      total        REAL
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_date    ON receipts(date);
    CREATE INDEX IF NOT EXISTS idx_refresh_user     ON refresh_tokens(user_id);
  `);
}
```

- [ ] **Step 6: Create apps/backend/src/db/client.ts**

```typescript
import Database from 'better-sqlite3';
import { createSchema } from './schema.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized — call initDb() first');
  return db;
}

export function initDb(path: string = process.env.DATABASE_PATH ?? './data.db'): void {
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema(db);
}

export function closeDb(): void {
  db?.close();
  db = null;
}
```

- [ ] **Step 7: Create apps/backend/src/plugins/jwt.ts**

```typescript
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export const jwtPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: '15m' },
  });

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  );
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}
```

- [ ] **Step 8: Create apps/backend/src/plugins/cors.ts**

```typescript
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export const corsPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production'
      ? ['capacitor://localhost', 'ionic://localhost']
      : true,
    credentials: true,
  });
});
```

- [ ] **Step 9: Create apps/backend/src/plugins/rate-limit.ts**

```typescript
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export const rateLimitPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyRateLimit, {
    global: false, // Apply per-route only
  });
});
```

- [ ] **Step 10: Create apps/backend/src/index.ts**

```typescript
import Fastify from 'fastify';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { jwtPlugin } from './plugins/jwt.js';
import { authRoutes } from './routes/auth.js';
import { receiptsRoutes } from './routes/receipts.js';
import { usersRoutes } from './routes/users.js';
import { initDb } from './db/client.js';

export function buildServer() {
  const server = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  server.register(corsPlugin);
  server.register(rateLimitPlugin);
  server.register(jwtPlugin);

  server.register(authRoutes, { prefix: '/auth' });
  server.register(receiptsRoutes, { prefix: '/receipts' });
  server.register(usersRoutes, { prefix: '/users' });

  server.get('/health', async () => ({ status: 'ok' }));

  return server;
}

// Start only when executed directly, not when imported by tests
if (process.env.NODE_ENV !== 'test') {
  initDb();
  const server = buildServer();
  server.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
}
```

- [ ] **Step 11: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 12: Verify TypeScript compiles**

```bash
cd apps/backend && pnpm tsc --noEmit
```
Expected: no errors (routes don't exist yet — add stub files `routes/auth.ts`, `routes/receipts.ts`, `routes/users.ts` each exporting `export async function authRoutes() {}` etc. to allow compilation).

- [ ] **Step 13: Commit**

```bash
git add apps/backend/
git commit -m "feat: add Fastify backend scaffold with DB schema and plugins"
```

---

## Task 4: Backend — Auth Routes

**Files:**
- Create: `apps/backend/src/routes/auth.ts`
- Create: `apps/backend/tests/auth.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `fastify.authenticate`, `initDb(':memory:')`, `closeDb()`
- Produces:
  - `POST /auth/register` → `AuthResponse`
  - `POST /auth/login` → `AuthResponse`
  - `POST /auth/apple` → `AuthResponse`
  - `POST /auth/refresh` → `{ accessToken: string }`
  - `DELETE /auth/logout` → `204`

- [ ] **Step 1: Write failing auth tests**

Create `apps/backend/tests/auth.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/index.js';
import { initDb, closeDb } from '../src/db/client.js';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-len';
  initDb(':memory:');
  server = buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  closeDb();
});

describe('POST /auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
  });

  it('returns 409 for duplicate email', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('issues new access token', async () => {
    const login = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    const { refreshToken } = login.json();
    const res = await server.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/backend && pnpm test
```
Expected: FAIL — `authRoutes` is a stub.

- [ ] **Step 3: Implement apps/backend/src/routes/auth.ts**

```typescript
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import appleSignin from 'apple-signin-auth';
import { getDb } from '../db/client.js';
import type {
  RegisterRequest, LoginRequest, AppleSignInRequest,
  RefreshRequest, AuthResponse,
} from '@receipt-scanner/shared';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateTokenPair(fastify: FastifyInstance, userId: string) {
  const accessToken = fastify.jwt.sign({ userId }, { expiresIn: '15m' });
  const refreshToken = uuidv4();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const db = getDb();
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
  ).run(uuidv4(), userId, hashToken(refreshToken), expiresAt);
  return { accessToken, refreshToken };
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/register
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const db = getDb();
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) return reply.status(409).send({ error: 'Email already registered' });

      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 12);
      db.prepare(
        'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      ).run(id, email, passwordHash, Date.now());

      const { accessToken, refreshToken } = generateTokenPair(fastify, id);
      const response: AuthResponse = {
        accessToken,
        refreshToken,
        user: { id, email },
      };
      return reply.status(201).send(response);
    },
  );

  // POST /auth/login
  fastify.post<{ Body: LoginRequest }>(
    '/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const db = getDb();
      const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
        | { id: string; email: string; password_hash: string }
        | undefined;
      if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

      const { accessToken, refreshToken } = generateTokenPair(fastify, user.id);
      const response: AuthResponse = {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email },
      };
      return response;
    },
  );

  // POST /auth/apple
  fastify.post<{ Body: AppleSignInRequest }>(
    '/apple',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { identityToken, email, givenName, familyName } = request.body;
      let applePayload: { sub: string };
      try {
        applePayload = await appleSignin.verifyIdToken(identityToken, {
          audience: process.env.APPLE_CLIENT_ID ?? 'com.yourapp.receiptscanner',
          ignoreExpiration: false,
        }) as { sub: string };
      } catch {
        return reply.status(401).send({ error: 'Invalid Apple token' });
      }

      const db = getDb();
      const appleId = applePayload.sub;
      let user = db.prepare('SELECT id, email FROM users WHERE apple_id = ?').get(appleId) as
        | { id: string; email: string | null }
        | undefined;

      if (!user) {
        const id = uuidv4();
        const resolvedEmail = email ?? null;
        db.prepare(
          'INSERT INTO users (id, email, apple_id, created_at) VALUES (?, ?, ?, ?)',
        ).run(id, resolvedEmail, appleId, Date.now());
        user = { id, email: resolvedEmail };
      }

      const { accessToken, refreshToken } = generateTokenPair(fastify, user.id);
      const response: AuthResponse = {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email },
      };
      return response;
    },
  );

  // POST /auth/refresh
  fastify.post<{ Body: RefreshRequest }>('/refresh', async (request, reply) => {
    const { refreshToken } = request.body;
    const db = getDb();
    const tokenHash = hashToken(refreshToken);
    const stored = db.prepare(
      'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?',
    ).get(tokenHash) as { id: string; user_id: string; expires_at: number } | undefined;

    if (!stored || stored.expires_at < Date.now()) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' });
    }

    const accessToken = fastify.jwt.sign({ userId: stored.user_id }, { expiresIn: '15m' });
    return { accessToken };
  });

  // DELETE /auth/logout
  fastify.delete(
    '/logout',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const db = getDb();
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
      return reply.status(204).send();
    },
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/backend && pnpm test
```
Expected: all auth tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/auth.ts apps/backend/tests/auth.test.ts
git commit -m "feat: add auth routes (register, login, Apple Sign In, refresh, logout)"
```

---

## Task 5: Backend — Image Service + OCR Service

**Files:**
- Create: `apps/backend/src/services/image.service.ts`
- Create: `apps/backend/src/services/ocr.service.ts`
- Create: `apps/backend/tests/ocr.test.ts`

**Interfaces:**
- Produces:
  - `uploadToCloudinary(base64: string): Promise<string>` — returns secure URL
  - `runOcr(imageUrl: string): Promise<OcrResult>` — calls Google Vision + parses result

- [ ] **Step 1: Write failing OCR parser test**

Create `apps/backend/tests/ocr.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseVisionText } from '../src/services/ocr.service.js';

describe('parseVisionText', () => {
  it('extracts total from French receipt text', () => {
    const text = `CARREFOUR MARKET\n15/09/2026\nPain de mie    1.20\nLait 1L        0.89\nTOTAL          2.09\nTVA 5.5%       0.11`;
    const result = parseVisionText(text, 0.95);
    expect(result.store).toBe('CARREFOUR MARKET');
    expect(result.total).toBe(2.09);
    expect(result.tax).toBeCloseTo(0.11);
    expect(result.date).toBe('2026-09-15');
    expect(result.currency).toBe('EUR');
  });

  it('returns nulls when text is unreadable', () => {
    const result = parseVisionText('', 0.1);
    expect(result.total).toBeNull();
    expect(result.store).toBeNull();
    expect(result.confidence).toBe(0.1);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/backend && pnpm test tests/ocr.test.ts
```
Expected: FAIL — `parseVisionText` not found.

- [ ] **Step 3: Create apps/backend/src/services/image.service.ts**

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(base64: string): Promise<string> {
  const dataUri = `data:image/jpeg;base64,${base64}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'receipts',
    resource_type: 'image',
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  });
  return result.secure_url;
}
```

- [ ] **Step 4: Create apps/backend/src/services/ocr.service.ts**

```typescript
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

  // Total: last line that has a number, or line with TOTAL/MONTANT
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
```

- [ ] **Step 5: Run OCR parser tests — verify they pass**

```bash
cd apps/backend && pnpm test tests/ocr.test.ts
```
Expected: PASS. (Network call `runOcr` is not tested here — requires real credentials.)

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/services/ apps/backend/tests/ocr.test.ts
git commit -m "feat: add Cloudinary image service and Google Vision OCR service"
```

---

## Task 6: Backend — Receipts Routes

**Files:**
- Create: `apps/backend/src/routes/receipts.ts`
- Create: `apps/backend/tests/receipts.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `fastify.authenticate`, `uploadToCloudinary()`, `runOcr()`
- Produces:
  - `POST /receipts/scan` → `ScanResponse`
  - `POST /receipts` → `Receipt`
  - `GET /receipts` → `ReceiptsListResponse`
  - `GET /receipts/stats` → `StatsResponse`
  - `GET /receipts/:id` → `Receipt`
  - `PUT /receipts/:id` → `Receipt`
  - `DELETE /receipts/:id` → `204`

- [ ] **Step 1: Write failing receipts tests**

Create `apps/backend/tests/receipts.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/index.js';
import { initDb, closeDb, getDb } from '../src/db/client.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;
let accessToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-len';
  initDb(':memory:');
  server = buildServer();
  await server.ready();

  // Seed a user
  const db = getDb();
  const userId = uuidv4();
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, 'receipts@test.com', await bcrypt.hash('pass123', 1), Date.now());

  const login = await server.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'receipts@test.com', password: 'pass123' },
  });
  accessToken = login.json().accessToken;
});

afterAll(async () => {
  await server.close();
  closeDb();
});

function authHeader() {
  return { Authorization: `Bearer ${accessToken}` };
}

describe('POST /receipts', () => {
  it('creates a receipt and returns it', async () => {
    const res = await server.inject({
      method: 'POST', url: '/receipts',
      headers: authHeader(),
      payload: {
        store: 'Carrefour', date: '2026-09-15', total: 25.50,
        currency: 'EUR', tax: 1.20, imageUrl: 'https://cdn.example.com/img.jpg',
        rawOcr: '{}', lineItems: [],
      },
    });
    expect(res.statusCode).toBe(201);
    const receipt = res.json();
    expect(receipt.id).toBeDefined();
    expect(receipt.store).toBe('Carrefour');
  });
});

describe('GET /receipts', () => {
  it('returns paginated list for authenticated user', async () => {
    const res = await server.inject({
      method: 'GET', url: '/receipts?page=1&limit=10',
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.receipts)).toBe(true);
    expect(body.page).toBe(1);
  });
});

describe('GET /receipts/stats', () => {
  it('returns stats object', async () => {
    const res = await server.inject({
      method: 'GET', url: '/receipts/stats',
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(typeof stats.totalThisMonth).toBe('number');
    expect(Array.isArray(stats.weeklyTotals)).toBe(true);
    expect(Array.isArray(stats.topStores)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/backend && pnpm test tests/receipts.test.ts
```
Expected: FAIL — route stub returns nothing.

- [ ] **Step 3: Implement apps/backend/src/routes/receipts.ts**

```typescript
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

    if (search) { conditions.push("store LIKE ?"); params.push(`%${search}%`); }
    if (dateFrom) { conditions.push('date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date <= ?'); params.push(dateTo); }
    if (minTotal !== undefined) { conditions.push('total >= ?'); params.push(minTotal); }
    if (maxTotal !== undefined) { conditions.push('total <= ?'); params.push(maxTotal); }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    const rows = db.prepare(
      `SELECT * FROM receipts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as Array<Record<string, unknown>>;

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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/backend && pnpm test tests/receipts.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/receipts.ts apps/backend/tests/receipts.test.ts
git commit -m "feat: add receipts routes (scan, CRUD, stats)"
```

---

## Task 7: Backend — Users Route

**Files:**
- Create: `apps/backend/src/routes/users.ts` (replace stub)
- Test: `apps/backend/tests/users.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `fastify.authenticate`
- Produces: `GET /users/me` → `UserProfile`, `PUT /users/me` → `UserProfile`

- [ ] **Step 1: Write failing test**

```typescript
// apps/backend/tests/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/index.js';
import { initDb, closeDb } from '../src/db/client.js';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;
let accessToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-len';
  initDb(':memory:');
  server = buildServer();
  await server.ready();

  await server.inject({
    method: 'POST', url: '/auth/register',
    payload: { email: 'user@test.com', password: 'pass123' },
  });
  const login = await server.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'user@test.com', password: 'pass123' },
  });
  accessToken = login.json().accessToken;
});

afterAll(async () => { await server.close(); closeDb(); });

describe('GET /users/me', () => {
  it('returns user profile', async () => {
    const res = await server.inject({
      method: 'GET', url: '/users/me',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('user@test.com');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/backend && pnpm test tests/users.test.ts
```

- [ ] **Step 3: Implement apps/backend/src/routes/users.ts**

```typescript
import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/client.js';
import type { UpdateUserRequest, UserProfile } from '@receipt-scanner/shared';

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/me', async (request, reply) => {
    const { userId } = request.user;
    const db = getDb();
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as
      { id: string; email: string | null } | undefined;
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const profile: UserProfile = { id: user.id, email: user.email };
    return profile;
  });

  fastify.put<{ Body: UpdateUserRequest }>('/me', async (request, reply) => {
    const { userId } = request.user;
    const { email } = request.body;
    const db = getDb();
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email ?? null, userId);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as
      { id: string; email: string | null };
    const profile: UserProfile = { id: user.id, email: user.email };
    return profile;
  });
}
```

- [ ] **Step 4: Run all backend tests**

```bash
cd apps/backend && pnpm test
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/users.ts apps/backend/tests/users.test.ts
git commit -m "feat: add users route (GET/PUT /users/me)"
```

---

## Task 8: Mobile Scaffold (Ionic + Routing + API Service + Stores)

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/vite.config.ts`
- Create: `apps/mobile/index.html`
- Create: `apps/mobile/src/main.tsx`
- Create: `apps/mobile/src/App.tsx`
- Create: `apps/mobile/src/theme/variables.css`
- Create: `apps/mobile/src/services/api.ts`
- Create: `apps/mobile/src/services/storage.ts`
- Create: `apps/mobile/src/store/auth.store.ts`
- Create: `apps/mobile/src/store/receipts.store.ts`

**Interfaces:**
- Produces:
  - `api` — configured Axios instance, auto-attaches Bearer token, auto-refreshes on 401
  - `useAuthStore()` — `{ user, accessToken, login, logout, isAuthenticated }`
  - `useReceiptsStore()` — `{ receipts, setReceipts, addReceipt, updateReceipt, removeReceipt }`

- [ ] **Step 1: Create apps/mobile/package.json**

```json
{
  "name": "mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "ionic:build": "vite build",
    "ionic:serve": "vite"
  },
  "dependencies": {
    "@capacitor-community/apple-sign-in": "^6.0.0",
    "@capacitor/camera": "^6.0.0",
    "@capacitor/core": "^6.0.0",
    "@capacitor/haptics": "^6.0.0",
    "@capacitor/preferences": "^6.0.0",
    "@capacitor/status-bar": "^6.0.0",
    "@ionic/react": "^8.0.0",
    "@ionic/react-router": "^8.0.0",
    "@receipt-scanner/shared": "workspace:*",
    "axios": "^1.7.0",
    "cropperjs": "^1.6.2",
    "date-fns": "^3.6.0",
    "ionicons": "^7.0.0",
    "react": "^18.3.0",
    "react-cropper": "^2.3.3",
    "react-dom": "^18.3.0",
    "react-hook-form": "^7.52.0",
    "react-router-dom": "^5.3.4",
    "recharts": "^2.12.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^6.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/react-router-dom": "^5.3.3",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create apps/mobile/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/mobile/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 8100 },
});
```

- [ ] **Step 4: Create apps/mobile/index.html**

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Receipt Scanner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create apps/mobile/src/main.tsx**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

const container = document.getElementById('root')!;
createRoot(container).render(<App />);
```

- [ ] **Step 6: Create apps/mobile/src/theme/variables.css**

```css
:root {
  --ion-color-primary: #3880ff;
  --ion-color-primary-rgb: 56, 128, 255;
  --ion-color-primary-contrast: #ffffff;
  --ion-color-primary-shade: #3171e0;
  --ion-color-primary-tint: #4c8dff;

  --ion-color-success: #2dd36f;
  --ion-color-warning: #ffc409;
  --ion-color-danger: #eb445a;
  --ion-color-medium: #92949c;
  --ion-color-light: #f4f5f8;

  --ion-safe-area-top: env(safe-area-inset-top);
  --ion-safe-area-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 7: Create apps/mobile/src/services/storage.ts**

```typescript
import { Preferences } from '@capacitor/preferences';

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export const storage = {
  async setTokens(access: string, refresh: string): Promise<void> {
    await Preferences.set({ key: KEYS.ACCESS_TOKEN, value: access });
    await Preferences.set({ key: KEYS.REFRESH_TOKEN, value: refresh });
  },
  async getAccessToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: KEYS.ACCESS_TOKEN });
    return value;
  },
  async getRefreshToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: KEYS.REFRESH_TOKEN });
    return value;
  },
  async clearTokens(): Promise<void> {
    await Preferences.remove({ key: KEYS.ACCESS_TOKEN });
    await Preferences.remove({ key: KEYS.REFRESH_TOKEN });
  },
};
```

- [ ] **Step 8: Create apps/mobile/src/services/api.ts**

```typescript
import axios from 'axios';
import { storage } from './storage';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api = axios.create({ baseURL: BASE_URL });

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await storage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await storage.getRefreshToken();
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const { accessToken } = data;
      await storage.setTokens(accessToken, refreshToken!);
      refreshQueue.forEach((cb) => cb(accessToken));
      refreshQueue = [];
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch {
      await storage.clearTokens();
      window.location.href = '/auth/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
```

- [ ] **Step 9: Create apps/mobile/src/store/auth.store.ts**

```typescript
import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';
import type { UserProfile, AuthResponse } from '@receipt-scanner/shared';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (response: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (response: AuthResponse) => {
    await storage.setTokens(response.accessToken, response.refreshToken);
    set({ user: response.user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await api.delete('/auth/logout');
    } catch {
      // best-effort
    }
    await storage.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const token = await storage.getAccessToken();
    if (!token) return;
    try {
      const { data } = await api.get<UserProfile>('/users/me');
      set({ user: data, isAuthenticated: true });
    } catch {
      await storage.clearTokens();
    }
  },
}));
```

- [ ] **Step 10: Create apps/mobile/src/store/receipts.store.ts**

```typescript
import { create } from 'zustand';
import type { Receipt } from '@receipt-scanner/shared';

interface ReceiptsState {
  receipts: Receipt[];
  total: number;
  setReceipts: (receipts: Receipt[], total: number) => void;
  addReceipt: (receipt: Receipt) => void;
  updateReceipt: (receipt: Receipt) => void;
  removeReceipt: (id: string) => void;
}

export const useReceiptsStore = create<ReceiptsState>((set) => ({
  receipts: [],
  total: 0,
  setReceipts: (receipts, total) => set({ receipts, total }),
  addReceipt: (receipt) =>
    set((s) => ({ receipts: [receipt, ...s.receipts], total: s.total + 1 })),
  updateReceipt: (receipt) =>
    set((s) => ({ receipts: s.receipts.map((r) => (r.id === receipt.id ? receipt : r)) })),
  removeReceipt: (id) =>
    set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id), total: s.total - 1 })),
}));
```

- [ ] **Step 11: Create apps/mobile/src/App.tsx**

```tsx
import React, { useEffect } from 'react';
import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { cameraOutline, listOutline, barChartOutline, personOutline } from 'ionicons/icons';
import { useAuthStore } from './store/auth.store';

// Lazy imports for pages — add as tasks complete
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ScannerPage from './pages/scanner/ScannerPage';
import CropPage from './pages/scanner/CropPage';
import ReviewPage from './pages/scanner/ReviewPage';
import HistoryPage from './pages/history/HistoryPage';
import ReceiptDetailPage from './pages/receipts/ReceiptDetailPage';
import StatsPage from './pages/stats/StatsPage';
import ProfilePage from './pages/profile/ProfilePage';

setupIonicReact();

const App: React.FC = () => {
  const { isAuthenticated, restoreSession } = useAuthStore();

  useEffect(() => { restoreSession(); }, []);

  if (!isAuthenticated) {
    return (
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/auth/login" component={LoginPage} />
            <Route exact path="/auth/register" component={RegisterPage} />
            <Redirect to="/auth/login" />
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/scan/crop" component={CropPage} />
          <Route exact path="/scan/review" component={ReviewPage} />
          <Route exact path="/receipts/:id" component={ReceiptDetailPage} />
        </IonRouterOutlet>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/scanner" component={ScannerPage} />
            <Route exact path="/history" component={HistoryPage} />
            <Route exact path="/stats" component={StatsPage} />
            <Route exact path="/profile" component={ProfilePage} />
            <Redirect exact from="/" to="/scanner" />
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="scanner" href="/scanner">
              <IonIcon icon={cameraOutline} />
              <IonLabel>Scanner</IonLabel>
            </IonTabButton>
            <IonTabButton tab="history" href="/history">
              <IonIcon icon={listOutline} />
              <IonLabel>Historique</IonLabel>
            </IonTabButton>
            <IonTabButton tab="stats" href="/stats">
              <IonIcon icon={barChartOutline} />
              <IonLabel>Statistiques</IonLabel>
            </IonTabButton>
            <IonTabButton tab="profile" href="/profile">
              <IonIcon icon={personOutline} />
              <IonLabel>Profil</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
```

Note: All page imports will fail until subsequent tasks create the files. Create stub files for each page now:
```tsx
// Stub template for each missing page (e.g., pages/scanner/ScannerPage.tsx)
import React from 'react';
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle } from '@ionic/react';
const ScannerPage: React.FC = () => (
  <IonPage><IonHeader><IonToolbar><IonTitle>Scanner</IonTitle></IonToolbar></IonHeader><IonContent /></IonPage>
);
export default ScannerPage;
```
Create this stub for: `ScannerPage`, `CropPage`, `ReviewPage`, `LoginPage`, `RegisterPage`, `HistoryPage`, `ReceiptDetailPage`, `StatsPage`, `ProfilePage`.

- [ ] **Step 12: Install dependencies and verify build**

```bash
pnpm install
cd apps/mobile && pnpm build
```
Expected: TypeScript compiles, Vite builds without errors.

- [ ] **Step 13: Commit**

```bash
git add apps/mobile/
git commit -m "feat: add Ionic mobile scaffold with routing, API service, and Zustand stores"
```

---

## Task 9: Mobile — Auth Pages

**Files:**
- Modify: `apps/mobile/src/pages/auth/LoginPage.tsx` (replace stub)
- Modify: `apps/mobile/src/pages/auth/RegisterPage.tsx` (replace stub)

**Interfaces:**
- Consumes: `useAuthStore().login`, `api` (POST /auth/login, /auth/register, /auth/apple)
- Produces: working login/register flow; on success redirects to `/scanner`

- [ ] **Step 1: Implement apps/mobile/src/pages/auth/LoginPage.tsx**

```tsx
import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner,
} from '@ionic/react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { SignInWithApple, SignInWithAppleOptions } from '@capacitor-community/apple-sign-in';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import type { LoginRequest, AuthResponse, AppleSignInRequest } from '@receipt-scanner/shared';

interface FormValues { email: string; password: string; }

const LoginPage: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const history = useHistory();

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', values as LoginRequest);
      await login(data);
      history.replace('/scanner');
    } catch {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const onAppleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const options: SignInWithAppleOptions = {
        clientId: 'com.yourapp.receiptscanner',
        redirectURI: 'https://your-backend.railway.app/auth/apple/callback',
        scopes: 'email name',
      };
      const result = await SignInWithApple.authorize(options);
      const payload: AppleSignInRequest = {
        identityToken: result.response.identityToken,
        email: result.response.email,
        givenName: result.response.givenName,
        familyName: result.response.familyName,
      };
      const { data } = await api.post<AuthResponse>('/auth/apple', payload);
      await login(data);
      history.replace('/scanner');
    } catch {
      setError('Connexion Apple échouée.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Connexion</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={handleSubmit(onSubmit)}>
          <IonItem>
            <IonLabel position="floating">Email</IonLabel>
            <IonInput type="email" {...register('email', { required: true })} />
          </IonItem>
          {errors.email && <IonText color="danger"><p>Email requis</p></IonText>}

          <IonItem>
            <IonLabel position="floating">Mot de passe</IonLabel>
            <IonInput type="password" {...register('password', { required: true })} />
          </IonItem>
          {errors.password && <IonText color="danger"><p>Mot de passe requis</p></IonText>}

          {error && <IonText color="danger"><p>{error}</p></IonText>}

          <IonButton expand="block" type="submit" disabled={loading} className="ion-margin-top">
            {loading ? <IonSpinner /> : 'Se connecter'}
          </IonButton>
        </form>

        <IonButton expand="block" fill="outline" onClick={onAppleSignIn} disabled={loading}>
          Se connecter avec Apple
        </IonButton>

        <IonButton expand="block" fill="clear" routerLink="/auth/register">
          Créer un compte
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
```

- [ ] **Step 2: Implement apps/mobile/src/pages/auth/RegisterPage.tsx**

```tsx
import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonItem, IonLabel, IonInput, IonButton, IonText, IonSpinner,
} from '@ionic/react';
import { useForm } from 'react-hook-form';
import { useHistory } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import type { RegisterRequest, AuthResponse } from '@receipt-scanner/shared';

interface FormValues { email: string; password: string; confirm: string; }

const RegisterPage: React.FC = () => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const history = useHistory();

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      const payload: RegisterRequest = { email: values.email, password: values.password };
      const { data } = await api.post<AuthResponse>('/auth/register', payload);
      await login(data);
      history.replace('/scanner');
    } catch (e: unknown) {
      const msg = (e as { response?: { status?: number } })?.response?.status === 409
        ? 'Cet email est déjà utilisé.'
        : 'Erreur lors de la création du compte.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Créer un compte</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={handleSubmit(onSubmit)}>
          <IonItem>
            <IonLabel position="floating">Email</IonLabel>
            <IonInput type="email" {...register('email', { required: true })} />
          </IonItem>

          <IonItem>
            <IonLabel position="floating">Mot de passe</IonLabel>
            <IonInput type="password" {...register('password', { required: true, minLength: 8 })} />
          </IonItem>
          {errors.password && <IonText color="danger"><p>Minimum 8 caractères</p></IonText>}

          <IonItem>
            <IonLabel position="floating">Confirmer le mot de passe</IonLabel>
            <IonInput type="password" {...register('confirm', {
              validate: (v) => v === watch('password') || 'Les mots de passe ne correspondent pas',
            })} />
          </IonItem>
          {errors.confirm && <IonText color="danger"><p>{errors.confirm.message}</p></IonText>}

          {error && <IonText color="danger"><p>{error}</p></IonText>}

          <IonButton expand="block" type="submit" disabled={loading} className="ion-margin-top">
            {loading ? <IonSpinner /> : 'Créer mon compte'}
          </IonButton>
        </form>
        <IonButton expand="block" fill="clear" routerLink="/auth/login">
          Déjà un compte ? Se connecter
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default RegisterPage;
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/mobile && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/pages/auth/
git commit -m "feat: add login and register pages with Apple Sign In"
```

---

## Task 10: Mobile — Camera + Image Compression Pipeline

**Files:**
- Create: `apps/mobile/src/hooks/useCamera.ts`
- Create: `apps/mobile/src/hooks/useImageCompressor.ts`
- Modify: `apps/mobile/src/pages/scanner/CropPage.tsx` (replace stub)

**Interfaces:**
- Produces:
  - `useCamera()` → `{ takePhoto(): Promise<string>, pickFromGallery(): Promise<string> }` — returns base64 JPEG (no prefix)
  - `useImageCompressor()` → `{ compress(base64: string): Promise<string> }` — max 1920px, JPEG 0.8
  - `CropPage` — full-screen modal, receives `imageBase64` via router state, emits cropped base64 on confirm

- [ ] **Step 1: Create apps/mobile/src/hooks/useCamera.ts**

```typescript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export function useCamera() {
  async function takePhoto(): Promise<string> {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    return photo.base64String!;
  }

  async function pickFromGallery(): Promise<string> {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
    });
    return photo.base64String!;
  }

  return { takePhoto, pickFromGallery };
}
```

- [ ] **Step 2: Create apps/mobile/src/hooks/useImageCompressor.ts**

```typescript
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

export function useImageCompressor() {
  async function compress(base64: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        // Strip "data:image/jpeg;base64," prefix
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  }

  return { compress };
}
```

- [ ] **Step 3: Implement apps/mobile/src/pages/scanner/CropPage.tsx**

```tsx
import React, { useRef } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonButton, IonButtons, IonFooter,
} from '@ionic/react';
import Cropper from 'react-cropper';
import { useHistory, useLocation } from 'react-router-dom';
import 'cropperjs/dist/cropper.css';

interface LocationState { imageBase64: string }

const CropPage: React.FC = () => {
  const history = useHistory<{ croppedBase64: string }>();
  const location = useLocation<LocationState>();
  const cropperRef = useRef<HTMLImageElement & { cropper: Cropper }>(null);
  const { imageBase64 } = location.state ?? { imageBase64: '' };

  const onConfirm = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    const dataUrl = cropper.getCroppedCanvas({
      maxWidth: 1920,
      maxHeight: 1920,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    }).toDataURL('image/jpeg', 0.8);
    const croppedBase64 = dataUrl.split(',')[1];
    history.replace('/scan/review', { imageBase64: croppedBase64 });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Recadrer</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>Annuler</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <Cropper
          ref={cropperRef}
          src={`data:image/jpeg;base64,${imageBase64}`}
          style={{ height: '100%', width: '100%' }}
          guides={true}
          autoCropArea={0.9}
          viewMode={1}
        />
      </IonContent>
      <IonFooter>
        <IonToolbar>
          <IonButton expand="block" onClick={onConfirm}>Confirmer</IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default CropPage;
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/mobile && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/hooks/ apps/mobile/src/pages/scanner/CropPage.tsx
git commit -m "feat: add camera hooks and crop page"
```

---

## Task 11: Mobile — Scanner Page + OCR Review Form

**Files:**
- Modify: `apps/mobile/src/pages/scanner/ScannerPage.tsx` (replace stub)
- Modify: `apps/mobile/src/pages/scanner/ReviewPage.tsx` (replace stub)
- Create: `apps/mobile/src/components/LineItemsList.tsx`

**Interfaces:**
- Consumes: `useCamera`, `useImageCompressor`, `api` (POST /receipts/scan, POST /receipts), `useReceiptsStore().addReceipt`
- Produces: complete scan → crop → OCR → review → save flow

- [ ] **Step 1: Create apps/mobile/src/components/LineItemsList.tsx**

```tsx
import React from 'react';
import { IonItem, IonLabel, IonInput, IonButton, IonIcon, IonList } from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
import { useFieldArray, Control } from 'react-hook-form';

interface LineItemField {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Props {
  control: Control<{ lineItems: LineItemField[] } & Record<string, unknown>>;
}

const LineItemsList: React.FC<Props> = ({ control }) => {
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  return (
    <IonList>
      {fields.map((field, index) => (
        <IonItem key={field.id}>
          <IonLabel position="floating">Article {index + 1}</IonLabel>
          <IonInput placeholder="Description" />
          <IonInput type="number" placeholder="Total" slot="end" style={{ maxWidth: 80 }} />
          <IonButton fill="clear" slot="end" onClick={() => remove(index)}>
            <IonIcon icon={trashOutline} />
          </IonButton>
        </IonItem>
      ))}
      <IonItem button onClick={() => append({ description: '', quantity: 1, unitPrice: 0, total: 0 })}>
        <IonIcon icon={addOutline} slot="start" />
        <IonLabel>Ajouter un article</IonLabel>
      </IonItem>
    </IonList>
  );
};

export default LineItemsList;
```

- [ ] **Step 2: Implement apps/mobile/src/pages/scanner/ScannerPage.tsx**

```tsx
import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonButton, IonIcon, IonSpinner, IonText, IonFab, IonFabButton,
} from '@ionic/react';
import { cameraOutline, imagesOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useCamera } from '../../hooks/useCamera';
import { useImageCompressor } from '../../hooks/useImageCompressor';

const ScannerPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { takePhoto, pickFromGallery } = useCamera();
  const { compress } = useImageCompressor();
  const history = useHistory();

  const handleCapture = async (source: 'camera' | 'gallery') => {
    setLoading(true);
    setError(null);
    try {
      const raw = source === 'camera' ? await takePhoto() : await pickFromGallery();
      const compressed = await compress(raw);
      history.push('/scan/crop', { imageBase64: compressed });
    } catch {
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Scanner un ticket</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding ion-text-center">
        {loading && (
          <div className="ion-padding">
            <IonSpinner />
            <p>Traitement en cours...</p>
          </div>
        )}
        {error && <IonText color="danger"><p>{error}</p></IonText>}

        <IonButton
          expand="block"
          size="large"
          onClick={() => handleCapture('camera')}
          disabled={loading}
          className="ion-margin-top"
        >
          <IonIcon icon={cameraOutline} slot="start" />
          Prendre une photo
        </IonButton>

        <IonButton
          expand="block"
          fill="outline"
          onClick={() => handleCapture('gallery')}
          disabled={loading}
          className="ion-margin-top"
        >
          <IonIcon icon={imagesOutline} slot="start" />
          Importer depuis la galerie
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default ScannerPage;
```

- [ ] **Step 3: Implement apps/mobile/src/pages/scanner/ReviewPage.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonItem, IonLabel, IonInput, IonSpinner, IonText, IonList, IonListHeader,
} from '@ionic/react';
import { useForm } from 'react-hook-form';
import { useHistory, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import { useReceiptsStore } from '../../store/receipts.store';
import LineItemsList from '../../components/LineItemsList';
import type { ScanResponse, CreateReceiptRequest, Receipt } from '@receipt-scanner/shared';

interface LocationState { imageBase64: string }

interface FormValues {
  store: string;
  date: string;
  total: string;
  currency: string;
  tax: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

const ReviewPage: React.FC = () => {
  const location = useLocation<LocationState>();
  const history = useHistory();
  const { addReceipt } = useReceiptsStore();
  const [scanning, setScanning] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, control } = useForm<FormValues>({
    defaultValues: { currency: 'EUR', lineItems: [] },
  });

  useEffect(() => {
    const { imageBase64 } = location.state ?? {};
    if (!imageBase64) { history.replace('/scanner'); return; }

    (async () => {
      try {
        const { data } = await api.post<ScanResponse>('/receipts/scan', { imageBase64 });
        setImageUrl(data.imageUrl);
        const r = data.ocrResult;
        reset({
          store: r.store ?? '',
          date: r.date ?? '',
          total: r.total?.toString() ?? '',
          currency: r.currency ?? 'EUR',
          tax: r.tax?.toString() ?? '',
          lineItems: r.lineItems.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
          })),
        });
        if (r.confidence < 0.4) {
          setScanError('Image peu lisible. Vérifiez et corrigez les informations.');
        }
      } catch {
        setScanError('OCR échoué. Remplissez les informations manuellement.');
      } finally {
        setScanning(false);
      }
    })();
  }, []);

  const onSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload: CreateReceiptRequest = {
        store: values.store || null,
        date: values.date || null,
        total: values.total ? parseFloat(values.total) : null,
        currency: values.currency || 'EUR',
        tax: values.tax ? parseFloat(values.tax) : null,
        imageUrl,
        rawOcr: '{}',
        lineItems: values.lineItems,
      };
      const { data } = await api.post<Receipt>('/receipts', payload);
      addReceipt(data);
      history.replace('/history');
    } catch {
      setScanError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  if (scanning) {
    return (
      <IonPage>
        <IonContent className="ion-text-center ion-padding">
          <IonSpinner />
          <p>Analyse du ticket en cours...</p>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Vérifier les informations</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()}>Annuler</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {scanError && (
          <IonText color="warning" className="ion-padding">
            <p>{scanError}</p>
          </IonText>
        )}
        <form onSubmit={handleSubmit(onSave)}>
          <IonList>
            <IonListHeader><IonLabel>Informations générales</IonLabel></IonListHeader>
            <IonItem>
              <IonLabel position="floating">Magasin</IonLabel>
              <IonInput {...register('store')} />
            </IonItem>
            <IonItem>
              <IonLabel position="floating">Date (YYYY-MM-DD)</IonLabel>
              <IonInput type="date" {...register('date')} />
            </IonItem>
            <IonItem>
              <IonLabel position="floating">Total</IonLabel>
              <IonInput type="number" step="0.01" {...register('total')} />
            </IonItem>
            <IonItem>
              <IonLabel position="floating">Devise</IonLabel>
              <IonInput {...register('currency')} />
            </IonItem>
            <IonItem>
              <IonLabel position="floating">TVA</IonLabel>
              <IonInput type="number" step="0.01" {...register('tax')} />
            </IonItem>

            <IonListHeader><IonLabel>Articles</IonLabel></IonListHeader>
            <LineItemsList control={control as Parameters<typeof LineItemsList>[0]['control']} />
          </IonList>

          <div className="ion-padding">
            <IonButton expand="block" type="submit" disabled={saving}>
              {saving ? <IonSpinner /> : 'Sauvegarder'}
            </IonButton>
          </div>
        </form>
      </IonContent>
    </IonPage>
  );
};

export default ReviewPage;
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/mobile && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/pages/scanner/ apps/mobile/src/components/LineItemsList.tsx
git commit -m "feat: add scanner page, crop flow, and OCR review form"
```

---

## Task 12: Mobile — History Page

**Files:**
- Modify: `apps/mobile/src/pages/history/HistoryPage.tsx` (replace stub)
- Create: `apps/mobile/src/components/ReceiptCard.tsx`

**Interfaces:**
- Consumes: `api` (GET /receipts), `useReceiptsStore`
- Produces: paginated receipt list with search + date/amount filters

- [ ] **Step 1: Create apps/mobile/src/components/ReceiptCard.tsx**

```tsx
import React from 'react';
import {
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonBadge,
} from '@ionic/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useHistory } from 'react-router-dom';
import type { Receipt } from '@receipt-scanner/shared';

interface Props { receipt: Receipt }

const ReceiptCard: React.FC<Props> = ({ receipt }) => {
  const history = useHistory();
  const dateLabel = receipt.date
    ? format(new Date(receipt.date), 'd MMM yyyy', { locale: fr })
    : 'Date inconnue';

  return (
    <IonCard onClick={() => history.push(`/receipts/${receipt.id}`)} button>
      <IonCardHeader>
        <IonCardTitle>{receipt.store ?? 'Magasin inconnu'}</IonCardTitle>
        <IonCardSubtitle>{dateLabel}</IonCardSubtitle>
      </IonCardHeader>
      <IonCardContent>
        {receipt.total != null && (
          <IonBadge color="primary">
            {receipt.total.toFixed(2)} {receipt.currency}
          </IonBadge>
        )}
      </IonCardContent>
    </IonCard>
  );
};

export default ReceiptCard;
```

- [ ] **Step 2: Implement apps/mobile/src/pages/history/HistoryPage.tsx**

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonSearchbar,
  IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent,
  IonSpinner, IonText,
} from '@ionic/react';
import { api } from '../../services/api';
import { useReceiptsStore } from '../../store/receipts.store';
import ReceiptCard from '../../components/ReceiptCard';
import type { ReceiptsListResponse } from '@receipt-scanner/shared';

const LIMIT = 20;

const HistoryPage: React.FC = () => {
  const { receipts, total, setReceipts } = useReceiptsStore();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const infiniteRef = useRef<HTMLIonInfiniteScrollElement>(null);

  const fetchReceipts = useCallback(async (pageNum: number, query: string, replace: boolean) => {
    setLoading(true);
    try {
      const { data } = await api.get<ReceiptsListResponse>('/receipts', {
        params: { page: pageNum, limit: LIMIT, search: query || undefined },
      });
      if (replace) {
        setReceipts(data.receipts, data.total);
      } else {
        setReceipts([...receipts, ...data.receipts], data.total);
      }
      setHasMore(data.receipts.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, [receipts, setReceipts]);

  useEffect(() => {
    setPage(1);
    fetchReceipts(1, search, true);
  }, [search]);

  const onRefresh = async (e: CustomEvent) => {
    setPage(1);
    await fetchReceipts(1, search, true);
    (e.target as HTMLIonRefresherElement).complete();
  };

  const onInfinite = async (e: CustomEvent) => {
    const next = page + 1;
    setPage(next);
    await fetchReceipts(next, search, false);
    infiniteRef.current?.complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Historique</IonTitle></IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={search}
            onIonInput={(e) => setSearch(e.detail.value ?? '')}
            placeholder="Rechercher un magasin..."
            debounce={400}
          />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={onRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && receipts.length === 0 && (
          <div className="ion-text-center ion-padding"><IonSpinner /></div>
        )}

        {!loading && receipts.length === 0 && (
          <IonText color="medium" className="ion-text-center ion-padding">
            <p>Aucun ticket trouvé.</p>
          </IonText>
        )}

        {receipts.map(r => <ReceiptCard key={r.id} receipt={r} />)}

        <IonInfiniteScroll ref={infiniteRef} disabled={!hasMore} onIonInfinite={onInfinite}>
          <IonInfiniteScrollContent loadingText="Chargement..." />
        </IonInfiniteScroll>
      </IonContent>
    </IonPage>
  );
};

export default HistoryPage;
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/mobile && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/pages/history/ apps/mobile/src/components/ReceiptCard.tsx
git commit -m "feat: add history page with search and infinite scroll"
```

---

## Task 13: Mobile — Receipt Detail Page

**Files:**
- Modify: `apps/mobile/src/pages/receipts/ReceiptDetailPage.tsx` (replace stub)

**Interfaces:**
- Consumes: `api` (GET/PUT/DELETE /receipts/:id), `useReceiptsStore`
- Produces: detail view with image, edit mode, delete with confirmation

- [ ] **Step 1: Implement apps/mobile/src/pages/receipts/ReceiptDetailPage.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonIcon, IonItem, IonLabel, IonInput, IonSpinner, IonAlert, IonImg,
  IonBackButton, IonList, IonListHeader,
} from '@ionic/react';
import { trashOutline, createOutline, saveOutline } from 'ionicons/icons';
import { useParams, useHistory } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '../../services/api';
import { useReceiptsStore } from '../../store/receipts.store';
import type { Receipt, UpdateReceiptRequest } from '@receipt-scanner/shared';

interface FormValues { store: string; date: string; total: string; currency: string; tax: string; }

const ReceiptDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const { updateReceipt, removeReceipt } = useReceiptsStore();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [editing, setEditing] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormValues>();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Receipt>(`/receipts/${id}`);
        setReceipt(data);
        reset({
          store: data.store ?? '',
          date: data.date ?? '',
          total: data.total?.toString() ?? '',
          currency: data.currency,
          tax: data.tax?.toString() ?? '',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onSave = async (values: FormValues) => {
    setSaving(true);
    try {
      const payload: UpdateReceiptRequest = {
        store: values.store || null,
        date: values.date || null,
        total: values.total ? parseFloat(values.total) : null,
        currency: values.currency || 'EUR',
        tax: values.tax ? parseFloat(values.tax) : null,
      };
      const { data } = await api.put<Receipt>(`/receipts/${id}`, payload);
      setReceipt(data);
      updateReceipt(data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    await api.delete(`/receipts/${id}`);
    removeReceipt(id);
    history.replace('/history');
  };

  if (loading) return <IonPage><IonContent className="ion-text-center ion-padding"><IonSpinner /></IonContent></IonPage>;
  if (!receipt) return <IonPage><IonContent><p>Ticket introuvable</p></IonContent></IonPage>;

  const dateLabel = receipt.date
    ? format(new Date(receipt.date), 'd MMMM yyyy', { locale: fr })
    : 'Date inconnue';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/history" /></IonButtons>
          <IonTitle>{receipt.store ?? 'Ticket'}</IonTitle>
          <IonButtons slot="end">
            {editing ? (
              <IonButton onClick={handleSubmit(onSave)} disabled={saving}>
                <IonIcon icon={saveOutline} />
              </IonButton>
            ) : (
              <>
                <IonButton onClick={() => setEditing(true)}>
                  <IonIcon icon={createOutline} />
                </IonButton>
                <IonButton color="danger" onClick={() => setShowDeleteAlert(true)}>
                  <IonIcon icon={trashOutline} />
                </IonButton>
              </>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {receipt.imageUrl && (
          <IonImg src={receipt.imageUrl} style={{ maxHeight: 200, objectFit: 'contain' }} />
        )}
        <IonList>
          <IonListHeader><IonLabel>Informations</IonLabel></IonListHeader>
          <IonItem>
            <IonLabel position="floating">Magasin</IonLabel>
            {editing
              ? <IonInput {...register('store')} />
              : <IonLabel slot="end">{receipt.store ?? '—'}</IonLabel>}
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Date</IonLabel>
            {editing
              ? <IonInput type="date" {...register('date')} />
              : <IonLabel slot="end">{dateLabel}</IonLabel>}
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Total</IonLabel>
            {editing
              ? <IonInput type="number" step="0.01" {...register('total')} />
              : <IonLabel slot="end">{receipt.total?.toFixed(2)} {receipt.currency}</IonLabel>}
          </IonItem>
          <IonItem>
            <IonLabel position="floating">TVA</IonLabel>
            {editing
              ? <IonInput type="number" step="0.01" {...register('tax')} />
              : <IonLabel slot="end">{receipt.tax?.toFixed(2) ?? '—'}</IonLabel>}
          </IonItem>

          {receipt.lineItems.length > 0 && (
            <>
              <IonListHeader><IonLabel>Articles</IonLabel></IonListHeader>
              {receipt.lineItems.map(item => (
                <IonItem key={item.id}>
                  <IonLabel>{item.description}</IonLabel>
                  <IonLabel slot="end">{item.total.toFixed(2)} {receipt.currency}</IonLabel>
                </IonItem>
              ))}
            </>
          )}
        </IonList>

        <IonAlert
          isOpen={showDeleteAlert}
          header="Supprimer ce ticket ?"
          message="Cette action est irréversible."
          buttons={[
            { text: 'Annuler', role: 'cancel', handler: () => setShowDeleteAlert(false) },
            { text: 'Supprimer', role: 'destructive', handler: onDelete },
          ]}
          onDidDismiss={() => setShowDeleteAlert(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default ReceiptDetailPage;
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/mobile && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/pages/receipts/
git commit -m "feat: add receipt detail page with edit and delete"
```

---

## Task 14: Mobile — Stats Page

**Files:**
- Modify: `apps/mobile/src/pages/stats/StatsPage.tsx` (replace stub)
- Create: `apps/mobile/src/components/StatsChart.tsx`

**Interfaces:**
- Consumes: `api` (GET /receipts/stats)
- Produces: monthly total, weekly bar chart, top stores, average per receipt

- [ ] **Step 1: Create apps/mobile/src/components/StatsChart.tsx**

```tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint { week: string; total: number }
interface Props { data: DataPoint[]; currency: string }

const StatsChart: React.FC<Props> = ({ data, currency }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="week"
        tickFormatter={(v: string) => v.slice(5)} // Show MM-DD
        tick={{ fontSize: 11 }}
      />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip formatter={(v: number) => [`${v.toFixed(2)} ${currency}`, 'Total']} />
      <Bar dataKey="total" fill="#3880ff" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export default StatsChart;
```

- [ ] **Step 2: Implement apps/mobile/src/pages/stats/StatsPage.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonSpinner,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonItem, IonLabel,
  IonRefresher, IonRefresherContent,
} from '@ionic/react';
import { api } from '../../services/api';
import StatsChart from '../../components/StatsChart';
import type { StatsResponse } from '@receipt-scanner/shared';

const StatsPage: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<StatsResponse>('/receipts/stats');
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = async (e: CustomEvent) => {
    await fetchStats();
    (e.target as HTMLIonRefresherElement).complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Statistiques</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={onRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <div className="ion-text-center ion-padding"><IonSpinner /></div>}

        {stats && (
          <>
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Ce mois-ci</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
                  {stats.totalThisMonth.toFixed(2)} {stats.currency}
                </p>
                <p>Moyenne par ticket : {stats.averagePerReceipt.toFixed(2)} {stats.currency}</p>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader><IonCardTitle>Par semaine</IonCardTitle></IonCardHeader>
              <IonCardContent>
                <StatsChart data={stats.weeklyTotals} currency={stats.currency} />
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader><IonCardTitle>Top magasins</IonCardTitle></IonCardHeader>
              {stats.topStores.map(s => (
                <IonItem key={s.store}>
                  <IonLabel>{s.store}</IonLabel>
                  <IonLabel slot="end">{s.count} tickets · {s.total.toFixed(2)} {stats.currency}</IonLabel>
                </IonItem>
              ))}
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default StatsPage;
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/mobile && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/pages/stats/ apps/mobile/src/components/StatsChart.tsx
git commit -m "feat: add stats page with bar chart and top stores"
```

---

## Task 15: Mobile — Profile Page

**Files:**
- Modify: `apps/mobile/src/pages/profile/ProfilePage.tsx` (replace stub)

**Interfaces:**
- Consumes: `useAuthStore().logout`, `useAuthStore().user`
- Produces: profile view with account info and logout button

- [ ] **Step 1: Implement apps/mobile/src/pages/profile/ProfilePage.tsx**

```tsx
import React, { useState } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle,
  IonList, IonItem, IonLabel, IonButton, IonAlert, IonAvatar, IonIcon,
} from '@ionic/react';
import { personCircleOutline, logOutOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const history = useHistory();
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);

  const onLogout = async () => {
    await logout();
    history.replace('/auth/login');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar><IonTitle>Profil</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-text-center ion-padding">
          <IonIcon icon={personCircleOutline} style={{ fontSize: '80px', color: 'var(--ion-color-medium)' }} />
          <p style={{ margin: '8px 0 0' }}>{user?.email ?? 'Utilisateur Apple'}</p>
        </div>

        <IonList>
          <IonItem>
            <IonLabel>
              <h2>Email</h2>
              <p>{user?.email ?? '—'}</p>
            </IonLabel>
          </IonItem>
        </IonList>

        <div className="ion-padding">
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            onClick={() => setShowLogoutAlert(true)}
          >
            <IonIcon icon={logOutOutline} slot="start" />
            Se déconnecter
          </IonButton>
        </div>

        <IonAlert
          isOpen={showLogoutAlert}
          header="Se déconnecter ?"
          buttons={[
            { text: 'Annuler', role: 'cancel', handler: () => setShowLogoutAlert(false) },
            { text: 'Se déconnecter', role: 'destructive', handler: onLogout },
          ]}
          onDidDismiss={() => setShowLogoutAlert(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/mobile && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/pages/profile/
git commit -m "feat: add profile page with logout"
```

---

## Task 16: iOS — Capacitor Configuration + Xcode Setup

**Files:**
- Create: `apps/mobile/capacitor.config.ts`
- Modify: `apps/mobile/package.json` — add Capacitor scripts

**Interfaces:**
- Produces: functional iOS project ready for Simulator and device testing

- [ ] **Step 1: Create apps/mobile/capacitor.config.ts**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourapp.receiptscanner',
  appName: 'Receipt Scanner',
  webDir: 'dist',
  server: {
    // For local development against local backend
    // Remove for production build
    // url: 'http://192.168.1.x:3000',
    // cleartext: true,
  },
  ios: {
    deploymentTarget: '15.0',
    backgroundColor: '#ffffff',
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  plugins: {
    Camera: {
      presentationStyle: 'popover',
    },
  },
};

export default config;
```

- [ ] **Step 2: Add Capacitor scripts to apps/mobile/package.json**

Add under `"scripts"`:
```json
"cap:add:ios": "npx cap add ios",
"cap:sync": "npx cap sync ios",
"cap:open": "npx cap open ios"
```

- [ ] **Step 3: Build and sync**

```bash
cd apps/mobile
pnpm build
npx cap add ios
npx cap sync ios
```
Expected: `ios/` directory created with Xcode project.

- [ ] **Step 4: Configure Info.plist permissions**

Open `ios/App/App/Info.plist` and add the following keys:

```xml
<key>NSCameraUsageDescription</key>
<string>Receipt Scanner utilise la caméra pour prendre en photo vos tickets de caisse.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Receipt Scanner accède à votre galerie pour importer des tickets de caisse.</string>
```

- [ ] **Step 5: Configure Xcode deployment target**

Open `ios/App/App.xcodeproj` in Xcode:
1. Select the `App` target → General tab
2. Set `Minimum Deployments` to `iOS 15.0`
3. Under `Signing & Capabilities`:
   - Enable automatic signing with your Apple Developer team
   - Add capability: `Sign in with Apple`
4. Verify Bundle Identifier matches `com.yourapp.receiptscanner`

- [ ] **Step 6: Test on Simulator**

In Xcode, select any iOS 15+ simulator and press Run (⌘R).

Expected:
- App launches on simulator
- Login page displays correctly
- Camera tab shows scanner buttons (camera won't work in Simulator — test on device)
- No crash on launch

- [ ] **Step 7: Add VITE_API_URL environment variable**

Create `apps/mobile/.env` (not committed):
```
VITE_API_URL=https://your-backend.railway.app
```

Create `apps/mobile/.env.example`:
```
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/capacitor.config.ts apps/mobile/package.json apps/mobile/.env.example
git commit -m "feat: configure Capacitor for iOS 15+ with camera and Sign In with Apple"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Scanner avec caméra | Task 10, 11 |
| Import depuis galerie | Task 10, 11 |
| Recadrage image | Task 10 (CropPage) |
| OCR | Task 5, 11 |
| Extraction magasin/date/total/devise/TVA/articles | Task 5 (parseVisionText) |
| Modifier avant sauvegarde | Task 11 (ReviewPage) |
| Historique | Task 12 |
| Page détail ticket | Task 13 |
| Recherche et filtrage | Task 12 (search bar, GET /receipts params) |
| Statistiques | Task 6 (stats route), Task 14 |
| Auth utilisateur | Task 4 |
| Gestion tickets backend | Task 6 |
| Stockage données SQLite | Task 3, 6 |
| API sécurisée (JWT) | Task 3 (jwtPlugin), Task 4, 6, 7 |
| Cloudinary images | Task 5 |
| iOS 15+ deployment target | Task 16 |
| Safe area insets | Task 8 (theme/variables.css) |
| Apple Sign In | Task 4 (/auth/apple), Task 9 (LoginPage) |
| Compression image | Task 10 (useImageCompressor) |
| Rate limiting | Task 3 (rate-limit plugin), Task 4, 6 |
| Railway deploy | Task 3 (railway.toml) |

# Receipt Scanner — Design Spec
Date: 2026-09-26

## Overview

A hybrid mobile app (Ionic React + Capacitor + TypeScript) for iOS that lets users photograph receipts, extract data via OCR, and track their expenses. Published on the App Store.

**Stack decisions:**
- OCR: Google Cloud Vision API (server-side)
- Backend: Node.js + Fastify + SQLite (better-sqlite3)
- Auth: Apple Sign In + Email/password with JWT
- Image storage: Cloudinary (server-side upload)
- Backend hosting: Railway
- iOS deployment target: iOS 15+
- Architecture: PNPM monorepo (TypeScript throughout)

---

## Project Structure

```
receipt-scanner/
├── apps/
│   ├── mobile/                    # Ionic React + Capacitor
│   │   ├── src/
│   │   │   ├── pages/             # Scanner, History, Detail, Stats, Auth
│   │   │   ├── components/        # Reusable UI components
│   │   │   ├── hooks/             # useCamera, useOCR, useReceipts
│   │   │   ├── services/          # api.ts, storage.ts
│   │   │   ├── store/             # Zustand global state
│   │   │   └── theme/             # Ionic variables, colors
│   │   ├── ios/                   # Xcode project (Capacitor-generated)
│   │   └── capacitor.config.ts
│   │
│   └── backend/                   # Fastify + SQLite
│       ├── src/
│       │   ├── routes/            # auth.ts, receipts.ts, users.ts
│       │   ├── plugins/           # jwt.ts, cloudinary.ts, vision.ts
│       │   ├── db/                # schema.ts, migrations/
│       │   └── types/             # Fastify-local types
│       └── railway.toml
│
├── packages/
│   └── shared/                    # Shared TypeScript types
│       └── src/
│           ├── receipt.types.ts   # Receipt, LineItem, OcrResult
│           └── api.types.ts       # Request/Response contracts
│
├── package.json                   # PNPM workspaces root
└── pnpm-workspace.yaml
```

**State management:** Zustand — lightweight, no Redux boilerplate, works well with Ionic lifecycle.  
**HTTP client:** Axios with JWT interceptors (auto-refresh on 401).  
**Database driver:** `better-sqlite3` — synchronous, performant, zero config, Railway-compatible.

---

## Core Flow: Scan → Save

```
[Camera / Gallery]
      ↓
[Image crop]               ← @capacitor/camera + cropperjs
      ↓
[Resize + compress]        ← max 1920px, JPEG 80% quality (client-side, before upload)
      ↓
[POST /receipts/scan]      ← mobile sends base64 image (~200-400KB after compression)
      ↓
[Backend: Cloudinary upload] ← returns image URL
      ↓
[Backend: Google Vision OCR] ← called with Cloudinary URL
      ↓
[Backend: structured parse]  ← extracts store, date, total, tax, line items
      ↓
[Review form]              ← user corrects fields if needed
      ↓
[POST /receipts]           ← save to SQLite
      ↓
[History updated]
```

**Security:** API keys (Google Vision, Cloudinary) never leave the backend. The mobile app only sends the image and receives parsed data + image URL.

**Error handling:**
- Vision API failure → clear error message, user can fill form manually.
- Low confidence score from Vision → prompt user to retake photo.
- Network offline → show cached receipts (read-only), queue scan for when back online is a v2 feature.

---

## Navigation

```
IonTabs (bottom bar)
├── Tab 1 — Scanner        (camera icon)     ← default tab
├── Tab 2 — History        (list icon)
├── Tab 3 — Statistics     (chart icon)
└── Tab 4 — Profile        (user icon)

Modal / stack routes:
├── /auth/login
├── /auth/register
├── /scan/crop             ← crop modal
├── /scan/review           ← OCR review form
└── /receipts/:id          ← receipt detail (pushed on History stack)
```

**Page details:**

- **Scanner**: "Take Photo" + "Import from Gallery" buttons. Loading state with progress indicator during OCR.
- **History**: receipt list with top search bar + filters (date range, store, amount range). Pull-to-refresh. Infinite scroll pagination.
- **Statistics**: monthly total, weekly bar chart, top stores, average per receipt. Data fetched from `GET /receipts/stats` (server-computed, not from local cache).
- **Profile**: account info, logout. Structured to later accommodate Pro subscription and PDF/CSV export.
- **Receipt Detail**: receipt image, all extracted fields, edit and delete actions.
- **OCR Review Form**: pre-filled form (store, date, total, currency, tax), editable line items list, save button.

**iOS compatibility:**
- Safe area insets via Ionic CSS variables (`--ion-safe-area-*`) — supports notch, Dynamic Island, Home button devices.
- No custom gestures conflicting with iOS native swipe-back.
- `IonContent` scroll handled correctly on all screen sizes (iPhone SE to Pro Max).

---

## Backend API

### Routes

```
POST   /auth/register          # Email + password
POST   /auth/login             # Email + password → JWT pair
POST   /auth/apple             # Apple Sign In token → JWT pair
POST   /auth/refresh           # Refresh token → new access token
DELETE /auth/logout           # Invalidate refresh token in DB

POST   /receipts/scan          # Image upload → OCR → parsed data (does NOT save)
POST   /receipts               # Save receipt after user review
GET    /receipts               # List with pagination + filters
GET    /receipts/:id           # Receipt detail
PUT    /receipts/:id           # Update receipt
DELETE /receipts/:id           # Delete receipt

GET    /receipts/stats         # Aggregated stats (total/month, top stores, avg) — server-computed

GET    /users/me               # User profile
PUT    /users/me               # Update profile
```

### SQLite Schema

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,  -- UUID
  email        TEXT UNIQUE,
  apple_id     TEXT UNIQUE,
  password_hash TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE refresh_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE receipts (
  id         TEXT PRIMARY KEY,  -- UUID
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store      TEXT,
  date       TEXT,              -- ISO 8601
  total      REAL,
  currency   TEXT DEFAULT 'EUR',
  tax        REAL,
  image_url  TEXT,
  raw_ocr    TEXT,              -- JSON string, kept for debugging
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE line_items (
  id          TEXT PRIMARY KEY,
  receipt_id  TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  description TEXT,
  quantity    REAL,
  unit_price  REAL,
  total       REAL
);

CREATE INDEX idx_receipts_user_id ON receipts(user_id);
CREATE INDEX idx_receipts_date ON receipts(date);
```

### Security

- JWT access token: 15-minute expiry, signed with `JWT_SECRET`.
- Refresh token: 30-day expiry, stored hashed in `refresh_tokens` table.
- All `/receipts` and `/users` routes protected by `@fastify/jwt` plugin.
- Row-level security: every query filters by `user_id` from the JWT payload.
- Rate limiting via `@fastify/rate-limit`: 5 req/min on auth routes, 10 req/min on `/receipts/scan`.
- CORS configured to allow only the app's bundle ID origin in production.

### Environment Variables

```
JWT_SECRET
GOOGLE_VISION_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
DATABASE_PATH          # Railway volume mount path
PORT                   # default 3000
```

---

## Key Dependencies

### Mobile (apps/mobile)
| Package | Purpose |
|---|---|
| `@ionic/react` | UI framework |
| `@capacitor/core` | Native bridge |
| `@capacitor/camera` | Camera + gallery access |
| `@capacitor/preferences` | Local key-value storage (auth token) |
| `@capacitor/status-bar` | Status bar styling |
| `@capacitor/haptics` | Haptic feedback |
| `zustand` | Global state |
| `axios` | HTTP client |
| `react-hook-form` | OCR review form |
| `cropperjs` | Image cropping |
| `date-fns` | Date formatting |
| `recharts` | Statistics charts |

### Backend (apps/backend)
| Package | Purpose |
|---|---|
| `fastify` | HTTP framework |
| `@fastify/jwt` | JWT auth plugin |
| `@fastify/rate-limit` | Rate limiting |
| `@fastify/cors` | CORS |
| `better-sqlite3` | SQLite driver |
| `cloudinary` | Image upload SDK |
| `@google-cloud/vision` | OCR API client |
| `bcryptjs` | Password hashing |
| `uuid` | ID generation |
| `zod` | Request validation |

---

## iOS Configuration

- **Deployment target:** iOS 15.0
- **Capacitor version:** 6.x (latest stable)
- **Xcode project:** configured for App Store distribution
- **Permissions in Info.plist:**
  - `NSCameraUsageDescription` — "Used to scan your receipts"
  - `NSPhotoLibraryUsageDescription` — "Used to import receipts from your gallery"
- **Signing:** Automatic signing for development, manual for App Store distribution
- **Capabilities:** Sign In with Apple (required for Apple auth)

---

## Future Extension Points (not built in MVP)

The architecture accommodates these without structural changes:

| Feature | Extension point |
|---|---|
| AdMob | Add `@capacitor-community/admob`, toggle in Profile page |
| Pro subscription | Add `purchases` table, `@revenuecat/purchases-capacitor` |
| In-app purchases | RevenueCat handles StoreKit, backend validates receipts |
| PDF/CSV export | Add `GET /receipts/export` route + `jsPDF` on mobile |
| Cloud sync | Replace local Zustand cache with server-first data fetching |
| AI features | Add AI route in backend, call from existing scan pipeline |

---

## Out of Scope for MVP

- Offline-first / queue when offline
- Multi-currency conversion
- Receipt sharing
- Push notifications
- Dark mode (Ionic handles it automatically via system preference)
- Android support (Capacitor is cross-platform but iOS is the priority)

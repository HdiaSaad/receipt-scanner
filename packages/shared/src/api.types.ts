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

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

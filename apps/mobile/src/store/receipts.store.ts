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

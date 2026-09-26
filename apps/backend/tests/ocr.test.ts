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

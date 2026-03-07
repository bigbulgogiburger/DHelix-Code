import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunker.js';

describe('chunkText', () => {
  it('returns an empty array for empty text', () => {
    const result = chunkText('', 'source');
    expect(result).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const text = 'Short text';
    const result = chunkText(text, 'source');
    expect(result).toEqual([{ text, source: 'source', index: 0 }]);
  });

  it('returns multiple chunks for long text with correct overlap', () => {
    const text = 'a'.repeat(600);
    const result = chunkText(text, 'source', { chunkSize: 500, overlap: 100 });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].text.length).toBe(500);
    expect(result[1].text.startsWith(result[0].text.slice(-100))).toBe(true);
  });

  it('uses custom chunkSize and overlap', () => {
    const text = 'a'.repeat(300);
    const result = chunkText(text, 'source', { chunkSize: 200, overlap: 50 });
    expect(result.length).toBe(2);
    expect(result[0].text.length).toBe(200);
    expect(result[1].text.startsWith(result[0].text.slice(-50))).toBe(true);
  });
});
import { describe, it, expect } from 'vitest';
import { chunkText } from '../chunker.js';

const source = 'test-source';

describe('chunkText', () => {
  it('returns an empty array for empty text', () => {
    const result = chunkText('', source);
    expect(result).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const text = 'short text';
    const result = chunkText(text, source);
    expect(result).toEqual([{ text, source, index: 0 }]);
  });

  it('returns multiple chunks for long text with correct overlap', () => {
    const text = 'a'.repeat(600);
    const result = chunkText(text, source);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].text.length).toBe(500);
    expect(result[1].text.startsWith('a'.repeat(100))).toBe(true);
  });

  it('uses custom chunkSize and overlap', () => {
    const text = 'a'.repeat(300);
    const options = { chunkSize: 200, overlap: 50 };
    const result = chunkText(text, source, options);
    expect(result.length).toBe(2);
    expect(result[0].text.length).toBe(200);
    expect(result[1].text.startsWith('a'.repeat(50))).toBe(true);
  });
});
import { describe, it, expect } from 'vitest';
import { dotProduct, magnitude, cosineSimilarity } from '../similarity.js';

describe('dotProduct', () => {
  it('calculates the dot product of two vectors', () => {
    const result = dotProduct([1, 2, 3], [4, 5, 6]);
    expect(result).toBe(32);
  });
});

describe('magnitude', () => {
  it('calculates the magnitude of a vector', () => {
    const result = magnitude([3, 4]);
    expect(result).toBe(5);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const result = cosineSimilarity([1, 0], [1, 0]);
    expect(result).toBe(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const result = cosineSimilarity([1, 0], [0, 1]);
    expect(result).toBe(0);
  });

  it('throws an error for mismatched vector lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1])).toThrow();
  });

  it('returns 0 for zero vector', () => {
    const result = cosineSimilarity([0, 0], [0, 0]);
    expect(result).toBe(0);
  });
});
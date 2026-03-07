import { describe, it, expect } from 'vitest';
import { dotProduct, magnitude, cosineSimilarity } from '../similarity.js';

describe('dotProduct', () => {
  it('calculates the dot product of two vectors', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});

describe('magnitude', () => {
  it('calculates the magnitude of a vector', () => {
    expect(magnitude([3, 4])).toBe(5);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('throws an error for vectors of different lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1])).toThrow();
  });

  it('returns 0 for zero vector', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
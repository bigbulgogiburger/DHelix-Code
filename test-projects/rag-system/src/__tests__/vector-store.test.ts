import { describe, it, expect } from 'vitest';
import { VectorStore } from '../vector-store.js';
import { cosineSimilarity } from '../similarity.js';

import { vi } from 'vitest';

type Mock = (...args: any[]) => any;
const mockCosineSimilarity = cosineSimilarity as unknown as Mock;

vi.mock('../similarity.js', () => ({
  cosineSimilarity: vi.fn()
}));

describe('VectorStore', () => {
  it('adds entries and retrieves them correctly', () => {
    const store = new VectorStore();
    const entries = [
      { text: 'A', source: 'source1', embedding: [1, 0] },
      { text: 'B', source: 'source2', embedding: [0, 1] }
    ];
    store.add(entries);
    expect(store.size()).toBe(2);
  });

  it('search returns correct topK results sorted by score', () => {
    const store = new VectorStore();
    const entries = [
      { text: 'A', source: 'source1', embedding: [1, 0] },
      { text: 'B', source: 'source2', embedding: [0, 1] }
    ];
    store.add(entries);
    mockCosineSimilarity.mockReturnValueOnce(0.9).mockReturnValueOnce(0.8);
    const results = store.search([1, 0], 1);
    expect(results.length).toBe(1);
    expect(results[0].text).toBe('A');
  });

  it('clear empties the store', () => {
    const store = new VectorStore();
    store.add([{ text: 'A', source: 'source1', embedding: [1, 0] }]);
    store.clear();
    expect(store.size()).toBe(0);
  });

  it('size returns the correct count of entries', () => {
    const store = new VectorStore();
    store.add([{ text: 'A', source: 'source1', embedding: [1, 0] }]);
    expect(store.size()).toBe(1);
  });
});
import { describe, it, expect } from 'vitest';
import { VectorStore } from '../vector-store.js';

const entries = [
  { text: 'entry1', source: 'source1', embedding: [1, 0, 0] },
  { text: 'entry2', source: 'source2', embedding: [0, 1, 0] },
  { text: 'entry3', source: 'source3', embedding: [0, 0, 1] }
];

describe('VectorStore', () => {
  it('adds entries and returns correct size', () => {
    const store = new VectorStore();
    store.add(entries);
    expect(store.size()).toBe(3);
  });

  it('search returns correct topK results sorted by score', () => {
    const store = new VectorStore();
    store.add(entries);
    const results = store.search([1, 0, 0], 2);
    expect(results.length).toBe(2);
    expect(results[0].text).toBe('entry1');
    expect(results[1].text).toBe('entry2');
  });

  it('clear empties the store', () => {
    const store = new VectorStore();
    store.add(entries);
    store.clear();
    expect(store.size()).toBe(0);
  });
});
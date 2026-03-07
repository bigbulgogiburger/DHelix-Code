import { describe, it, expect } from 'vitest';
import { VectorStore } from '../vector-store.js';

const mockEntries = [
  { text: 'entry1', source: 'source1', embedding: [1, 0] },
  { text: 'entry2', source: 'source2', embedding: [0, 1] },
  { text: 'entry3', source: 'source3', embedding: [1, 1] }
];

describe('VectorStore', () => {
  it('adds entries and retrieves them correctly', () => {
    const store = new VectorStore();
    store.add(mockEntries);
    expect(store.size()).toBe(3);
  });

  it('search returns correct topK results sorted by score', () => {
    const store = new VectorStore();
    store.add(mockEntries);
    const results = store.search([1, 0], 2);
    expect(results.length).toBe(2);
    expect(results[0].text).toBe('entry1');
    expect(results[1].text).toBe('entry3');
  });

  it('clear empties the store', () => {
    const store = new VectorStore();
    store.add(mockEntries);
    store.clear();
    expect(store.size()).toBe(0);
  });

  it('size returns the correct count', () => {
    const store = new VectorStore();
    expect(store.size()).toBe(0);
    store.add(mockEntries);
    expect(store.size()).toBe(3);
  });
});
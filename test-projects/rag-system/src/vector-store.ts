import { cosineSimilarity } from './similarity.js';

export interface VectorEntry {
  text: string;
  source: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  text: string;
  source: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class VectorStore {
  private entries: VectorEntry[] = [];

  add(entries: VectorEntry[]): void {
    this.entries.push(...entries);
  }

  search(queryEmbedding: number[], topK: number = 3): SearchResult[] {
    const results = this.entries.map(entry => {
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      return { ...entry, score };
    });
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ text, source, score, metadata }) => ({ text, source, score, metadata }));
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }
}
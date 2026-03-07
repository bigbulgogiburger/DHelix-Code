import { Embedder } from './embedder.js';
import { VectorStore, VectorEntry, SearchResult } from './vector-store.js';
import { Chunk } from './chunker.js';

export interface RetrieverConfig {
  embedder: Embedder;
  vectorStore: VectorStore;
  topK?: number;
}

export class Retriever {
  private embedder: Embedder;
  private vectorStore: VectorStore;
  private topK: number;

  constructor(config: RetrieverConfig) {
    this.embedder = config.embedder;
    this.vectorStore = config.vectorStore;
    this.topK = config.topK || 3;
  }

  async ingest(chunks: Chunk[]): Promise<void> {
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await this.embedder.embed(texts);
    const entries: VectorEntry[] = chunks.map((chunk, index) => ({
      text: chunk.text,
      source: chunk.source,
      embedding: embeddings[index],
      metadata: { index: chunk.index }
    }));
    this.vectorStore.add(entries);
  }

  async retrieve(query: string): Promise<SearchResult[]> {
    const [queryEmbedding] = await this.embedder.embed([query]);
    return this.vectorStore.search(queryEmbedding, this.topK);
  }
}

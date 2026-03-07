export interface ChunkOptions {
  chunkSize: number;
  overlap: number;
}

export interface Chunk {
  text: string;
  source: string;
  index: number;
}

export function chunkText(text: string, source: string, options: ChunkOptions = { chunkSize: 500, overlap: 100 }): Chunk[] {
  const { chunkSize, overlap } = options;
  if (text.length === 0) return [];
  if (text.length <= chunkSize) return [{ text, source, index: 0 }];

  const chunks: Chunk[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    const chunkText = text.slice(i, i + chunkSize);
    chunks.push({ text: chunkText, source, index: chunks.length });
  }
  return chunks;
}

import { promises as fs } from 'fs';

export async function chunkFile(filePath: string, options?: ChunkOptions): Promise<Chunk[]> {
  const text = await fs.readFile(filePath, 'utf-8');
  return chunkText(text, filePath, options);
}

import { promises as fs } from 'fs';

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
  let index = 0;
  for (let start = 0; start < text.length; start += chunkSize - overlap) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end);
    chunks.push({ text: chunkText, source, index: index++ });
    if (end === text.length) break;
  }
  return chunks;
}

export async function chunkFile(filePath: string, options?: ChunkOptions): Promise<Chunk[]> {
  const text = await fs.readFile(filePath, 'utf-8');
  return chunkText(text, filePath, options);
}
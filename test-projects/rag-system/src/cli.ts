import { promises as fs } from 'fs';
import path from 'path';
import { chunkFile } from './chunker.js';
import { Embedder, createEmbedder } from './embedder.js';
import { VectorStore } from './vector-store.js';
import { Retriever } from './retriever.js';
import { Generator } from './generator.js';

async function main() {
  const args = process.argv.slice(2);
  const query = args[0];
  const docsDir = args.includes('--docs-dir') ? args[args.indexOf('--docs-dir') + 1] : './docs';
  const apiKey = args.includes('--api-key') ? args[args.indexOf('--api-key') + 1] : process.env.OPENAI_API_KEY;

  if (!query) {
    console.error('Error: Query string is required.');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('Error: API key is required. Use --api-key or set OPENAI_API_KEY environment variable.');
    process.exit(1);
  }

  try {
    const files = await fs.readdir(docsDir);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    if (mdFiles.length === 0) {
      console.error('Error: No markdown files found in the specified directory.');
      process.exit(1);
    }

    const embedder = await createEmbedder(apiKey);
    const vectorStore = new VectorStore();
    const retriever = new Retriever({ embedder, vectorStore });
    const generator = new Generator({ apiKey });

    for (const file of mdFiles) {
      const filePath = path.join(docsDir, file);
      const chunks = await chunkFile(filePath);
      await retriever.ingest(chunks);
    }

    const relevantChunks = await retriever.retrieve(query);
    const answer = await generator.generate(query, relevantChunks);

    console.log('Answer:', answer.answer);
    console.log('Sources:', answer.sources.join(', '));
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
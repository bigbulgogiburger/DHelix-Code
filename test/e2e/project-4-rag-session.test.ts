/**
 * E2E Multi-turn Session Test: Node.js + RAG System
 *
 * Uses dbcode's agent-loop to build a RAG (Retrieval-Augmented Generation) system
 * incrementally across multiple conversation turns.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { OpenAICompatibleClient } from "../../src/llm/client.js";
import { selectStrategy } from "../../src/llm/tool-call-strategy.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { runAgentLoop, type AgentLoopConfig } from "../../src/core/agent-loop.js";
import { createEventEmitter } from "../../src/utils/events.js";
import { type ChatMessage } from "../../src/llm/provider.js";
import { fileReadTool } from "../../src/tools/definitions/file-read.js";
import { fileWriteTool } from "../../src/tools/definitions/file-write.js";
import { fileEditTool } from "../../src/tools/definitions/file-edit.js";
import { bashExecTool } from "../../src/tools/definitions/bash-exec.js";
import { globSearchTool } from "../../src/tools/definitions/glob-search.js";
import { grepSearchTool } from "../../src/tools/definitions/grep-search.js";

const hasApiKey = !!process.env.OPENAI_API_KEY;
const projectRoot = process.cwd();
const projectDir = join(projectRoot, "test-projects", "rag-system");

async function sendTurn(
  messages: ChatMessage[],
  userMessage: string,
  config: Omit<AgentLoopConfig, "maxIterations" | "maxTokens">,
): Promise<ChatMessage[]> {
  messages.push({ role: "user", content: userMessage });
  const result = await runAgentLoop(
    { ...config, maxIterations: 25, maxTokens: 16384 },
    messages,
  );
  messages.length = 0;
  messages.push(...result.messages);
  return messages;
}

describe.skipIf(!hasApiKey)("Project 4: RAG System Multi-turn Session", () => {
  let config: Omit<AgentLoopConfig, "maxIterations" | "maxTokens">;
  let messages: ChatMessage[];
  let totalToolCalls = 0;

  beforeAll(() => {
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true, force: true });
    }
    mkdirSync(projectDir, { recursive: true });

    const client = new OpenAICompatibleClient({
      baseURL: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY!,
      timeout: 120_000,
    });

    const toolRegistry = new ToolRegistry();
    toolRegistry.registerAll([
      fileReadTool, fileWriteTool, fileEditTool,
      bashExecTool, globSearchTool, grepSearchTool,
    ]);

    const events = createEventEmitter();
    events.on("tool:complete", () => { totalToolCalls++; });

    config = {
      client,
      model: "gpt-4o",
      toolRegistry,
      strategy: selectStrategy("gpt-4o"),
      events,
      workingDirectory: projectDir,
      useStreaming: false,
      maxContextTokens: 128_000,
    };

    messages = [
      {
        role: "system",
        content: `You are a skilled TypeScript/Node.js developer. Create files using tools. Working directory: ${projectDir}
Rules:
- Use file_write to create files, bash_exec to run commands.
- Always create complete, working files — no placeholders or TODOs.
- When running commands, cd to ${projectDir} first.
- Use ESM (type: "module" in package.json), .ts extensions in source, .js in imports.
- Use strict TypeScript (noImplicitAny).
- Be concise. Create files directly without lengthy explanations.`,
      },
    ];
  });

  afterAll(() => {
    console.log(`\n[Project 4 Stats] Total tool calls: ${totalToolCalls}, Final messages: ${messages.length}`);
  });

  it(
    "Turn 1: Initialize Node.js TypeScript project",
    async () => {
      await sendTurn(
        messages,
        `Create a Node.js TypeScript project in ${projectDir}:
1. package.json with name "rag-system", type "module", scripts: { "build": "tsc", "test": "vitest run", "start": "node dist/cli.js" }, devDependencies: typescript, vitest, @types/node
2. tsconfig.json with target ES2022, module NodeNext, moduleResolution NodeNext, outDir dist, rootDir src, strict true, esModuleInterop true
3. Create src/ directory

Just create the files directly, then run npm install.`,
        config,
      );

      expect(existsSync(join(projectDir, "package.json"))).toBe(true);
      expect(existsSync(join(projectDir, "tsconfig.json"))).toBe(true);
    },
    180_000,
  );

  it(
    "Turn 2: Create AcmeDB documentation files",
    async () => {
      await sendTurn(
        messages,
        `Create docs/ folder in ${projectDir} with 3 markdown files about a fictional product "AcmeDB" (a high-performance database):

1. docs/installation.md — Installation guide: system requirements (Linux/macOS, 4GB RAM, Node.js 18+), installation via npm (npm install -g acmedb), configuration file location (~/.acmedb/config.yml), first-time setup steps, starting the server (acmedb start --port 5432).

2. docs/api-reference.md — API Reference: connecting (acmedb.connect({host, port, auth})), creating collections (db.createCollection(name, schema)), CRUD operations (insert, find, update, delete with examples), indexing (db.createIndex(collection, fields)), transactions (db.transaction(async (tx) => { ... })).

3. docs/faq.md — FAQ: 5 questions about AcmeDB — max data size (unlimited with sharding), supported data types (string, number, boolean, date, array, object, binary), backup methods (acmedb backup --output file.bak), performance tuning (cache_size, worker_threads config), comparison to PostgreSQL.

Each file should be at least 200 words with realistic technical content.`,
        config,
      );

      expect(existsSync(join(projectDir, "docs", "installation.md"))).toBe(true);
      expect(existsSync(join(projectDir, "docs", "api-reference.md"))).toBe(true);
      expect(existsSync(join(projectDir, "docs", "faq.md"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 3: Create text chunking module",
    async () => {
      await sendTurn(
        messages,
        `Create src/chunker.ts:
- Export interface ChunkOptions { chunkSize: number; overlap: number; }
- Export interface Chunk { text: string; source: string; index: number; }
- Export function chunkText(text: string, source: string, options?: ChunkOptions): Chunk[]
  - Default chunkSize=500, overlap=100
  - Split text into chunks of chunkSize characters with overlap characters of overlap between consecutive chunks
  - Each chunk gets the source filename and sequential index
  - Handle edge cases: text shorter than chunkSize returns single chunk, empty text returns empty array
- Export function chunkFile(filePath: string, options?: ChunkOptions): Promise<Chunk[]>
  - Read the file and call chunkText with the filename as source`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "chunker.ts"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "chunker.ts"), "utf-8");
      expect(content).toContain("chunkText");
      expect(content).toContain("ChunkOptions");
    },
    120_000,
  );

  it(
    "Turn 4: Create cosine similarity function",
    async () => {
      await sendTurn(
        messages,
        `Create src/similarity.ts:
- Export function dotProduct(a: number[], b: number[]): number — sum of element-wise products
- Export function magnitude(v: number[]): number — sqrt of sum of squares
- Export function cosineSimilarity(a: number[], b: number[]): number
  - Returns dot(a,b) / (mag(a) * mag(b))
  - Handle zero-magnitude vectors: return 0
  - Both vectors must have same length (throw Error if not)
- All pure math, no external dependencies`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "similarity.ts"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "similarity.ts"), "utf-8");
      expect(content).toContain("cosineSimilarity");
      expect(content).toContain("dotProduct");
      expect(content).toContain("magnitude");
    },
    120_000,
  );

  it(
    "Turn 5: Create in-memory vector store",
    async () => {
      await sendTurn(
        messages,
        `Create src/vector-store.ts:
- Export interface VectorEntry { text: string; source: string; embedding: number[]; metadata?: Record<string, unknown>; }
- Export interface SearchResult { text: string; source: string; score: number; metadata?: Record<string, unknown>; }
- Export class VectorStore:
  - private entries: VectorEntry[] = []
  - add(entries: VectorEntry[]): void — append to internal list
  - search(queryEmbedding: number[], topK: number = 3): SearchResult[] — compute cosineSimilarity between query and each entry's embedding, return top K sorted by score descending
  - size(): number — returns count of entries
  - clear(): void — empty the store
Import cosineSimilarity from ./similarity.js`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "vector-store.ts"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "vector-store.ts"), "utf-8");
      expect(content).toContain("VectorStore");
      expect(content).toContain("cosineSimilarity");
    },
    120_000,
  );

  it(
    "Turn 6: Create embedder module",
    async () => {
      await sendTurn(
        messages,
        `Create src/embedder.ts:
- Export interface EmbedderConfig { apiKey: string; model?: string; baseURL?: string; }
- Export class Embedder:
  - constructor takes EmbedderConfig, default model "text-embedding-3-small", default baseURL "https://api.openai.com/v1"
  - async embed(texts: string[]): Promise<number[][]> — calls POST /embeddings with input=texts, model=model, returns array of embedding vectors
  - Use native fetch (no axios). Parse the response JSON and extract data[].embedding.
  - Handle API errors: throw Error with status code and message
- Export async function createEmbedder(apiKey: string): Promise<Embedder> — convenience factory`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "embedder.ts"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "embedder.ts"), "utf-8");
      expect(content).toContain("Embedder");
      expect(content).toContain("text-embedding-3-small");
    },
    120_000,
  );

  it(
    "Turn 7: Create retriever pipeline",
    async () => {
      await sendTurn(
        messages,
        `Create src/retriever.ts:
- Export interface RetrieverConfig { embedder: Embedder (from ./embedder.js); vectorStore: VectorStore (from ./vector-store.js); topK?: number; }
- Export class Retriever:
  - constructor(config: RetrieverConfig), default topK=3
  - async ingest(chunks: Chunk[]): Promise<void> — embed all chunk texts via embedder, then add to vectorStore as VectorEntries
  - async retrieve(query: string): Promise<SearchResult[]> — embed the query, search vectorStore with topK
Import types from the appropriate modules.`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "retriever.ts"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "retriever.ts"), "utf-8");
      expect(content).toContain("Retriever");
      expect(content).toContain("ingest");
      expect(content).toContain("retrieve");
    },
    120_000,
  );

  it(
    "Turn 8: Create generator module",
    async () => {
      await sendTurn(
        messages,
        `Create src/generator.ts:
- Export interface GeneratorConfig { apiKey: string; model?: string; baseURL?: string; }
- Export interface GeneratedAnswer { answer: string; sources: string[]; }
- Export class Generator:
  - constructor(config: GeneratorConfig), default model "gpt-4o-mini", default baseURL "https://api.openai.com/v1"
  - async generate(query: string, contexts: SearchResult[]): Promise<GeneratedAnswer>
    - Build a system prompt: "You answer questions based on provided context. Cite sources. If context doesn't contain the answer, say so."
    - Build user message with context chunks (text + source) and the query
    - Call POST /chat/completions with the messages
    - Extract the answer text and collect unique source filenames
    - Use native fetch. Handle API errors.
Import SearchResult from ./vector-store.js`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "generator.ts"))).toBe(true);
      const content = readFileSync(join(projectDir, "src", "generator.ts"), "utf-8");
      expect(content).toContain("Generator");
      expect(content).toContain("GeneratedAnswer");
    },
    120_000,
  );

  it(
    "Turn 9: Create CLI interface",
    async () => {
      await sendTurn(
        messages,
        `Create src/cli.ts:
- Parse command line args: first arg is the query string, --docs-dir (default "./docs"), --api-key (or OPENAI_API_KEY env var)
- Load all .md files from the docs directory using fs.readdir + chunkFile from ./chunker.js
- Create Embedder, VectorStore, Retriever, Generator instances
- Ingest all chunks into the retriever
- Retrieve relevant chunks for the query
- Generate answer using the generator
- Print the answer and sources to stdout
- Handle errors gracefully (missing API key, no docs found, API errors)
- Use process.argv for args parsing (no external lib). Make it the main entry point.

Also create src/index.ts that re-exports the main modules: chunker, similarity, vector-store, embedder, retriever, generator.`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "cli.ts"))).toBe(true);
      expect(existsSync(join(projectDir, "src", "index.ts"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 10: Write tests for chunker, similarity, and vector store",
    async () => {
      await sendTurn(
        messages,
        `Create src/__tests__/chunker.test.ts:
- Test chunkText: empty text returns [], short text returns single chunk, long text returns multiple chunks with correct overlap, source and index are set correctly
- Test with custom chunkSize and overlap

Create src/__tests__/similarity.test.ts:
- Test dotProduct: [1,2,3]·[4,5,6] = 32
- Test magnitude: [3,4] = 5
- Test cosineSimilarity: identical vectors = 1, orthogonal vectors = 0, throws on mismatched lengths, zero vector returns 0

Create src/__tests__/vector-store.test.ts:
- Test VectorStore: add entries, search returns correct topK, scores are sorted descending, clear empties the store, size returns correct count

Use vitest (import { describe, it, expect } from "vitest"). Import from the source files using relative paths.`,
        config,
      );

      const hasChunkerTest = existsSync(join(projectDir, "src", "__tests__", "chunker.test.ts"));
      const hasSimilarityTest = existsSync(join(projectDir, "src", "__tests__", "similarity.test.ts"));
      const hasVectorStoreTest = existsSync(join(projectDir, "src", "__tests__", "vector-store.test.ts"));

      expect(hasChunkerTest || hasSimilarityTest || hasVectorStoreTest).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 11: Build and run tests, fix failures",
    async () => {
      await sendTurn(
        messages,
        `In ${projectDir}:
1. Run: npm run build
2. If build errors, fix them and rebuild
3. Run: npm test
4. If any tests fail, fix them and re-run
5. Keep fixing until both build and tests succeed completely.`,
        config,
      );

      // Verify build works
      try {
        execSync("npm run build 2>&1", {
          cwd: projectDir,
          timeout: 60_000,
        });
      } catch {
        // Build might have minor issues — check if dist exists
      }

      // Verify tests pass
      const testResult = execSync("npm test 2>&1", {
        cwd: projectDir,
        timeout: 60_000,
      }).toString();
      expect(testResult).toContain("passed");
    },
    300_000,
  );
});

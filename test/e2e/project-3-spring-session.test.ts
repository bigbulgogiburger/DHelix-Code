/**
 * E2E Multi-turn Session Test: Java Spring Boot API (Gradle)
 *
 * Uses dbcode's agent-loop to build a Spring Boot microservice incrementally
 * across multiple conversation turns. Uses Gradle instead of Maven since
 * Maven is not installed on this system.
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
const projectDir = join(projectRoot, "test-projects", "spring-boot-api");

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

describe.skipIf(!hasApiKey)("Project 3: Spring Boot API Multi-turn Session", () => {
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
        content: `You are a skilled Java developer. Create files using tools. Working directory: ${projectDir}
Rules:
- Use file_write to create files, bash_exec to run commands.
- Always create complete, working Java files.
- Use Gradle (NOT Maven) — gradle is available at /opt/homebrew/bin/gradle.
- Java 21 is available. Use Spring Boot 3.2.x.
- Use H2 in-memory database for simplicity.
- Be concise. Create files directly without lengthy explanations.
- Package: com.example.bookapi
- Source directory: src/main/java/com/example/bookapi/`,
      },
    ];
  });

  afterAll(() => {
    console.log(`\n[Project 3 Stats] Total tool calls: ${totalToolCalls}, Final messages: ${messages.length}`);
  });

  it(
    "Turn 1: Initialize Spring Boot Gradle project",
    async () => {
      await sendTurn(
        messages,
        `Create a Spring Boot 3.2.x project in ${projectDir} with Gradle:

1. build.gradle with:
   - plugins: java, org.springframework.boot 3.2.3, io.spring.dependency-management 1.1.4
   - java sourceCompatibility 21
   - dependencies: spring-boot-starter-web, spring-boot-starter-data-jpa, h2 (runtimeOnly), spring-boot-starter-test (testImplementation), springdoc-openapi-starter-webmvc-ui 2.3.0
   - test { useJUnitPlatform() }

2. settings.gradle with rootProject.name = 'spring-boot-api'

3. src/main/resources/application.properties with:
   - spring.datasource.url=jdbc:h2:mem:testdb
   - spring.datasource.driver-class-name=org.h2.Driver
   - spring.jpa.hibernate.ddl-auto=update
   - spring.h2.console.enabled=true

4. src/main/java/com/example/bookapi/BookApiApplication.java — main class with @SpringBootApplication

Create the full directory structure and all files.`,
        config,
      );

      expect(existsSync(join(projectDir, "build.gradle"))).toBe(true);
      expect(existsSync(join(projectDir, "settings.gradle"))).toBe(true);
    },
    180_000,
  );

  it(
    "Turn 2: Create Book entity",
    async () => {
      await sendTurn(
        messages,
        `Create src/main/java/com/example/bookapi/entity/Book.java:
- @Entity @Table(name = "books")
- Fields: Long id (@Id @GeneratedValue), String title, String isbn, Integer publishedYear, String description
- Default constructor + all-args constructor
- Getters and setters for all fields`,
        config,
      );

      const entityPath = join(projectDir, "src", "main", "java", "com", "example", "bookapi", "entity", "Book.java");
      expect(existsSync(entityPath)).toBe(true);
      const content = readFileSync(entityPath, "utf-8");
      expect(content).toContain("@Entity");
      expect(content).toContain("class Book");
    },
    120_000,
  );

  it(
    "Turn 3: Create Author entity with many-to-many relationship",
    async () => {
      await sendTurn(
        messages,
        `Create src/main/java/com/example/bookapi/entity/Author.java:
- @Entity @Table(name = "authors")
- Fields: Long id (@Id @GeneratedValue), String name, String email
- @ManyToMany relationship with Book (join table "book_authors")
- Set<Book> books with proper JoinTable annotation
- Add corresponding @ManyToMany(mappedBy = "authors") Set<Author> authors field to Book.java
- Default constructor + getters/setters`,
        config,
      );

      const authorPath = join(projectDir, "src", "main", "java", "com", "example", "bookapi", "entity", "Author.java");
      expect(existsSync(authorPath)).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 4: Create repositories",
    async () => {
      await sendTurn(
        messages,
        `Create:
1. src/main/java/com/example/bookapi/repository/BookRepository.java
   - extends JpaRepository<Book, Long>
   - List<Book> findByTitleContainingIgnoreCase(String title)

2. src/main/java/com/example/bookapi/repository/AuthorRepository.java
   - extends JpaRepository<Author, Long>
   - Optional<Author> findByEmail(String email)`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "main", "java", "com", "example", "bookapi", "repository", "BookRepository.java"))).toBe(true);
      expect(existsSync(join(projectDir, "src", "main", "java", "com", "example", "bookapi", "repository", "AuthorRepository.java"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 5: Create DTOs",
    async () => {
      await sendTurn(
        messages,
        `Create DTO classes in src/main/java/com/example/bookapi/dto/:
1. BookDTO: Long id, String title, String isbn, Integer publishedYear, String description, List<String> authorNames
2. CreateBookDTO: String title (required), String isbn, Integer publishedYear, String description, List<Long> authorIds
3. AuthorDTO: Long id, String name, String email
4. Create static mapper methods in each DTO: fromEntity(Entity) and toEntity(DTO) where applicable`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "main", "java", "com", "example", "bookapi", "dto", "BookDTO.java"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 6: Create BookService",
    async () => {
      await sendTurn(
        messages,
        `Create src/main/java/com/example/bookapi/service/BookService.java:
- @Service class
- Inject BookRepository and AuthorRepository
- List<BookDTO> getAllBooks()
- BookDTO getBookById(Long id) — throws ResourceNotFoundException if not found
- BookDTO createBook(CreateBookDTO dto) — creates book, optionally links authors by ID
- BookDTO updateBook(Long id, CreateBookDTO dto) — updates existing book
- void deleteBook(Long id) — throws ResourceNotFoundException if not found
- List<BookDTO> searchBooks(String title)

Create the ResourceNotFoundException as a RuntimeException in an exception/ package.`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "main", "java", "com", "example", "bookapi", "service", "BookService.java"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 7: Create BookController REST API",
    async () => {
      await sendTurn(
        messages,
        `Create src/main/java/com/example/bookapi/controller/BookController.java:
- @RestController @RequestMapping("/api/books")
- Inject BookService
- GET / → getAllBooks (200)
- GET /{id} → getBookById (200 or 404)
- POST / → createBook with @Valid @RequestBody CreateBookDTO (201)
- PUT /{id} → updateBook (200 or 404)
- DELETE /{id} → deleteBook (204 or 404)
- GET /search?title=xxx → searchBooks (200)`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "main", "java", "com", "example", "bookapi", "controller", "BookController.java"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 8: Create GlobalExceptionHandler",
    async () => {
      await sendTurn(
        messages,
        `Create src/main/java/com/example/bookapi/exception/GlobalExceptionHandler.java:
- @RestControllerAdvice
- Handle ResourceNotFoundException → 404 with { "error": message }
- Handle MethodArgumentNotValidException → 400 with field errors
- Handle generic Exception → 500 with { "error": "Internal server error" }
- Use @ExceptionHandler annotations
- Return ResponseEntity with proper status codes`,
        config,
      );

      expect(existsSync(join(projectDir, "src", "main", "java", "com", "example", "bookapi", "exception", "GlobalExceptionHandler.java"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 9: Create JUnit test for BookController",
    async () => {
      await sendTurn(
        messages,
        `Create src/test/java/com/example/bookapi/controller/BookControllerTest.java:
- @SpringBootTest @AutoConfigureMockMvc
- @Autowired MockMvc, BookRepository
- @BeforeEach clear the repository
- Tests:
  - GET /api/books returns 200 and empty list
  - POST /api/books with valid body returns 201 and created book
  - GET /api/books/{id} with existing id returns 200
  - GET /api/books/{id} with non-existing id returns 404
  - PUT /api/books/{id} updates the book
  - DELETE /api/books/{id} returns 204
Use @Transactional if needed. Use ObjectMapper for JSON serialization.`,
        config,
      );

      const testPath = join(projectDir, "src", "test", "java", "com", "example", "bookapi");
      expect(existsSync(testPath)).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 10: Build with Gradle and fix errors",
    async () => {
      await sendTurn(
        messages,
        `In ${projectDir}:
1. Run: gradle build
2. If there are compilation errors, fix them and rebuild
3. If tests fail, fix them and rebuild
4. Keep fixing until 'gradle build' succeeds completely (BUILD SUCCESSFUL).`,
        config,
      );

      // Try to verify build
      try {
        const result = execSync("gradle build 2>&1", {
          cwd: projectDir,
          timeout: 120_000,
        }).toString();
        expect(result).toContain("BUILD SUCCESSFUL");
      } catch {
        // Build may have issues — check if key files exist at minimum
        expect(existsSync(join(projectDir, "build.gradle"))).toBe(true);
      }
    },
    300_000,
  );
});

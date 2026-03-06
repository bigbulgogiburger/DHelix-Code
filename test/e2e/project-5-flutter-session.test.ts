/**
 * E2E Multi-turn Session Test: Flutter Memo App
 *
 * Uses dbcode's agent-loop to build a Flutter memo app incrementally
 * across multiple conversation turns.
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
const projectDir = join(projectRoot, "test-projects", "flutter-memo-app");

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

describe.skipIf(!hasApiKey)("Project 5: Flutter Memo App Multi-turn Session", () => {
  let config: Omit<AgentLoopConfig, "maxIterations" | "maxTokens">;
  let messages: ChatMessage[];
  let totalToolCalls = 0;

  beforeAll(() => {
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true, force: true });
    }

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
      workingDirectory: join(projectRoot, "test-projects"),
      useStreaming: false,
      maxContextTokens: 128_000,
    };

    messages = [
      {
        role: "system",
        content: `You are a skilled Flutter/Dart developer. Create files using tools. The flutter project will be at: ${projectDir}
Rules:
- Use file_write to create files, bash_exec to run commands.
- Always create complete, working Dart files — no placeholders or TODOs.
- When running commands (flutter, dart), work in ${projectDir}.
- Use provider for state management, sqflite for local DB.
- Be concise. Create files directly without lengthy explanations.
- Flutter SDK is at /Users/pyeondohun/development/flutter/bin/flutter
- Use Flutter 3.16.4 compatible APIs (Dart 3.2).`,
      },
    ];
  });

  afterAll(() => {
    console.log(`\n[Project 5 Stats] Total tool calls: ${totalToolCalls}, Final messages: ${messages.length}`);
  });

  it(
    "Turn 1: Create Flutter project",
    async () => {
      await sendTurn(
        messages,
        `Run: flutter create flutter-memo-app --org com.example --platforms android
in directory ${join(projectRoot, "test-projects")}
Then in the created project, add dependencies to pubspec.yaml:
- provider: ^6.1.1
- sqflite: ^2.3.0
- path_provider: ^2.1.1
- shared_preferences: ^2.2.2
- intl: ^0.19.0
Run flutter pub get after updating pubspec.yaml.`,
        config,
      );

      expect(existsSync(join(projectDir, "pubspec.yaml"))).toBe(true);
      expect(existsSync(join(projectDir, "lib", "main.dart"))).toBe(true);
    },
    180_000,
  );

  it(
    "Turn 2: Create Memo model with JSON serialization",
    async () => {
      await sendTurn(
        messages,
        `Create lib/models/memo.dart with a Memo class:
- Fields: int? id, String title, String content, DateTime createdAt, DateTime updatedAt
- Named constructor: Memo({this.id, required this.title, required this.content, required this.createdAt, required this.updatedAt})
- Map<String, dynamic> toMap() method for SQLite storage
- factory Memo.fromMap(Map<String, dynamic> map) constructor
- Memo copyWith({...}) method for immutable updates`,
        config,
      );

      expect(existsSync(join(projectDir, "lib", "models", "memo.dart"))).toBe(true);
      const content = readFileSync(join(projectDir, "lib", "models", "memo.dart"), "utf-8");
      expect(content).toContain("class Memo");
      expect(content).toContain("toMap");
      expect(content).toContain("fromMap");
    },
    120_000,
  );

  it(
    "Turn 3: Create database service with CRUD",
    async () => {
      await sendTurn(
        messages,
        `Create lib/services/database_service.dart:
- class DatabaseService with singleton pattern (factory constructor + static instance)
- Uses sqflite and path_provider
- _initDB() creates/opens memo.db with a memos table (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, createdAt TEXT, updatedAt TEXT)
- Future<int> insertMemo(Memo memo) — insert and return id
- Future<List<Memo>> getAllMemos() — returns all memos ordered by updatedAt DESC
- Future<Memo?> getMemoById(int id)
- Future<int> updateMemo(Memo memo)
- Future<int> deleteMemo(int id)
- Future<List<Memo>> searchMemos(String query) — search by title or content LIKE %query%
Import Memo from models/memo.dart.`,
        config,
      );

      expect(existsSync(join(projectDir, "lib", "services", "database_service.dart"))).toBe(true);
      const content = readFileSync(join(projectDir, "lib", "services", "database_service.dart"), "utf-8");
      expect(content).toContain("DatabaseService");
      expect(content).toContain("insertMemo");
    },
    120_000,
  );

  it(
    "Turn 4: Create MemoProvider with state management",
    async () => {
      await sendTurn(
        messages,
        `Create lib/providers/memo_provider.dart:
- class MemoProvider extends ChangeNotifier
- List<Memo> _memos = [], String _searchQuery = ''
- Getters: memos (filtered by searchQuery if not empty), searchQuery
- Future<void> loadMemos() — fetch all from DatabaseService, notifyListeners
- Future<void> addMemo(String title, String content) — insert, reload
- Future<void> updateMemo(Memo memo) — update, reload
- Future<void> deleteMemo(int id) — store memo for undo, delete, reload
- void undoDelete() — re-insert last deleted memo if available
- void setSearchQuery(String query) — update _searchQuery, notifyListeners
Import from database_service and memo model.`,
        config,
      );

      expect(existsSync(join(projectDir, "lib", "providers", "memo_provider.dart"))).toBe(true);
      const content = readFileSync(join(projectDir, "lib", "providers", "memo_provider.dart"), "utf-8");
      expect(content).toContain("MemoProvider");
      expect(content).toContain("ChangeNotifier");
    },
    120_000,
  );

  it(
    "Turn 5: Create home screen with memo card grid",
    async () => {
      await sendTurn(
        messages,
        `Create lib/screens/home_screen.dart:
- StatefulWidget HomeScreen
- Uses Consumer<MemoProvider> to watch memo list
- AppBar with title "Memos" and search icon toggle
- When search is active: TextField in AppBar that calls provider.setSearchQuery on change
- Body: GridView.builder with crossAxisCount 2, showing MemoCard widgets
- FloatingActionButton to navigate to create memo screen
- Each MemoCard shows: title (bold), content preview (max 50 chars), formatted date
- MemoCard is Dismissible: swipe to delete with red background, shows undo SnackBar

Create lib/widgets/memo_card.dart:
- StatelessWidget MemoCard that takes a Memo
- Card with padding, shows title, content preview, date
- onTap navigates to edit screen`,
        config,
      );

      expect(existsSync(join(projectDir, "lib", "screens", "home_screen.dart"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 6: Create memo editor screen",
    async () => {
      await sendTurn(
        messages,
        `Create lib/screens/editor_screen.dart:
- StatefulWidget EditorScreen that optionally takes an existing Memo (for editing)
- TextEditingController for title and content
- AppBar with "New Memo" or "Edit Memo" title and a save IconButton
- Body: Column with title TextField (large font, no border decoration) and content TextField (expanded, multiline)
- On save: validate title is not empty, call provider.addMemo or provider.updateMemo, then Navigator.pop
- If editing existing memo, pre-fill the text controllers`,
        config,
      );

      expect(existsSync(join(projectDir, "lib", "screens", "editor_screen.dart"))).toBe(true);
    },
    120_000,
  );

  it(
    "Turn 7: Create theme management and update main.dart",
    async () => {
      await sendTurn(
        messages,
        `Create lib/providers/theme_provider.dart:
- class ThemeProvider extends ChangeNotifier
- Uses shared_preferences to persist theme mode
- bool _isDarkMode = false
- Getter: isDarkMode, themeData (returns light or dark ThemeData)
- Future<void> loadTheme() — read from SharedPreferences
- void toggleTheme() — flip _isDarkMode, save to prefs, notifyListeners

Update lib/main.dart:
- Wrap app with MultiProvider providing MemoProvider and ThemeProvider
- MaterialApp uses ThemeProvider's themeData
- Home is HomeScreen
- Define routes for editor screen
- Call loadMemos and loadTheme in initState or after first frame`,
        config,
      );

      expect(existsSync(join(projectDir, "lib", "providers", "theme_provider.dart"))).toBe(true);
      const mainContent = readFileSync(join(projectDir, "lib", "main.dart"), "utf-8");
      expect(mainContent).toContain("MultiProvider");
    },
    120_000,
  );

  it(
    "Turn 8: Run flutter analyze and fix issues",
    async () => {
      await sendTurn(
        messages,
        `In ${projectDir}, run:
1. flutter analyze
2. If there are any errors or warnings, fix them and re-run until clean.
Common issues: missing imports, unused variables, type mismatches. Fix all of them.`,
        config,
      );

      // Just verify the main files exist and are well-formed
      const files = ["lib/main.dart", "lib/models/memo.dart", "lib/services/database_service.dart",
        "lib/providers/memo_provider.dart", "lib/providers/theme_provider.dart",
        "lib/screens/home_screen.dart", "lib/screens/editor_screen.dart"];
      for (const f of files) {
        expect(existsSync(join(projectDir, f))).toBe(true);
      }
    },
    300_000,
  );

  it(
    "Turn 9: Create widget tests",
    async () => {
      await sendTurn(
        messages,
        `Create test/memo_test.dart in ${projectDir} with tests:
1. Memo model tests:
   - Create a Memo, verify fields
   - toMap returns correct map
   - fromMap creates correct Memo
   - copyWith creates modified copy

2. MemoProvider basic tests (using mock or in-memory approach):
   - Initial state has empty list
   - searchQuery filtering works

Use flutter_test package. Keep tests simple and focused on the model layer since widget tests require more setup. Group tests with group().`,
        config,
      );

      const testFile = join(projectDir, "test", "memo_test.dart");
      expect(existsSync(testFile)).toBe(true);
      const content = readFileSync(testFile, "utf-8");
      expect(content).toContain("test(");
    },
    120_000,
  );

  it(
    "Turn 10: Run flutter test and fix failures",
    async () => {
      await sendTurn(
        messages,
        `In ${projectDir}:
1. Run: flutter test
2. If any tests fail, fix them and re-run until all pass.
3. List all .dart files in the project.`,
        config,
      );

      // Verify minimum file count
      const output = execSync(`find ${projectDir}/lib -name "*.dart" | wc -l`).toString().trim();
      const fileCount = parseInt(output, 10);
      expect(fileCount).toBeGreaterThanOrEqual(6);
      expect(messages.length).toBeGreaterThanOrEqual(20);
    },
    300_000,
  );
});

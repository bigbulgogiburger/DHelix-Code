import { describe, it, expect } from "vitest";
import { parseNaturalLanguageIntent } from "../../../src/llm/strategies/two-stage-tool-call.js";
import { type ToolDefinition } from "../../../src/tools/types.js";
import { z } from "zod";

/** Create a minimal tool definition for testing */
function makeTool(name: string): ToolDefinition {
  return {
    name,
    description: `Tool: ${name}`,
    parameterSchema: z.object({}),
    permissionLevel: "safe",
    execute: async () => ({ output: "", isError: false }),
  };
}

const availableTools: readonly ToolDefinition[] = [
  makeTool("file_read"),
  makeTool("grep_search"),
  makeTool("file_write"),
  makeTool("bash_exec"),
  makeTool("list_dir"),
  makeTool("file_edit"),
  makeTool("glob_search"),
];

describe("parseNaturalLanguageIntent", () => {
  it("should parse 'read file X' as file_read", () => {
    const result = parseNaturalLanguageIntent("read file src/index.ts", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("file_read");
    expect(result!.extractedArgs).toEqual({ file_path: "src/index.ts" });
    expect(result!.confidence).toBe(0.9);
  });

  it("should parse 'read X' without 'file' keyword", () => {
    const result = parseNaturalLanguageIntent("read package.json", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("file_read");
    expect(result!.extractedArgs).toEqual({ file_path: "package.json" });
  });

  it("should parse 'search for pattern' as grep_search", () => {
    const result = parseNaturalLanguageIntent("search for TODO", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("grep_search");
    expect(result!.extractedArgs).toEqual({ pattern: "TODO" });
  });

  it("should parse 'search pattern' without 'for' keyword", () => {
    const result = parseNaturalLanguageIntent("search handleError", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("grep_search");
    expect(result!.extractedArgs).toEqual({ pattern: "handleError" });
  });

  it("should parse 'run ls -la' as bash_exec", () => {
    const result = parseNaturalLanguageIntent("run ls -la", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("bash_exec");
    expect(result!.extractedArgs).toEqual({ command: "ls -la" });
  });

  it("should parse 'list files in src' as list_dir", () => {
    const result = parseNaturalLanguageIntent("list files in src", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("list_dir");
    expect(result!.extractedArgs).toEqual({ path: "src" });
  });

  it("should parse 'edit X' as file_edit", () => {
    const result = parseNaturalLanguageIntent("edit src/main.ts", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("file_edit");
    expect(result!.extractedArgs).toEqual({ file_path: "src/main.ts" });
  });

  it("should parse 'write to X' as file_write", () => {
    const result = parseNaturalLanguageIntent("write to output.txt", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("file_write");
    expect(result!.extractedArgs).toEqual({ file_path: "output.txt" });
  });

  it("should parse 'find files X' as glob_search", () => {
    const result = parseNaturalLanguageIntent("find files *.ts", availableTools);

    expect(result).not.toBeNull();
    expect(result!.toolName).toBe("glob_search");
    expect(result!.extractedArgs).toEqual({ pattern: "*.ts" });
  });

  it("should return null for unknown intent", () => {
    const result = parseNaturalLanguageIntent("hello world", availableTools);
    expect(result).toBeNull();
  });

  it("should return null when matched tool is not available", () => {
    const limitedTools = [makeTool("some_other_tool")];
    const result = parseNaturalLanguageIntent("read file src/index.ts", limitedTools);
    expect(result).toBeNull();
  });

  it("should trim whitespace from extracted arguments", () => {
    const result = parseNaturalLanguageIntent("read   src/index.ts  ", availableTools);

    expect(result).not.toBeNull();
    expect(result!.extractedArgs.file_path).toBe("src/index.ts");
  });

  it("should include required params matching extracted args keys", () => {
    const result = parseNaturalLanguageIntent("run npm test", availableTools);

    expect(result).not.toBeNull();
    expect(result!.requiredParams).toEqual(["command"]);
  });
});

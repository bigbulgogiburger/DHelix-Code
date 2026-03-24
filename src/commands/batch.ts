/**
 * /batch 명령어 핸들러 — 여러 파일에 동일한 작업을 일괄 적용
 *
 * 사용자가 /batch를 입력하면 glob 패턴(파일 검색 패턴)에 매칭되는
 * 모든 파일에 동일한 작업을 수행하도록 LLM에게 구조화된 프롬프트를 전달합니다.
 *
 * 예시: /batch src/**\/*.ts add JSDoc comments
 *       → src 하위 모든 .ts 파일에 JSDoc 주석을 추가
 *
 * glob 패턴이란? 파일 경로를 와일드카드(**)로 매칭하는 패턴입니다.
 * 예: *.ts = 모든 .ts 파일, **\/*.ts = 모든 하위 디렉토리의 .ts 파일
 */
import { type SlashCommand } from "./registry.js";

export const batchCommand: SlashCommand = {
  name: "batch",
  description: "Apply same operation to multiple files",
  usage: "/batch <glob pattern> <operation description>",
  execute: async (args, _context) => {
    const trimmed = args.trim();
    if (!trimmed) {
      return {
        output:
          "Usage: /batch <glob pattern> <operation description>\nExample: /batch src/**/*.ts add error handling to all exported functions",
        success: false,
      };
    }

    // Split into pattern and operation
    const parts = trimmed.split(/\s+/);
    const pattern = parts[0];
    const operation = parts.slice(1).join(" ");

    if (!operation) {
      return {
        output:
          "Please provide both a glob pattern and an operation description.\nExample: /batch src/**/*.ts add JSDoc comments",
        success: false,
      };
    }

    const prompt = [
      `Apply the following operation to all files matching \`${pattern}\`:`,
      "",
      `**Operation**: ${operation}`,
      "",
      "Steps:",
      `1. Use glob_search to find all files matching \`${pattern}\``,
      "2. For each file, read it and apply the operation",
      "3. Use file_edit to make the changes",
      "4. Report a summary of all changes made",
      "",
      "Process files one at a time and report progress.",
    ].join("\n");

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
    };
  },
};

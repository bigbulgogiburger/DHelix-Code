/**
 * /review 명령어 핸들러 — 코드 변경 사항 리뷰 (버그, 보안, 품질)
 *
 * 사용자가 /review를 입력하면 git diff를 수집하여 LLM에게
 * 체계적인 코드 리뷰를 요청하는 프롬프트를 주입합니다.
 *
 * 리뷰 항목:
 *   1. 버그 — 로직 에러, null/undefined 위험, 경계값 에러, 경쟁 조건
 *   2. 보안 — 인젝션 취약점, 노출된 비밀, 안전하지 않은 작업
 *   3. 코드 품질 — 가독성, 네이밍, 중복, 에러 처리 누락
 *   4. 에러 처리 — 처리되지 않은 예외, 누락된 엣지 케이스
 *
 * 각 이슈는 CRITICAL/HIGH/MEDIUM/LOW 심각도와 수정 제안과 함께 보고됩니다.
 *
 * 사용 예시:
 *   /review            → 모든 변경 사항 리뷰
 *   /review --staged   → 스테이징된 변경만 리뷰
 *   /review src/app.ts → 특정 파일만 리뷰
 *
 * 사용 시점: 커밋 전에 코드 품질과 보안을 점검하고 싶을 때
 */
import { execSync } from "node:child_process";
import { type SlashCommand } from "./registry.js";

/** diff 크기가 이 값(바이트)을 초과하면 잘라냄 — 너무 큰 diff는 LLM 컨텍스트를 낭비 */
const MAX_DIFF_SIZE = 50 * 1024;

/**
 * git 명령어를 실행하고 stdout을 반환하는 헬퍼 함수
 *
 * 실패 시 빈 문자열을 반환하여 안전하게 처리합니다.
 *
 * @param cmd - 실행할 git 명령어
 * @param cwd - 작업 디렉토리
 * @returns 명령어 출력 (실패 시 빈 문자열)
 */
function gitExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

/**
 * /review 슬래시 명령어 정의 — 코드 변경 리뷰
 *
 * git diff를 수집하고 리뷰 프롬프트를 생성하여
 * shouldInjectAsUserMessage로 LLM에게 전달합니다.
 * 대용량 diff는 MAX_DIFF_SIZE로 잘라 컨텍스트를 보호합니다.
 */
export const reviewCommand: SlashCommand = {
  name: "review",
  description: "Review current code changes for bugs, security, and quality",
  usage: "/review [--staged] [file path]",
  execute: async (args, context) => {
    const cwd = context.workingDirectory;

    // Verify git repository
    try {
      execSync("git rev-parse --git-dir", { cwd, encoding: "utf-8", stdio: "pipe" });
    } catch {
      return { output: "Not a git repository. /review requires git.", success: false };
    }

    // Parse arguments
    const parts = args.trim().split(/\s+/).filter(Boolean);
    const stagedOnly = parts.includes("--staged");
    const filePath = parts.find((p) => p !== "--staged") || "";

    // Build git diff commands
    const pathArg = filePath ? ` -- ${JSON.stringify(filePath)}` : "";
    let diff = "";

    if (stagedOnly) {
      diff = gitExec(`git diff --cached${pathArg}`, cwd);
    } else {
      const unstaged = gitExec(`git diff${pathArg}`, cwd);
      const staged = gitExec(`git diff --cached${pathArg}`, cwd);

      if (staged && unstaged) {
        diff = `=== Staged Changes ===\n${staged}\n\n=== Unstaged Changes ===\n${unstaged}`;
      } else {
        diff = staged || unstaged;
      }
    }

    if (!diff) {
      return { output: "No changes to review.", success: false };
    }

    // Truncate large diffs
    let truncated = false;
    if (Buffer.byteLength(diff, "utf-8") > MAX_DIFF_SIZE) {
      diff = diff.slice(0, MAX_DIFF_SIZE);
      truncated = true;
    }

    const prompt = [
      "Review the following code changes. Analyze for:",
      "",
      "1. **Bugs**: Logic errors, null/undefined risks, off-by-one errors, race conditions",
      "2. **Security**: Injection vulnerabilities, exposed secrets, unsafe operations",
      "3. **Code Quality**: Readability, naming, duplication, missing error handling",
      "4. **Error Handling**: Unhandled exceptions, missing edge cases",
      "",
      "For each issue found, provide:",
      "- **Severity**: CRITICAL / HIGH / MEDIUM / LOW",
      "- **File and location**",
      "- **Description** of the issue",
      "- **Suggested fix**",
      "",
      "If no issues are found, confirm the changes look good.",
      "",
      truncated
        ? "**Note**: The diff was truncated due to size. Focus on the available changes.\n"
        : "",
      "```diff",
      diff,
      "```",
    ].join("\n");

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
    };
  },
};

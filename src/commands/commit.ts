/**
 * /commit 명령어 핸들러 — 스테이징된 변경 사항을 자동 커밋 메시지와 함께 커밋
 *
 * 사용자가 /commit을 입력하면:
 * 1. git 저장소 여부를 확인
 * 2. 스테이징된(git add된) 파일들의 diff를 분석
 * 3. 변경 파일의 패턴을 분석하여 커밋 타입(feat/fix/test/docs)과 스코프를 자동 감지
 * 4. 최근 커밋 히스토리를 참조하여 프로젝트의 커밋 스타일을 따르는 메시지 제안
 * 5. LLM에게 최종 커밋 메시지를 생성하고 실행하도록 프롬프트를 주입
 *
 * 사용 시점: 코드 변경 후 의미 있는 커밋 메시지를 자동 생성하고 싶을 때
 *
 * Conventional Commits란? "type(scope): description" 형식의 커밋 메시지 규칙
 * 예: feat(auth): add login validation
 */
import { execSync } from "node:child_process";
import { type SlashCommand } from "./registry.js";

/**
 * git 명령어를 실행하고 결과를 반환하는 헬퍼 함수
 *
 * 실패 시 빈 문자열을 반환하여 호출자가 안전하게 처리할 수 있도록 합니다.
 *
 * @param cmd - 실행할 git 명령어 (예: "git diff --cached --name-status")
 * @param cwd - 명령어를 실행할 작업 디렉토리
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
 * 변경된 파일 경로로부터 커밋 타입을 자동 감지하는 함수
 *
 * 파일명에 "test"/"spec"이 절반 이상 → "test"
 * 파일명에 "docs/"나 ".md"가 절반 이상 → "docs"
 * "A"(Added) 상태 파일이 절반 이상 → "feat" (새 기능)
 * 그 외 → "fix" (버그 수정)
 *
 * @param files - 변경된 파일 목록 (git diff --name-status 형식)
 * @returns 커밋 타입 문자열 ("feat", "fix", "test", "docs")
 */
function detectCommitType(files: readonly string[]): string {
  const testFiles = files.filter((f) => f.includes("test") || f.includes("spec"));
  if (testFiles.length > files.length / 2) return "test";

  const docFiles = files.filter((f) => f.includes("docs/") || f.endsWith(".md"));
  if (docFiles.length > files.length / 2) return "docs";

  const newFiles = files.filter((f) => f.startsWith("A"));
  if (newFiles.length > files.length / 2) return "feat";

  return "fix";
}

/**
 * 변경된 파일들에서 가장 많이 등장하는 디렉토리를 스코프로 추출하는 함수
 *
 * src/ 하위에 있으면 두 번째 레벨 디렉토리(예: src/commands → "commands"),
 * 그 외에는 첫 번째 레벨 디렉토리를 스코프로 사용합니다.
 *
 * @param files - 변경된 파일 목록
 * @returns 가장 빈번한 디렉토리명 (없으면 빈 문자열)
 */
function extractScope(files: readonly string[]): string {
  const dirs = new Map<string, number>();
  for (const file of files) {
    // file format from --name-status: "M\tsrc/commands/foo.ts" or just path
    const path = file.includes("\t") ? file.split("\t")[1] : file;
    if (!path) continue;
    const parts = path.split("/");
    // Use second-level dir if under src/, otherwise first dir
    const scope =
      parts[0] === "src" && parts.length > 2 ? parts[1] : parts.length > 1 ? parts[0] : "";
    if (scope) {
      dirs.set(scope, (dirs.get(scope) ?? 0) + 1);
    }
  }
  if (dirs.size === 0) return "";

  let maxDir = "";
  let maxCount = 0;
  for (const [dir, count] of dirs) {
    if (count > maxCount) {
      maxDir = dir;
      maxCount = count;
    }
  }
  return maxDir;
}

/**
 * /commit 슬래시 명령어 정의 — 스테이징된 변경 사항 분석 및 커밋 메시지 제안
 *
 * LLM 에이전트에게 diff 컨텍스트와 커밋 규칙을 전달하여
 * 커밋 메시지를 생성하고 실행하도록 합니다.
 * shouldInjectAsUserMessage: true로 설정하여 프롬프트가
 * 사용자 메시지로 주입되어 에이전트가 처리하게 됩니다.
 */
export const commitCommand: SlashCommand = {
  name: "commit",
  description: "Commit staged changes with an auto-generated message",
  usage: "/commit [message hint]",
  execute: async (args, context) => {
    const cwd = context.workingDirectory;

    // Verify git repository
    try {
      execSync("git rev-parse --git-dir", { cwd, encoding: "utf-8", stdio: "pipe" });
    } catch {
      return { output: "Not a git repository. /commit requires git.", success: false };
    }

    // Check for staged changes
    const stagedFiles = gitExec("git diff --cached --name-status", cwd);
    if (!stagedFiles) {
      return {
        output: [
          "No staged changes to commit.",
          "",
          "Stage your changes first:",
          "  git add <file>       — stage specific files",
          "  git add -p           — stage interactively",
        ].join("\n"),
        success: false,
      };
    }

    // Gather context
    const diffStat = gitExec("git diff --cached --stat", cwd);
    const recentLog = gitExec("git log --oneline -5", cwd);

    // Analyze files for commit type and scope
    const fileLines = stagedFiles.split("\n").filter(Boolean);
    const type = detectCommitType(fileLines);
    const scope = extractScope(fileLines);
    const scopePart = scope ? `(${scope})` : "";

    // Build a suggested message
    const fileCount = fileLines.length;
    const fileSummary = fileLines
      .slice(0, 5)
      .map((f) => {
        const parts = f.split("\t");
        return parts.length > 1 ? parts[1] : f;
      })
      .join(", ");
    const extraFiles = fileCount > 5 ? ` and ${fileCount - 5} more` : "";
    const description = `update ${fileSummary}${extraFiles}`;
    const suggestedMessage = `${type}${scopePart}: ${description}`;

    // User hint overrides auto-generated message
    const hint = args.trim();

    const prompt = [
      "I want to commit the currently staged changes. Here is the context:",
      "",
      "## Staged Changes (stat)",
      "```",
      diffStat,
      "```",
      "",
      "## Changed Files",
      "```",
      stagedFiles,
      "```",
      "",
      "## Recent Commits (for style reference)",
      "```",
      recentLog || "(no commits yet)",
      "```",
      "",
      "## Auto-detected",
      `- Type: ${type}`,
      `- Scope: ${scope || "(none)"}`,
      `- Suggested message: \`${suggestedMessage}\``,
      hint ? `- User hint: "${hint}"` : "",
      "",
      "## Instructions",
      "1. Review the staged diff with `git diff --cached`",
      "2. Analyze the changes and craft an appropriate conventional commit message",
      "3. Follow the style of recent commits shown above",
      hint
        ? `4. Incorporate the user's hint: "${hint}"`
        : "4. Use or improve the auto-detected suggestion above",
      "5. Execute `git commit -m '<message>'` with the final message",
      "6. Report the result",
    ].join("\n");

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
    };
  },
};

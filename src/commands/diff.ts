/**
 * /diff 명령어 핸들러 — git diff 변경 사항 요약 표시
 *
 * 사용자가 /diff를 입력하면 현재 작업 디렉토리의 git 변경 사항을
 * 스테이징(staged)과 언스테이징(unstaged)으로 구분하여
 * 파일별 추가/삭제 줄 수와 함께 포맷된 요약을 보여줍니다.
 *
 * 사용 예시:
 *   /diff              → 전체 변경 사항 요약
 *   /diff src/index.ts → 특정 파일의 변경 사항만 표시
 *
 * staged란? git add로 커밋 대기 중인 변경 사항
 * unstaged란? 아직 git add하지 않은 변경 사항
 */
import { execSync } from "node:child_process";
import { type SlashCommand } from "./registry.js";

/**
 * git diff --numstat 출력에서 파싱된 항목 인터페이스
 *
 * @property additions - 추가된 줄 수
 * @property deletions - 삭제된 줄 수
 * @property file - 파일 경로
 */
interface DiffEntry {
  readonly additions: number;
  readonly deletions: number;
  readonly file: string;
}

/**
 * git diff --numstat 출력을 구조화된 DiffEntry 배열로 파싱하는 함수
 *
 * --numstat 출력 형식: "추가수\t삭제수\t파일경로"
 * 바이너리 파일은 추가/삭제가 "-"로 표시되므로 0으로 처리합니다.
 *
 * @param output - git diff --numstat의 원시 출력 문자열
 * @returns 파싱된 DiffEntry 배열
 */
function parseNumstat(output: string): readonly DiffEntry[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length < 3) return null;

      const [addStr, delStr, ...fileParts] = parts;
      // Binary files show "-" for additions/deletions
      const additions = addStr === "-" ? 0 : parseInt(addStr, 10);
      const deletions = delStr === "-" ? 0 : parseInt(delStr, 10);
      const file = fileParts.join("\t"); // filenames with tabs (rare but possible)

      return { additions, deletions, file } as DiffEntry;
    })
    .filter((entry): entry is DiffEntry => entry !== null);
}

/**
 * 단일 diff 항목을 포맷된 한 줄 문자열로 변환하는 함수
 *
 * @param entry - diff 항목
 * @param prefix - 상태 접두사 ("M"=수정됨, "A"=스테이징됨)
 * @returns 포맷된 문자열 (예: "    M src/index.ts    (+5, -3)")
 */
function formatEntry(entry: DiffEntry, prefix: string): string {
  const adds = entry.additions > 0 ? `+${entry.additions}` : "";
  const dels = entry.deletions > 0 ? `-${entry.deletions}` : "";
  const stats = [adds, dels].filter(Boolean).join(", ");
  return `    ${prefix} ${entry.file}${stats ? `    (${stats})` : ""}`;
}

/**
 * git 명령어를 실행하고 출력을 반환하는 헬퍼 함수
 *
 * @param command - 실행할 git 명령어
 * @param cwd - 작업 디렉토리
 * @returns 명령어 출력 (실패 시 null)
 */
function runGit(
  command: string,
  cwd: string,
): string | null {
  try {
    return execSync(command, {
      encoding: "utf-8",
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * /diff 슬래시 명령어 정의 — git diff 변경 사항 포맷 표시
 *
 * git 명령어를 직접 실행하여 스테이징/언스테이징 변경 사항의
 * 파일 수, 추가/삭제 줄 수를 포맷된 요약으로 보여줍니다.
 */
export const diffCommand: SlashCommand = {
  name: "diff",
  description: "Show git diff of current changes",
  usage: "/diff [file path]",
  execute: async (args, context) => {
    const target = args.trim();
    const cwd = context.workingDirectory;

    // Verify we're in a git repo
    const gitCheck = runGit("git rev-parse --is-inside-work-tree", cwd);
    if (gitCheck === null) {
      return {
        output: "Error: Not a git repository (or git is not installed).",
        success: false,
      };
    }

    const fileArg = target ? ` -- ${target}` : "";

    // Get unstaged changes
    const unstagedNumstat = runGit(`git diff --numstat${fileArg}`, cwd) ?? "";
    const unstagedEntries = parseNumstat(unstagedNumstat);

    // Get staged changes
    const stagedNumstat = runGit(`git diff --cached --numstat${fileArg}`, cwd) ?? "";
    const stagedEntries = parseNumstat(stagedNumstat);

    // No changes detected
    if (unstagedEntries.length === 0 && stagedEntries.length === 0) {
      const msg = target
        ? `No changes detected for: ${target}`
        : "No changes detected.";
      return { output: msg, success: true };
    }

    // Calculate totals
    const totalFiles = new Set([
      ...unstagedEntries.map((e) => e.file),
      ...stagedEntries.map((e) => e.file),
    ]).size;

    const totalAdditions =
      unstagedEntries.reduce((sum, e) => sum + e.additions, 0) +
      stagedEntries.reduce((sum, e) => sum + e.additions, 0);

    const totalDeletions =
      unstagedEntries.reduce((sum, e) => sum + e.deletions, 0) +
      stagedEntries.reduce((sum, e) => sum + e.deletions, 0);

    // Build output
    const lines: string[] = [];

    lines.push("Changes in working directory");
    lines.push("=============================");
    lines.push("");
    lines.push(`  Modified: ${totalFiles} file${totalFiles !== 1 ? "s" : ""} (+${totalAdditions}, -${totalDeletions})`);
    lines.push("");

    if (unstagedEntries.length > 0) {
      lines.push("  Unstaged:");
      for (const entry of unstagedEntries) {
        lines.push(formatEntry(entry, "M"));
      }
      lines.push("");
    }

    if (stagedEntries.length > 0) {
      lines.push("  Staged:");
      for (const entry of stagedEntries) {
        lines.push(formatEntry(entry, "A"));
      }
      lines.push("");
    }

    lines.push(`  Total: ${totalFiles} file${totalFiles !== 1 ? "s" : ""}, +${totalAdditions} / -${totalDeletions}`);

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};

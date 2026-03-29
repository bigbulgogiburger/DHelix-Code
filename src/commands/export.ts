/**
 * /export 명령어 핸들러 — 대화 내역을 마크다운 파일로 내보내기
 *
 * 사용자가 /export를 입력하면 현재 대화의 전체 내역을 마크다운(.md) 파일로
 * 저장하거나 클립보드에 복사합니다.
 *
 * 내보내기에 포함되는 정보:
 *   - 메타데이터 테이블 (날짜, 모델, 세션, 버전, 플랫폼, 디렉토리)
 *   - 턴별 사용자/어시스턴트 메시지
 *   - 도구(tool) 호출 감지 및 표시
 *   - 민감 정보(API 키, 토큰 등) 자동 마스킹
 *   - 요약 통계 (턴 수, 메시지 수, 추정 토큰 수)
 *
 * 사용 예시:
 *   /export              → 타임스탬프 기반 파일명으로 저장
 *   /export my-session    → my-session 파일명으로 저장
 *   /export --clipboard   → 클립보드에 복사
 *
 * 사용 시점: 대화 내용을 팀과 공유하거나 기록으로 보관하고 싶을 때
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { VERSION } from "../constants.js";
import { type SlashCommand } from "./registry.js";

/** 어시스턴트 메시지에서 도구 호출을 감지하기 위한 정규식 패턴들 */
const TOOL_PATTERNS = [
  /`(glob_search|grep_search|read_file|write_file|edit_file|bash|list_dir|file_search|web_search|web_fetch|notebook_edit)`/gi,
  /> Tool: `([^`]+)`/g,
  /\btool[_\s]?(?:call|use|result)[:.\s]+`?(\w+)`?/gi,
] as const;

/**
 * 민감한 데이터 패턴을 마스킹(redact)하여 콘텐츠를 정화하는 함수
 *
 * API 키, Bearer 토큰, GitHub 토큰, Slack 토큰, 비밀번호 등
 * 보안에 민감한 문자열 패턴을 "[REDACTED_...]"로 치환합니다.
 *
 * @param content - 정화할 텍스트
 * @returns 민감 정보가 마스킹된 텍스트
 */
function sanitizeContent(content: string): string {
  return content
    .replace(/\b(sk-[a-zA-Z0-9]{20,})\b/g, "[REDACTED_API_KEY]")
    .replace(/\b(key-[a-zA-Z0-9]{20,})\b/g, "[REDACTED_KEY]")
    .replace(/\b(ssm_[a-zA-Z0-9]{20,})\b/g, "[REDACTED_KEY]")
    .replace(/(Bearer\s+)[a-zA-Z0-9._\-]{20,}/g, "$1[REDACTED_TOKEN]")
    .replace(/\b(ghp_[a-zA-Z0-9]{20,})\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\b(xoxb-[a-zA-Z0-9\-]{20,})\b/g, "[REDACTED_SLACK_TOKEN]")
    .replace(/(password["']?\s*[:=]\s*["'])[^"']{8,}(["'])/gi, "$1[REDACTED]$2");
}

/**
 * 어시스턴트 메시지에서 도구(tool) 참조를 감지하는 함수
 *
 * 정규식 패턴으로 메시지 내용에서 도구 호출을 찾아
 * 중복 없는 도구 이름 목록을 반환합니다.
 *
 * @param content - 어시스턴트 메시지 텍스트
 * @returns 발견된 고유 도구 이름 배열
 */
function detectToolCalls(content: string): readonly string[] {
  const tools = new Set<string>();
  for (const pattern of TOOL_PATTERNS) {
    // Reset lastIndex for global regexes
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        tools.add(match[1]);
      }
    }
  }
  return [...tools];
}

/**
 * 텍스트를 시스템 클립보드에 복사하는 함수
 *
 * macOS에서는 pbcopy, Linux에서는 xclip을 사용합니다.
 * Windows와 기타 플랫폼에서는 false를 반환합니다.
 *
 * @param text - 복사할 텍스트
 * @returns 성공 여부 (true=복사됨, false=지원하지 않거나 실패)
 */
function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text, stdio: ["pipe", "pipe", "pipe"] });
      return true;
    }
    if (process.platform === "linux") {
      execSync("xclip -selection clipboard", { input: text, stdio: ["pipe", "pipe", "pipe"] });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 문자열의 토큰 수를 대략적으로 추정하는 함수
 *
 * 약 4글자 = 1토큰으로 계산합니다 (영어 기준 근사치).
 * 정확한 토큰화(tokenization)가 아닌 빠른 추정용입니다.
 *
 * @param text - 토큰 수를 추정할 텍스트
 * @returns 추정된 토큰 수
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * /export 슬래시 명령어 정의 — 대화 내역을 풍부한 메타데이터와 함께 파일로 내보내기
 *
 * 지원 형식:
 *   /export [filename]       — 파일로 저장 (기본: 타임스탬프 파일명)
 *   /export --clipboard      — 클립보드에 복사
 */
export const exportCommand: SlashCommand = {
  name: "export",
  description: "Export conversation to file",
  usage: "/export [filename | --clipboard]",
  execute: async (args, context) => {
    const trimmedArgs = args.trim();
    const toClipboard = trimmedArgs === "--clipboard";
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = toClipboard ? "" : trimmedArgs || `dhelix-conversation-${timestamp}.md`;
    const filePath = toClipboard ? "" : join(context.workingDirectory, filename);

    try {
      const messages = context.messages ?? [];

      // ── Build metadata table ──
      const lines: string[] = [
        `# Dhelix Code Conversation Export`,
        ``,
        `| Field | Value |`,
        `|-------|-------|`,
        `| Date | ${now.toISOString()} |`,
        `| Model | ${context.model} |`,
        `| Session | ${context.sessionId ?? "N/A"} |`,
        `| Version | v${VERSION} |`,
        `| Platform | ${process.platform} (${process.arch}) |`,
        `| Directory | ${context.workingDirectory} |`,
        ``,
        `---`,
        ``,
      ];

      if (messages.length === 0) {
        lines.push("(No messages in conversation)");
      } else {
        // ── Messages with turn numbering ──
        let turnIndex = 0;
        let userCount = 0;
        let assistantCount = 0;
        let totalTokenEstimate = 0;

        for (const msg of messages) {
          if (msg.role === "system") continue;

          if (msg.role === "user") {
            turnIndex++;
            userCount++;
            lines.push(`## Turn ${turnIndex}`);
            lines.push(``);
          }

          const label = msg.role === "user" ? "User" : "Assistant";
          if (msg.role === "assistant") {
            assistantCount++;
          }

          lines.push(`### ${label}`);
          lines.push(``);

          const sanitized = sanitizeContent(msg.content);
          lines.push(sanitized);
          lines.push(``);

          // Detect tool calls in assistant messages
          if (msg.role === "assistant") {
            const tools = detectToolCalls(msg.content);
            if (tools.length > 0) {
              for (const tool of tools) {
                lines.push(`> Tool: \`${tool}\``);
              }
              lines.push(``);
            }
          }

          totalTokenEstimate += estimateTokens(msg.content);

          // Add separator between turns (after assistant response)
          if (msg.role === "assistant") {
            lines.push(`---`);
            lines.push(``);
          }
        }

        // ── Summary section ──
        lines.push(`## Summary`);
        lines.push(``);
        lines.push(`- **Turns**: ${turnIndex} (${userCount} user, ${assistantCount} assistant)`);
        lines.push(`- **Total messages**: ${messages.filter((m) => m.role !== "system").length}`);
        lines.push(`- **Estimated tokens**: ~${totalTokenEstimate.toLocaleString()}`);
      }

      const content = lines.join("\n");

      // ── Output: clipboard or file ──
      if (toClipboard) {
        const ok = copyToClipboard(content);
        if (ok) {
          return { output: "Conversation copied to clipboard.", success: true };
        }
        return {
          output: "Clipboard not available on this platform. Use /export [filename] instead.",
          success: false,
        };
      }

      await writeFile(filePath, content, "utf-8");
      return {
        output: `Conversation exported to: ${filename}`,
        success: true,
      };
    } catch (error) {
      return {
        output: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  },
};

// Re-export helpers for testing
export { sanitizeContent, detectToolCalls, estimateTokens };

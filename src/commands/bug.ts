/**
 * /bug 명령어 핸들러 — GitHub 이슈 버그 리포트 생성
 *
 * 사용자가 /bug <설명>을 입력하면 시스템 진단 정보(OS, Node.js 버전,
 * 모델명 등)를 자동으로 수집하여 GitHub 이슈 형태의 버그 리포트를 생성합니다.
 * 생성된 URL을 클릭하면 GitHub에 미리 채워진 이슈 페이지가 열립니다.
 *
 * 사용 시점: dhelix에서 버그를 발견했을 때 빠르게 리포트를 작성할 때
 */
import { type SlashCommand } from "./registry.js";
import { VERSION, APP_NAME } from "../constants.js";

/**
 * GitHub 이슈 URL을 생성하는 헬퍼 함수
 *
 * URL 쿼리 파라미터에 제목, 본문, 라벨을 인코딩하여
 * 클릭 시 미리 채워진 이슈 생성 페이지로 이동하도록 합니다.
 *
 * @param title - 버그 제목 (80자로 잘림)
 * @param body - 버그 리포트 마크다운 본문
 * @returns GitHub 이슈 생성 URL 문자열
 */
function buildGitHubIssueUrl(title: string, body: string): string {
  const params = new URLSearchParams({
    title: `[Bug] ${title.slice(0, 80)}`,
    body,
    labels: "bug",
  });
  return `https://github.com/bigbulgogiburger/dhelix/issues/new?${params}`;
}

/**
 * 환경 진단 정보를 포함한 마크다운 버그 리포트를 생성하는 함수
 *
 * 사용자가 입력한 설명에 OS, Node.js 버전, 모델명, 세션 ID, 타임스탬프 등
 * 시스템 정보를 자동으로 추가하여 재현에 필요한 환경 정보를 포함시킵니다.
 *
 * @param description - 사용자가 입력한 버그 설명
 * @param context - 현재 세션 컨텍스트 (모델명, 세션 ID)
 * @returns 마크다운 형식의 버그 리포트 문자열
 */
function formatBugReport(
  description: string,
  context: { readonly model: string; readonly sessionId?: string },
): string {
  return [
    "## Bug Report",
    "",
    `**Description**: ${description}`,
    "",
    "### Environment",
    `- ${APP_NAME}: v${VERSION}`,
    `- Platform: ${process.platform} (${process.arch})`,
    `- Node.js: ${process.version}`,
    `- Model: ${context.model}`,
    `- Session: ${context.sessionId ?? "N/A"}`,
    `- Timestamp: ${new Date().toISOString()}`,
  ].join("\n");
}

/**
 * /bug 슬래시 명령어 정의 — GitHub 이슈 형태의 버그 리포트 생성
 *
 * 사용자가 /bug <설명>을 입력하면:
 * 1. 시스템 진단 정보를 수집하여 마크다운 리포트 생성
 * 2. GitHub 이슈 생성 URL 생성 (클릭 시 미리 채워진 이슈 페이지 열림)
 * 3. 리포트 내용을 터미널에도 표시하여 복사 가능하게 함
 */
export const bugCommand: SlashCommand = {
  name: "bug",
  description: "Generate a bug report with system diagnostics",
  usage: "/bug <description>",
  execute: async (args, context) => {
    const description = args.trim();

    if (!description) {
      return {
        output: [
          "Usage: /bug <description>",
          "",
          "Generates a GitHub issue report with system diagnostics.",
          "",
          'Example: /bug "Tool output is truncated when response exceeds 4096 tokens"',
        ].join("\n"),
        success: true,
      };
    }

    const report = formatBugReport(description, context);
    const url = buildGitHubIssueUrl(description, report);

    const output = [
      "Bug report generated.",
      "",
      `Open in browser: ${url}`,
      "",
      "Or copy the report below:",
      "---",
      report,
    ].join("\n");

    return {
      output,
      success: true,
    };
  },
};

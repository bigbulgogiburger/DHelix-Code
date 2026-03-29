/**
 * 멘션 리졸버 — 파싱된 @멘션의 실제 콘텐츠를 로드
 *
 * 파서(parser)가 추출한 멘션을 실제로 해석(resolve)하여 콘텐츠를 가져옵니다:
 * - @file → 파일 시스템에서 내용 읽기
 * - @url → HTTP GET으로 웹 페이지 가져오기
 * - @mcp → MCP 클라이언트를 통해 리소스 조회
 *
 * 모든 멘션은 병렬(Promise.all)로 해석됩니다.
 * 해석 실패는 에러를 던지지 않고, 결과에 실패 정보를 포함합니다.
 *
 * @example
 * const mentions = parseMentions("@file:src/index.ts @https://example.com");
 * const resolved = await resolveMentions(mentions, { workingDirectory: process.cwd() });
 * const context = buildMentionContext(resolved);
 * // → "<referenced-content>\n--- src/index.ts ---\n...\n</referenced-content>"
 */

import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { BaseError } from "../utils/error.js";
import { type ParsedMention } from "./parser.js";

/** 멘션 해석(resolution) 에러 */
export class MentionResolveError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "MENTION_RESOLVE_ERROR", context);
  }
}

/** 해석된 멘션 — 원본 멘션 + 로드된 콘텐츠 */
export interface ResolvedMention {
  /** 원본 파싱된 멘션 정보 */
  readonly mention: ParsedMention;
  /** 해석된 콘텐츠 (파일 내용, URL 응답 본문, MCP 리소스) */
  readonly content: string;
  /** 해석 성공 여부 */
  readonly success: boolean;
  /** 해석 실패 시 에러 메시지 */
  readonly error?: string;
}

/**
 * @file 멘션을 해석합니다 — 파일 시스템에서 파일 내용을 읽습니다.
 *
 * 절대 경로는 그대로 사용하고, 상대 경로는 workingDirectory 기준으로 해석합니다.
 *
 * @param mention - 파싱된 파일 멘션
 * @param workingDirectory - 상대 경로의 기준 디렉토리
 * @returns 해석 결과 (성공/실패 포함)
 */
async function resolveFileMention(
  mention: ParsedMention,
  workingDirectory: string,
): Promise<ResolvedMention> {
  try {
    // 절대 경로 여부에 따라 파일 경로 결정
    const filePath = isAbsolute(mention.value)
      ? mention.value
      : resolve(workingDirectory, mention.value);

    const content = await readFile(filePath, "utf-8");
    return {
      mention,
      content: `--- ${mention.value} ---\n${content}`,
      success: true,
    };
  } catch (error) {
    return {
      mention,
      content: "",
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * @url 멘션을 해석합니다 — HTTP GET으로 URL의 내용을 가져옵니다.
 *
 * 15초 타임아웃이 설정되어 있으며, 50,000자 이상의 응답은 잘라냅니다(truncate).
 *
 * @param mention - 파싱된 URL 멘션
 * @returns 해석 결과 (성공/실패 포함)
 */
async function resolveUrlMention(mention: ParsedMention): Promise<ResolvedMention> {
  try {
    // AbortController로 15초 타임아웃 관리
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(mention.value, {
      signal: controller.signal,
      headers: { "User-Agent": "dhelix/0.1.0" },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        mention,
        content: "",
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const text = await response.text();
    // 매우 긴 응답은 50,000자로 잘라 컨텍스트 윈도우를 보호
    const maxLength = 50_000;
    const truncated = text.length > maxLength ? text.slice(0, maxLength) + "\n[truncated]" : text;

    return {
      mention,
      content: `--- ${mention.value} ---\n${truncated}`,
      success: true,
    };
  } catch (error) {
    return {
      mention,
      content: "",
      success: false,
      error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * @mcp 멘션을 해석합니다 — MCP 클라이언트를 통해 리소스를 조회합니다.
 *
 * MCP 해석은 활성 MCP 클라이언트 연결이 필요합니다.
 * mcpResolver 함수가 제공되지 않으면 실패로 처리됩니다.
 *
 * @param mention - 파싱된 MCP 멘션
 * @param mcpResolver - MCP 리소스 해석 함수 (서버이름, URI → 콘텐츠)
 * @returns 해석 결과 (성공/실패 포함)
 */
async function resolveMcpMention(
  mention: ParsedMention,
  mcpResolver?: (server: string, uri: string) => Promise<string>,
): Promise<ResolvedMention> {
  // MCP 리졸버가 없거나 서버 이름이 없으면 실패
  if (!mcpResolver || !mention.server) {
    return {
      mention,
      content: "",
      success: false,
      error: "MCP resolution not available",
    };
  }

  try {
    const content = await mcpResolver(mention.server, mention.value);
    return {
      mention,
      content: `--- @${mention.server}:${mention.value} ---\n${content}`,
      success: true,
    };
  } catch (error) {
    return {
      mention,
      content: "",
      success: false,
      error: `MCP resolve failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** 멘션 해석 옵션 */
export interface MentionResolverOptions {
  /** 파일 해석 시 상대 경로의 기준 디렉토리 */
  readonly workingDirectory: string;
  /** MCP 리소스 해석 함수 (선택적) — (서버이름, URI) → 콘텐츠 */
  readonly mcpResolver?: (server: string, uri: string) => Promise<string>;
}

/**
 * 모든 멘션을 병렬(Promise.all)로 해석하고 결과를 반환합니다.
 *
 * 실패한 해석은 에러를 던지지 않고, 결과에 실패 정보(success: false, error)를 포함합니다.
 * 이를 통해 일부 멘션 해석 실패가 전체 프로세스를 중단하지 않습니다.
 *
 * @param mentions - 해석할 파싱된 멘션 배열
 * @param options - 해석 옵션 (workingDirectory, mcpResolver)
 * @returns 해석 결과 배열 (각각 성공/실패 정보 포함)
 */
export async function resolveMentions(
  mentions: readonly ParsedMention[],
  options: MentionResolverOptions,
): Promise<readonly ResolvedMention[]> {
  // 멘션 타입에 따라 적절한 해석 함수로 분배
  const promises = mentions.map((mention) => {
    switch (mention.type) {
      case "file":
        return resolveFileMention(mention, options.workingDirectory);
      case "url":
        return resolveUrlMention(mention);
      case "mcp":
        return resolveMcpMention(mention, options.mcpResolver);
    }
  });

  // 모든 멘션을 병렬로 해석
  return Promise.all(promises);
}

/**
 * 해석된 멘션들을 컨텍스트 주입용 문자열로 결합합니다.
 *
 * 성공한 해석만 포함하며, <referenced-content> 태그로 감싸 반환합니다.
 * 시스템 프롬프트에 주입하여 LLM이 참조 콘텐츠를 활용할 수 있게 합니다.
 *
 * @param resolved - 해석된 멘션 배열
 * @returns 컨텍스트 문자열 (성공한 것이 없으면 빈 문자열)
 *
 * @example
 * const context = buildMentionContext(resolved);
 * // → "<referenced-content>\n--- src/index.ts ---\n...\n</referenced-content>"
 */
export function buildMentionContext(resolved: readonly ResolvedMention[]): string {
  // 성공한 해석만 필터링
  const successful = resolved.filter((r) => r.success);
  if (successful.length === 0) return "";

  const parts = successful.map((r) => r.content);
  return `<referenced-content>\n${parts.join("\n\n")}\n</referenced-content>`;
}

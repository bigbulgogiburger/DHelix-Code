/**
 * @멘션 파서 — 사용자 입력에서 @file, @url, @mcp 멘션을 추출
 *
 * 사용자가 입력한 텍스트에서 @로 시작하는 참조(멘션)를 파싱하여
 * 파일, URL, MCP 리소스를 식별합니다.
 *
 * 멘션 형식:
 * - @file:src/index.ts 또는 @src/index.ts → 파일 참조
 * - @https://example.com 또는 @url:https://... → URL 참조
 * - @postgres:sql://users/schema → MCP 리소스 참조
 *
 * 파싱 우선순위:
 * 1. URL 멘션 (가장 먼저 매칭 — 파일 패턴과의 오탐 방지)
 * 2. MCP 멘션 (http/https 제외)
 * 3. 파일 멘션 (마지막 — URL/MCP와 겹치지 않는 것만)
 *
 * @example
 * const mentions = parseMentions("@file:src/index.ts와 @https://docs.com을 참조하세요");
 * // [
 * //   { type: "file", value: "src/index.ts", raw: "@file:src/index.ts", ... },
 * //   { type: "url", value: "https://docs.com", raw: "@https://docs.com", ... },
 * // ]
 *
 * @example
 * const cleaned = stripMentions("@file:src/index.ts를 확인하세요");
 * // → "src/index.ts를 확인하세요"
 */

/** 멘션 타입: file(파일), url(웹 주소), mcp(MCP 리소스) */
export type MentionType = "file" | "url" | "mcp";

/** 파싱된 멘션 참조 */
export interface ParsedMention {
  /** 멘션 타입 (file, url, mcp) */
  readonly type: MentionType;
  /** 원본 텍스트 (예: "@file:src/index.ts") */
  readonly raw: string;
  /** 참조 값 (경로, URL, 또는 MCP 리소스 URI) */
  readonly value: string;
  /** MCP 멘션의 서버 이름 (MCP 타입에서만 사용) */
  readonly server?: string;
  /** 원본 문자열에서의 시작 인덱스 */
  readonly start: number;
  /** 원본 문자열에서의 끝 인덱스 */
  readonly end: number;
}

/**
 * @url 멘션 패턴: @url:https://... 또는 @https://...
 * 파일 패턴과의 오탐(false match)을 방지하기 위해 가장 먼저 확인합니다.
 */
const URL_MENTION_PATTERN = /@(?:url:)?(https?:\/\/[^\s,)}\]]+)/g;

/**
 * @mcp 멘션 패턴: @서버이름:프로토콜://리소스/경로
 * http/https URL은 제외합니다 (URL 패턴에서 처리).
 */
const MCP_MENTION_PATTERN = /@(\w+):((?!https?:\/\/)\w+:\/\/[^\s,)}\]]+)/g;

/**
 * @file 멘션 패턴: @file:경로/파일.확장자 또는 @경로/파일.확장자
 * URL과 매칭되지 않는 파일 경로만 캡처합니다.
 * 예: @src/utils/error.ts, @./relative/path.ts, @file:README.md
 */
const FILE_MENTION_PATTERN = /@(?:file:)?(\.?[/\\]?\w[^\s,)}\]]*\.\w+)/g;

/**
 * 주어진 위치 범위가 기존 멘션과 겹치는지 확인합니다.
 * 이미 파싱된 멘션(URL/MCP)과 겹치는 파일 멘션을 필터링하기 위해 사용합니다.
 *
 * @param start - 확인할 시작 인덱스
 * @param end - 확인할 끝 인덱스
 * @param existing - 이미 파싱된 멘션 목록
 * @returns 겹치면 true
 */
function overlapsExisting(start: number, end: number, existing: readonly ParsedMention[]): boolean {
  return existing.some(
    (m) => (start >= m.start && start < m.end) || (end > m.start && end <= m.end),
  );
}

/**
 * 사용자 입력 텍스트에서 @멘션을 파싱합니다.
 *
 * 파싱 순서 (오탐 방지):
 * 1. URL 멘션 (@https://..., @url:https://...) — 최우선
 * 2. MCP 멘션 (@server:protocol://resource) — http/https 제외
 * 3. 파일 멘션 (@file:path, @path/file.ext) — URL/MCP와 겹치지 않는 것만
 *
 * 중복 멘션(같은 raw 텍스트)은 첫 번째만 포함합니다.
 * 결과는 원본 텍스트에서의 위치(start) 순으로 정렬됩니다.
 *
 * @param text - 파싱할 입력 텍스트
 * @returns 파싱된 멘션 배열 (위치순 정렬)
 *
 * @example
 * parseMentions("@file:src/index.ts @https://example.com @postgres:sql://users")
 * // → [파일멘션, URL멘션, MCP멘션] (위치순)
 */
export function parseMentions(text: string): readonly ParsedMention[] {
  const mentions: ParsedMention[] = [];
  // 중복 방지를 위한 Set
  const seen = new Set<string>();

  // 1단계: URL 멘션 파싱 (최우선)
  for (const match of text.matchAll(URL_MENTION_PATTERN)) {
    const raw = match[0];
    if (seen.has(raw)) continue;
    seen.add(raw);

    mentions.push({
      type: "url",
      raw,
      value: match[1], // 캡처 그룹: https://... 부분
      start: match.index ?? 0,
      end: (match.index ?? 0) + raw.length,
    });
  }

  // 2단계: MCP 멘션 파싱
  for (const match of text.matchAll(MCP_MENTION_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;

    // 중복이거나 URL 멘션과 겹치면 건너뜀
    if (seen.has(raw) || overlapsExisting(start, end, mentions)) continue;
    seen.add(raw);

    mentions.push({
      type: "mcp",
      raw,
      value: match[2],   // 캡처 그룹 2: protocol://resource
      server: match[1],  // 캡처 그룹 1: 서버 이름
      start,
      end,
    });
  }

  // 3단계: 파일 멘션 파싱 (URL/MCP와 겹치지 않는 것만)
  for (const match of text.matchAll(FILE_MENTION_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;

    // URL 또는 MCP 멘션과 겹치면 건너뜀
    if (seen.has(raw) || overlapsExisting(start, end, mentions)) continue;
    seen.add(raw);

    // @file: 접두사 제거, 없으면 @ 제거
    const value = raw.startsWith("@file:") ? raw.slice(6) : raw.slice(1);

    mentions.push({
      type: "file",
      raw,
      value,
      start,
      end,
    });
  }

  // 원본 텍스트에서의 위치순으로 정렬
  return mentions.sort((a, b) => a.start - b.start);
}

/**
 * 텍스트에서 멘션 참조를 제거하고, 참조 값만 남깁니다.
 * 예: "@file:src/index.ts" → "src/index.ts"
 *
 * @param text - 멘션이 포함된 텍스트
 * @returns 멘션이 값으로 대체된 텍스트
 *
 * @example
 * stripMentions("@file:src/index.ts를 수정해주세요")
 * // → "src/index.ts를 수정해주세요"
 */
export function stripMentions(text: string): string {
  let result = text;
  const mentions = parseMentions(text);

  // 역순으로 대체하여 문자열 인덱스가 밀리지 않도록 함
  for (const mention of [...mentions].reverse()) {
    result = result.slice(0, mention.start) + mention.value + result.slice(mention.end);
  }

  return result;
}

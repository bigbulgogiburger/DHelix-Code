/**
 * 웹 페이지 가져오기 도구 — URL의 내용을 텍스트로 가져오는 도구
 *
 * 주어진 URL에 HTTP 요청을 보내고 응답 내용을 텍스트로 반환합니다.
 * HTML 응답은 자동으로 정리하여 (스크립트, 스타일, 내비게이션 등 제거)
 * 본문 텍스트만 추출합니다.
 *
 * 주요 기능:
 * - 응답 캐싱: 같은 URL을 15분 이내에 다시 요청하면 캐시에서 반환 (API 비용 절약)
 * - HTTP → HTTPS 자동 업그레이드: http:// URL을 https://로 먼저 시도
 * - 리다이렉트 추적: 최대 5회까지 리다이렉트를 따라감
 * - 콘텐츠 크기 제한: 응답이 너무 크면 자동으로 잘라냄
 * - 추출 프롬프트: 특정 정보만 추출하도록 힌트를 제공할 수 있음
 *
 * 권한 수준: "confirm" — 외부 네트워크 요청이므로 사용자 확인이 필요합니다.
 */
import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

// --- 15분 응답 캐시 ---

/**
 * 캐시 항목 — URL 응답을 캐시에 저장할 때 사용하는 인터페이스
 */
interface CacheEntry {
  /** 정리된(HTML 태그 제거된) 응답 텍스트 */
  readonly content: string;
  /** 캐시된 시간 (Unix timestamp) */
  readonly timestamp: number;
  /** 리다이렉트 후 최종 URL */
  readonly finalUrl: string;
  /** HTTP Content-Type 헤더 값 */
  readonly contentType: string;
  /** HTTP 상태 코드 */
  readonly status: number;
}

/** 캐시 유효 기간: 15분 (밀리초) */
const CACHE_TTL_MS = 15 * 60 * 1000;
/** 캐시 최대 크기: 50개 URL — 오래된 항목부터 자동 제거 */
const MAX_CACHE_SIZE = 50;
/** 응답 텍스트 최대 크기: 50,000자 — LLM 컨텍스트 윈도우 보호 */
const CONTENT_SIZE_LIMIT = 50_000;
/** 리다이렉트 최대 횟수 — 무한 리다이렉트 방지 */
const MAX_REDIRECTS = 5;
/** HTTP User-Agent 헤더 — 서버에 요청 주체를 알림 */
const USER_AGENT = "dbcode/1.0 (https://github.com/anthropics/dbcode)";

/** URL → 응답 캐시 저장소 (Map — 삽입 순서를 유지하여 LRU 방식 제거에 활용) */
const responseCache = new Map<string, CacheEntry>();

/**
 * 캐시에서 URL 응답을 조회 — TTL(유효 기간)이 지나면 자동 삭제 후 undefined 반환
 *
 * @param url - 조회할 URL
 * @returns 캐시된 응답 또는 undefined
 */
function getCachedEntry(url: string): CacheEntry | undefined {
  const entry = responseCache.get(url);
  if (!entry) return undefined;
  // TTL 초과 확인 — 15분이 지났으면 캐시 항목 삭제
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(url);
    return undefined;
  }
  return entry;
}

/**
 * 캐시 전체 초기화 — 테스트에서 클린 상태로 리셋할 때 사용
 */
export function clearCache(): void {
  responseCache.clear();
}

// --- 매개변수 스키마 ---

/**
 * 매개변수 스키마 — URL, 최대 길이, 추출 프롬프트를 정의
 */
const paramSchema = z.object({
  /** 가져올 URL — 유효한 URL 형식이어야 함 (Zod의 url() 검증) */
  url: z.string().url().describe("URL to fetch"),
  /** 최대 응답 길이(문자 수, 선택사항) — 이보다 길면 잘라냄 */
  maxLength: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(CONTENT_SIZE_LIMIT)
    .describe(`Maximum response length in characters (default: ${CONTENT_SIZE_LIMIT})`),
  /**
   * 추출 프롬프트(선택사항) — 페이지에서 어떤 정보를 추출해야 하는지 안내
   * 이 텍스트는 응답 앞에 표시되어, 후속 처리에서 필요한 정보를 식별하는 데 도움을 줍니다.
   */
  prompt: z
    .string()
    .optional()
    .describe(
      "Optional prompt describing what information to extract from the page. The fetched content will be returned with this prompt noted for downstream processing.",
    ),
});

type Params = z.infer<typeof paramSchema>;

// --- HTML 정리 / 콘텐츠 추출 ---

/**
 * HTML 태그를 제거하고 텍스트만 추출
 *
 * 단계별 처리:
 * 1. <script>, <style>, <nav>, <footer>, <header> 태그와 내용 전체 제거
 * 2. 블록 요소(p, div, br 등)를 줄바꿈으로 변환하여 가독성 유지
 * 3. 나머지 HTML 태그 제거
 * 4. HTML 엔티티 디코딩 (&amp; → &, &lt; → < 등)
 * 5. 과도한 공백과 빈 줄 정리
 *
 * @param html - 원본 HTML 문자열
 * @returns 정리된 텍스트
 */
function stripHtmlTags(html: string): string {
  return (
    html
      // 불필요한 태그와 내용을 통째로 제거
      .replace(/<script[\s\S]*?<\/script>/gi, "")  // JavaScript 코드
      .replace(/<style[\s\S]*?<\/style>/gi, "")     // CSS 스타일
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")         // 내비게이션 바
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")   // 하단 푸터
      .replace(/<header[\s\S]*?<\/header>/gi, "")   // 상단 헤더
      // 블록 요소를 줄바꿈으로 변환 — 단락 구분을 유지
      .replace(/<\/?(p|div|br|hr|h[1-6]|li|tr|blockquote)\b[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // 나머지 모든 HTML 태그 제거
      .replace(/<[^>]*>/g, "")
      // HTML 엔티티를 실제 문자로 디코딩
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, "\u2014")  // — (em dash)
      .replace(/&ndash;/g, "\u2013")  // – (en dash)
      .replace(/&hellip;/g, "\u2026") // … (말줄임표)
      // 과도한 공백 정리
      .replace(/[ \t]+/g, " ")        // 연속 공백/탭 → 단일 공백
      .replace(/\n{3,}/g, "\n\n")     // 3줄 이상의 빈 줄 → 2줄로
      .trim()
  );
}

// --- HTTP → HTTPS 업그레이드 ---

/**
 * HTTP URL을 HTTPS로 업그레이드
 *
 * 보안을 위해 http:// URL을 https://로 먼저 시도합니다.
 * 이미 https://이거나 http://가 아니면 undefined를 반환합니다.
 *
 * @param url - 원본 URL
 * @returns HTTPS로 업그레이드된 URL, 또는 undefined
 */
function upgradeToHttps(url: string): string | undefined {
  if (url.startsWith("http://")) {
    return "https://" + url.slice(7);
  }
  return undefined;
}

// --- 더 나은 HTTP 에러 메시지 ---

/**
 * HTTP 에러 코드에 따라 사용자 친화적인 에러 메시지 생성
 *
 * 각 상태 코드의 의미와 가능한 원인을 한국어로 설명하여
 * LLM이 에러를 이해하고 적절히 대응할 수 있게 합니다.
 *
 * @param status - HTTP 상태 코드
 * @param statusText - HTTP 상태 텍스트
 * @param url - 요청한 URL
 * @returns 상세한 에러 메시지
 */
function formatHttpError(status: number, statusText: string, url: string): string {
  switch (status) {
    case 403:
      return `HTTP 403 Forbidden — access denied for ${url}. The server may require authentication or block automated requests.`;
    case 404:
      return `HTTP 404 Not Found — the page at ${url} does not exist. Check the URL for typos.`;
    case 429:
      return `HTTP 429 Too Many Requests — rate limited by ${url}. Try again later.`;
    case 500:
      return `HTTP 500 Internal Server Error — the server at ${url} encountered an error.`;
    case 502:
      return `HTTP 502 Bad Gateway — the server at ${url} received an invalid response from upstream.`;
    case 503:
      return `HTTP 503 Service Unavailable — the server at ${url} is temporarily unavailable.`;
    default:
      return `HTTP ${status} ${statusText} for ${url}`;
  }
}

// --- 리다이렉트 추적 기능이 있는 fetch ---

/**
 * 리다이렉트를 수동으로 추적하면서 HTTP 요청 실행
 *
 * 기본 fetch()의 자동 리다이렉트 대신, 수동 리다이렉트(redirect: "manual")를 사용합니다.
 * 이를 통해:
 * 1. 리다이렉트 횟수를 제한하여 무한 루프 방지
 * 2. 최종 URL을 정확히 추적
 * 3. 상대 리다이렉트(relative redirect)를 올바르게 처리
 *
 * @param url - 요청할 URL
 * @param signal - 취소 신호 (타임아웃 또는 사용자 취소)
 * @returns HTTP 응답, 최종 URL, 리다이렉트 여부
 * @throws {Error} 리다이렉트 횟수 초과 시
 */
async function fetchWithRedirectTracking(
  url: string,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: string; redirected: boolean }> {
  let currentUrl = url;
  let redirectCount = 0;
  let response: Response;

  // 리다이렉트 루프 — 리다이렉트가 아닌 응답을 받을 때까지 반복
  for (;;) {
    response = await fetch(currentUrl, {
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, application/json, text/plain, */*",
      },
      // "manual" — 리다이렉트를 자동으로 따라가지 않고 3xx 응답을 직접 처리
      redirect: "manual",
    });

    // Location 헤더가 있고 3xx 응답이면 리다이렉트
    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      redirectCount++;
      if (redirectCount > MAX_REDIRECTS) {
        throw new Error(`Too many redirects (>${MAX_REDIRECTS}) starting from ${url}`);
      }
      // 상대 URL을 절대 URL로 변환 (예: "/page" → "https://example.com/page")
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    // 리다이렉트가 아니면 루프 종료
    break;
  }

  return {
    response,
    finalUrl: currentUrl,
    redirected: currentUrl !== url,
  };
}

// --- 메인 실행 함수 ---

/**
 * 웹 페이지 가져오기 실행 함수
 *
 * 실행 흐름:
 * 1. 캐시 확인 — 캐시에 있으면 즉시 반환 (네트워크 요청 없이)
 * 2. HTTP → HTTPS 업그레이드 시도 — http:// URL은 https://로 먼저 시도
 * 3. 리다이렉트 추적하면서 HTTP 요청 실행
 * 4. HTML 응답은 태그를 제거하여 텍스트만 추출
 * 5. 응답을 캐시에 저장 (15분간 유효)
 * 6. 크기 제한 초과 시 자동으로 잘라냄
 *
 * @param params - 검증된 매개변수 (URL, 최대 길이, 추출 프롬프트)
 * @param context - 실행 컨텍스트 (취소 신호 등)
 * @returns 가져온 텍스트 콘텐츠
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const url = params.url;

  // 1단계: 캐시에서 먼저 확인 — 15분 이내에 같은 URL을 요청했으면 캐시에서 반환
  const cached = getCachedEntry(url);
  if (cached) {
    let output = cached.content;
    const truncated = output.length > params.maxLength;
    if (truncated) {
      output = output.slice(0, params.maxLength);
      output += `\n\n[Truncated: showing first ${params.maxLength} of ${cached.content.length} chars]`;
    }

    const parts: string[] = ["[Cached response]"];
    if (params.prompt) {
      parts.push(`[Extraction prompt: ${params.prompt}]`);
    }
    parts.push(output);

    return {
      output: parts.join("\n\n"),
      isError: false,
      metadata: {
        url,
        finalUrl: cached.finalUrl,
        status: cached.status,
        contentType: cached.contentType,
        length: cached.content.length,
        truncated,
        cached: true,
      },
    };
  }

  // 2단계: HTTP → HTTPS 업그레이드 — http:// URL은 보안을 위해 https://로 먼저 시도
  const httpsUrl = upgradeToHttps(url);

  // 독립적인 취소 제어기 생성 (30초 타임아웃)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  // 부모 취소 신호와 연결 — 사용자가 취소하면 이 요청도 취소
  const onParentAbort = () => controller.abort();
  context.abortSignal.addEventListener("abort", onParentAbort, { once: true });

  try {
    let fetchResult: { response: Response; finalUrl: string; redirected: boolean };

    if (httpsUrl) {
      // HTTPS로 먼저 시도, 실패하면 원래 HTTP URL로 폴백(fallback)
      try {
        fetchResult = await fetchWithRedirectTracking(httpsUrl, controller.signal);
      } catch {
        // HTTPS 실패 — 원래 HTTP URL로 재시도
        fetchResult = await fetchWithRedirectTracking(url, controller.signal);
      }
    } else {
      fetchResult = await fetchWithRedirectTracking(url, controller.signal);
    }

    const { response, finalUrl, redirected } = fetchResult;

    // HTTP 에러 응답 처리 (4xx, 5xx)
    if (!response.ok) {
      return {
        output: formatHttpError(response.status, response.statusText, finalUrl),
        isError: true,
        metadata: { url, finalUrl, status: response.status },
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const rawText = await response.text();

    // HTML 응답이면 태그를 제거하여 텍스트만 추출
    let text: string;
    if (contentType.includes("text/html")) {
      text = stripHtmlTags(rawText);
    } else {
      text = rawText;
    }

    // 3단계: 응답을 캐시에 저장
    // 캐시가 가득 찼으면 가장 오래된 항목(Map의 첫 번째 키)을 제거
    if (responseCache.size >= MAX_CACHE_SIZE && !responseCache.has(url)) {
      const oldestKey = responseCache.keys().next().value;
      if (oldestKey !== undefined) {
        responseCache.delete(oldestKey);
      }
    }
    responseCache.set(url, {
      content: text,
      timestamp: Date.now(),
      finalUrl,
      contentType,
      status: response.status,
    });

    // 4단계: 크기 제한 적용 — 응답이 maxLength를 초과하면 잘라냄
    const truncated = text.length > params.maxLength;
    let output = truncated ? text.slice(0, params.maxLength) : text;

    // 출력 구성 — 리다이렉트, HTTPS 업그레이드, 추출 프롬프트 정보를 앞에 추가
    const parts: string[] = [];

    if (redirected) {
      parts.push(`[Redirected to: ${finalUrl}]`);
    }
    if (httpsUrl && fetchResult.finalUrl.startsWith("https://")) {
      parts.push("[Upgraded to HTTPS]");
    }
    if (params.prompt) {
      parts.push(`[Extraction prompt: ${params.prompt}]`);
    }
    if (truncated) {
      output += `\n\n[Truncated: showing first ${params.maxLength} of ${text.length} chars]`;
    }

    parts.push(output);

    return {
      output: parts.join("\n\n"),
      isError: false,
      metadata: {
        url,
        finalUrl,
        status: response.status,
        contentType,
        length: text.length,
        truncated,
        cached: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // AbortError — 타임아웃으로 인한 취소
    const isAbort = error instanceof Error && error.name === "AbortError";
    const isRedirectLimit = message.includes("Too many redirects");
    return {
      output: isAbort
        ? `Request timed out after 30s for ${url}. The server may be slow or unresponsive.`
        : isRedirectLimit
          ? message
          : `Fetch failed for ${url}: ${message}`,
      isError: true,
      metadata: { url },
    };
  } finally {
    // 타이머와 이벤트 리스너 정리 — 메모리 누수 방지
    clearTimeout(timeout);
    context.abortSignal.removeEventListener("abort", onParentAbort);
  }
}

/**
 * web_fetch 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const webFetchTool: ToolDefinition<Params> = {
  name: "web_fetch",
  description:
    "Fetch a URL and return its contents as text. HTML responses are automatically cleaned (scripts, styles, nav, footer, header stripped). Supports response caching (15 min), HTTP→HTTPS upgrade, redirect tracking, and optional content extraction prompts.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};

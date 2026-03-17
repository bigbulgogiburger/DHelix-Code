/**
 * 웹 검색 도구 — 실시간 웹 검색을 수행하여 제목, URL, 스니펫을 반환하는 도구
 *
 * 두 가지 검색 엔진을 지원합니다:
 * 1. Brave Search API: BRAVE_SEARCH_API_KEY 환경변수가 설정된 경우 사용 (JSON API)
 * 2. DuckDuckGo: 기본 폴백(fallback) — API 키 없이 HTML 파싱으로 검색
 *
 * Brave Search는 공식 API를 사용하므로 더 안정적이고 정확합니다.
 * DuckDuckGo는 HTML 페이지를 파싱하므로, UI 변경 시 동작하지 않을 수 있습니다.
 *
 * 권한 수준: "safe" — 검색만 수행하고 시스템을 변경하지 않으므로 안전합니다.
 */
import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

/**
 * 매개변수 스키마 — 검색 쿼리와 최대 결과 수를 정의
 */
const paramSchema = z.object({
  /** 검색할 쿼리 문자열 */
  query: z.string().describe("Search query string"),
  /** 최대 결과 수 (1-10, 기본값: 5) */
  max_results: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe("Maximum number of results (1-10)"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 단일 검색 결과 인터페이스
 */
interface SearchResult {
  /** 검색 결과 제목 */
  readonly title: string;
  /** 결과 페이지 URL */
  readonly url: string;
  /** 검색 결과 요약(스니펫) */
  readonly snippet: string;
}

/**
 * 검색 결과를 사람이 읽기 쉬운 마크다운 형식으로 변환
 *
 * 출력 예시:
 * Web search results for "TypeScript generics":
 *
 * 1. [TypeScript Handbook: Generics](https://typescriptlang.org/...)
 *    Generics provide a way to make components...
 *
 * @param query - 검색 쿼리
 * @param results - 검색 결과 배열
 * @returns 마크다운 형식의 결과 텍스트
 */
function formatResults(query: string, results: readonly SearchResult[]): string {
  if (results.length === 0) {
    return `No results found for "${query}".`;
  }

  const lines = [`Web search results for "${query}":\n`];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    // 마크다운 링크 형식으로 제목과 URL 표시
    lines.push(`${i + 1}. [${r.title}](${r.url})`);
    if (r.snippet) {
      lines.push(`   ${r.snippet}`);
    }
    lines.push(""); // 결과 사이 빈 줄
  }
  return lines.join("\n").trimEnd();
}

/**
 * HTML 엔티티를 실제 문자로 디코딩
 *
 * DuckDuckGo 검색 결과에는 HTML 엔티티가 포함될 수 있으므로
 * 사람이 읽기 쉬운 문자로 변환합니다.
 *
 * @param text - HTML 엔티티가 포함된 텍스트
 * @returns 디코딩된 텍스트
 */
function decodeHtmlEntities(text: string): string {
  return (
    text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      // 숫자 HTML 엔티티 (예: &#8212; → —)
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
  );
}

/**
 * HTML 태그를 모두 제거하고 텍스트만 추출
 *
 * @param html - HTML 문자열
 * @returns 태그가 제거된 순수 텍스트
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Brave Search API를 사용하여 검색 수행
 *
 * Brave Search는 독립적인 검색 인덱스를 가진 프라이버시 중심 검색 엔진입니다.
 * 공식 REST API를 제공하며, JSON 형식으로 결과를 반환합니다.
 *
 * 사용하려면 BRAVE_SEARCH_API_KEY 환경변수를 설정해야 합니다.
 * API 키는 https://brave.com/search/api/ 에서 발급받을 수 있습니다.
 *
 * @param query - 검색 쿼리
 * @param maxResults - 최대 결과 수
 * @param apiKey - Brave Search API 키
 * @param signal - 취소 신호
 * @returns 검색 결과 배열
 */
async function searchBrave(
  query: string,
  maxResults: number,
  apiKey: string,
  signal: AbortSignal,
): Promise<readonly SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(maxResults));

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey, // Brave API 인증 헤더
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
  }

  // Brave API 응답 구조에서 웹 검색 결과만 추출
  const data = (await response.json()) as {
    web?: { results?: Array<{ title: string; url: string; description: string }> };
  };

  const webResults = data.web?.results ?? [];
  return webResults.slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
}

/**
 * DuckDuckGo HTML 검색 — API 키 없이 HTML 페이지를 파싱하여 검색
 *
 * DuckDuckGo의 HTML 전용 검색 페이지(html.duckduckgo.com)에
 * POST 요청을 보내고, 응답 HTML에서 검색 결과를 정규식으로 추출합니다.
 *
 * 참고: DuckDuckGo의 HTML 구조가 변경되면 파싱이 실패할 수 있습니다.
 * 이 경우 정규식 패턴을 업데이트해야 합니다.
 *
 * @param query - 검색 쿼리
 * @param maxResults - 최대 결과 수
 * @param signal - 취소 신호
 * @returns 검색 결과 배열
 */
async function searchDuckDuckGo(
  query: string,
  maxResults: number,
  signal: AbortSignal,
): Promise<readonly SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    signal,
    method: "POST",
    headers: {
      "User-Agent": "dbcode/1.0",
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];

  // HTML에서 검색 결과를 정규식으로 추출
  // 각 결과는: <a class="result__a" href="URL">제목</a> ... <a class="result__snippet">스니펫</a>
  const resultPattern =
    /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
    const rawUrl = match[1];
    // HTML 태그를 제거하고 엔티티를 디코딩
    const title = decodeHtmlEntities(stripTags(match[2]));
    const snippet = decodeHtmlEntities(stripTags(match[3]));

    // DuckDuckGo는 URL을 리다이렉트로 감싸므로, 실제 URL을 uddg 파라미터에서 추출
    let finalUrl = rawUrl;
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      finalUrl = decodeURIComponent(uddgMatch[1]);
    }

    if (title && finalUrl) {
      results.push({ title, url: finalUrl, snippet });
    }
  }

  return results;
}

/**
 * 웹 검색 실행 함수
 *
 * 실행 흐름:
 * 1. BRAVE_SEARCH_API_KEY 환경변수 확인
 * 2. API 키가 있으면 Brave Search API 사용, 없으면 DuckDuckGo 폴백
 * 3. 10초 타임아웃 설정 (검색이 오래 걸리면 취소)
 * 4. 결과를 마크다운 형식으로 변환하여 반환
 *
 * @param params - 검증된 매개변수 (쿼리, 최대 결과 수)
 * @param context - 실행 컨텍스트 (취소 신호 등)
 * @returns 검색 결과 텍스트
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  // 독립적인 취소 제어기 생성 (10초 타임아웃)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  // 부모 취소 신호와 연결
  const onParentAbort = () => controller.abort();
  context.abortSignal.addEventListener("abort", onParentAbort, { once: true });

  try {
    // 환경변수에서 Brave Search API 키 확인
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

    let results: readonly SearchResult[];
    let engine: string;

    if (braveApiKey) {
      // Brave Search API 사용 (더 안정적이고 정확)
      engine = "Brave Search";
      results = await searchBrave(params.query, params.max_results, braveApiKey, controller.signal);
    } else {
      // DuckDuckGo 폴백 (API 키 불필요)
      engine = "DuckDuckGo";
      results = await searchDuckDuckGo(params.query, params.max_results, controller.signal);
    }

    const output = formatResults(params.query, results);
    return {
      output,
      isError: false,
      metadata: {
        query: params.query,
        engine, // 사용된 검색 엔진
        resultCount: results.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      output: isAbort ? `Search timed out for "${params.query}"` : `Search failed: ${message}`,
      isError: true,
      metadata: { query: params.query },
    };
  } finally {
    // 타이머와 이벤트 리스너 정리 — 메모리 누수 방지
    clearTimeout(timeout);
    context.abortSignal.removeEventListener("abort", onParentAbort);
  }
}

/**
 * web_search 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const webSearchTool: ToolDefinition<Params> = {
  name: "web_search",
  description:
    "Search the web for current information. Returns titles, URLs, and snippets. Uses Brave Search API if BRAVE_SEARCH_API_KEY is set, otherwise falls back to DuckDuckGo.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 10_000,
  execute,
};

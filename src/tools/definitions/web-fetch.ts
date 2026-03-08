import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

// --- 15-minute response cache ---

interface CacheEntry {
  readonly content: string;
  readonly timestamp: number;
  readonly finalUrl: string;
  readonly contentType: string;
  readonly status: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 50;
const CONTENT_SIZE_LIMIT = 50_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "dbcode/1.0 (https://github.com/anthropics/dbcode)";

const responseCache = new Map<string, CacheEntry>();

function getCachedEntry(url: string): CacheEntry | undefined {
  const entry = responseCache.get(url);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    responseCache.delete(url);
    return undefined;
  }
  return entry;
}

/** Exported for testing — clears the response cache */
export function clearCache(): void {
  responseCache.clear();
}

// --- Parameter schema ---

const paramSchema = z.object({
  url: z.string().url().describe("URL to fetch"),
  maxLength: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(CONTENT_SIZE_LIMIT)
    .describe(`Maximum response length in characters (default: ${CONTENT_SIZE_LIMIT})`),
  prompt: z
    .string()
    .optional()
    .describe(
      "Optional prompt describing what information to extract from the page. The fetched content will be returned with this prompt noted for downstream processing.",
    ),
});

type Params = z.infer<typeof paramSchema>;

// --- HTML stripping / content extraction ---

function stripHtmlTags(html: string): string {
  return (
    html
      // Remove script, style, nav, footer, header tags and their content
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      // Convert common block elements to newlines for readability
      .replace(/<\/?(p|div|br|hr|h[1-6]|li|tr|blockquote)\b[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]*>/g, "")
      // Decode common HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&mdash;/g, "—")
      .replace(/&ndash;/g, "–")
      .replace(/&hellip;/g, "…")
      // Collapse excessive whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// --- HTTP → HTTPS upgrade ---

function upgradeToHttps(url: string): string | undefined {
  if (url.startsWith("http://")) {
    return "https://" + url.slice(7);
  }
  return undefined;
}

// --- Better error messages ---

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

// --- Fetch with redirect tracking ---

async function fetchWithRedirectTracking(
  url: string,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: string; redirected: boolean }> {
  // Use manual redirect to track hops
  let currentUrl = url;
  let redirectCount = 0;
  let response: Response;

  for (;;) {
    response = await fetch(currentUrl, {
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, application/json, text/plain, */*",
      },
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      redirectCount++;
      if (redirectCount > MAX_REDIRECTS) {
        throw new Error(`Too many redirects (>${MAX_REDIRECTS}) starting from ${url}`);
      }
      // Resolve relative redirects
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    break;
  }

  return {
    response,
    finalUrl: currentUrl,
    redirected: currentUrl !== url,
  };
}

// --- Main execute ---

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const url = params.url;

  // Check cache first
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

  // HTTP → HTTPS upgrade: try HTTPS first for http:// URLs
  const httpsUrl = upgradeToHttps(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  // Link parent abort signal
  const onParentAbort = () => controller.abort();
  context.abortSignal.addEventListener("abort", onParentAbort, { once: true });

  try {
    let fetchResult: { response: Response; finalUrl: string; redirected: boolean };

    if (httpsUrl) {
      // Try HTTPS first, fall back to original HTTP
      try {
        fetchResult = await fetchWithRedirectTracking(httpsUrl, controller.signal);
      } catch {
        // HTTPS failed, try original HTTP URL
        fetchResult = await fetchWithRedirectTracking(url, controller.signal);
      }
    } else {
      fetchResult = await fetchWithRedirectTracking(url, controller.signal);
    }

    const { response, finalUrl, redirected } = fetchResult;

    if (!response.ok) {
      return {
        output: formatHttpError(response.status, response.statusText, finalUrl),
        isError: true,
        metadata: { url, finalUrl, status: response.status },
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const rawText = await response.text();

    let text: string;
    if (contentType.includes("text/html")) {
      text = stripHtmlTags(rawText);
    } else {
      text = rawText;
    }

    // Cache the full content (evict oldest entry if at capacity)
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

    // Apply content size limit
    const truncated = text.length > params.maxLength;
    let output = truncated ? text.slice(0, params.maxLength) : text;

    // Build output parts
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
    clearTimeout(timeout);
    context.abortSignal.removeEventListener("abort", onParentAbort);
  }
}

export const webFetchTool: ToolDefinition<Params> = {
  name: "web_fetch",
  description:
    "Fetch a URL and return its contents as text. HTML responses are automatically cleaned (scripts, styles, nav, footer, header stripped). Supports response caching (15 min), HTTP→HTTPS upgrade, redirect tracking, and optional content extraction prompts.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};

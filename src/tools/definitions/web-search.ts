import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

const paramSchema = z.object({
  query: z.string().describe("Search query string"),
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

interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

function formatResults(query: string, results: readonly SearchResult[]): string {
  if (results.length === 0) {
    return `No results found for "${query}".`;
  }

  const lines = [`Web search results for "${query}":\n`];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`${i + 1}. [${r.title}](${r.url})`);
    if (r.snippet) {
      lines.push(`   ${r.snippet}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

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
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
  }

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

  // Parse result blocks: each result is in a div with class "result"
  // Title + link in <a class="result__a">
  // Snippet in <a class="result__snippet">
  const resultPattern =
    /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(html)) !== null && results.length < maxResults) {
    const rawUrl = match[1];
    const title = decodeHtmlEntities(stripTags(match[2]));
    const snippet = decodeHtmlEntities(stripTags(match[3]));

    // DDG wraps URLs through a redirect; extract actual URL
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

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const onParentAbort = () => controller.abort();
  context.abortSignal.addEventListener("abort", onParentAbort, { once: true });

  try {
    const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

    let results: readonly SearchResult[];
    let engine: string;

    if (braveApiKey) {
      engine = "Brave Search";
      results = await searchBrave(params.query, params.max_results, braveApiKey, controller.signal);
    } else {
      engine = "DuckDuckGo";
      results = await searchDuckDuckGo(params.query, params.max_results, controller.signal);
    }

    const output = formatResults(params.query, results);
    return {
      output,
      isError: false,
      metadata: {
        query: params.query,
        engine,
        resultCount: results.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      output: isAbort
        ? `Search timed out for "${params.query}"`
        : `Search failed: ${message}`,
      isError: true,
      metadata: { query: params.query },
    };
  } finally {
    clearTimeout(timeout);
    context.abortSignal.removeEventListener("abort", onParentAbort);
  }
}

export const webSearchTool: ToolDefinition<Params> = {
  name: "web_search",
  description:
    "Search the web for current information. Returns titles, URLs, and snippets. Uses Brave Search API if BRAVE_SEARCH_API_KEY is set, otherwise falls back to DuckDuckGo.",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 10_000,
  execute,
};

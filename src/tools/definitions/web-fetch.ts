import { z } from "zod";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";

const paramSchema = z.object({
  url: z.string().url().describe("URL to fetch"),
  maxLength: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(100_000)
    .describe("Maximum response length in characters (default: 100000)"),
});

type Params = z.infer<typeof paramSchema>;

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  // Link parent abort signal
  const onParentAbort = () => controller.abort();
  context.abortSignal.addEventListener("abort", onParentAbort, { once: true });

  try {
    const response = await fetch(params.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "dbcode/1.0",
        Accept: "text/html, application/json, text/plain, */*",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        output: `HTTP ${response.status} ${response.statusText} for ${params.url}`,
        isError: true,
        metadata: { url: params.url, status: response.status },
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

    const truncated = text.length > params.maxLength;
    const output = truncated ? text.slice(0, params.maxLength) : text;

    return {
      output: truncated ? `${output}\n\n[Truncated: ${text.length} chars total, showing first ${params.maxLength}]` : output,
      isError: false,
      metadata: {
        url: params.url,
        status: response.status,
        contentType,
        length: text.length,
        truncated,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      output: isAbort ? `Request timed out for ${params.url}` : `Fetch failed: ${message}`,
      isError: true,
      metadata: { url: params.url },
    };
  } finally {
    clearTimeout(timeout);
    context.abortSignal.removeEventListener("abort", onParentAbort);
  }
}

export const webFetchTool: ToolDefinition<Params> = {
  name: "web_fetch",
  description:
    "Fetch a URL and return its contents as text. HTML responses are automatically stripped of tags. Useful for reading web pages, API responses, and documentation.",
  parameterSchema: paramSchema,
  permissionLevel: "confirm",
  timeoutMs: 30_000,
  execute,
};

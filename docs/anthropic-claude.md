# Anthropic Claude API Provider

This document summarizes the latest implementation of the Anthropic Claude API provider in the `dbcode` project.

## Overview

- Implemented in `src/llm/providers/anthropic.ts`.
- Provides the `AnthropicProvider` class implementing the `LLMProvider` interface.
- Directly calls Anthropic's Messages API using `fetch`, with no SDK dependency.

## Key Features

- **API Key & Config:** Requires an API key via config or environment variable `ANTHROPIC_API_KEY`. Supports custom base URL and request timeout.
- **Chat Method:** Implements `chat` with retry logic on retryable errors (rate limits, transient errors) using exponential backoff.
- **Single Request:** `_chatOnce` sends a single chat request and parses the JSON response.
- **Response Parsing:** `_parseResponse` extracts text content, thinking content, and tool call requests from the API response.
- **Streaming Support:** Supports streaming chat responses via `stream` and `_streamOnce` methods, parsing server-sent events (SSE) for incremental updates.
- **Request Body:** Builds request body including model, messages, max tokens, temperature, tools, and thinking flags.
- **Token Counting:** Approximates token count as 1 token per 4 characters for Claude models.

## Usage Example

```typescript
const provider = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await provider.chat({
  model: "claude-v1",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" },
  ],
});
console.log(response.content);
```

## Notes

- Handles request aborts and timeouts gracefully.
- Supports tool calls and "thinking" content blocks in responses.
- Streaming yields incremental deltas for text, thinking, and tool call arguments.

---

This summary is based on the implementation as of the latest codebase scan on 2026-03-09.
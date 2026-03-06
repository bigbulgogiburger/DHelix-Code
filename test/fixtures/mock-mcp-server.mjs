#!/usr/bin/env node
/**
 * Simple mock MCP server for testing.
 * Reads JSON-RPC requests from stdin, responds on stdout.
 */
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    if (!msg.id) return; // notification — no response

    if (msg.method === "initialize") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: "mock-mcp", version: "1.0.0" },
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (msg.method === "tools/list") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          tools: [
            {
              name: "echo",
              description: "Echo a message",
              inputSchema: { type: "object", properties: { message: { type: "string" } } },
            },
          ],
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (msg.method === "tools/call") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          content: [{ type: "text", text: `Echo: ${msg.params?.arguments?.message ?? ""}` }],
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (msg.method === "resources/list") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          resources: [{ uri: "test://hello", name: "hello", description: "Test resource" }],
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (msg.method === "resources/read") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          contents: [{ text: "Resource content for " + (msg.params?.uri ?? "") }],
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (msg.method === "error/test") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32600, message: "Test error", data: { detail: "test" } },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else {
      // Unknown method
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32601, message: "Method not found" },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch {
    // Ignore parse errors
  }
});

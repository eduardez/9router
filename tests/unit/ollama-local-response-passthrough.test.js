import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { handleChatCore } from "../../open-sse/handlers/chatCore.js";

// ollama-local answers /api/chat. Native Ollama bodies are Ollama-shaped, but a proxy or
// OpenAI-compatible shim in front of the same host answers in OpenAI shape — that body must
// pass through, not be re-read as an Ollama body (which dropped content and zeroed usage).
// Streams from Ollama are NDJSON (application/x-ndjson), not SSE, and must not be blocked.

let mode = "openai-json";
const server = createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    if (mode === "openai-json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "chatcmpl-1", object: "chat.completion", created: 1, model: "m",
        choices: [{ index: 0, message: { role: "assistant", content: "PONG" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 34, completion_tokens: 1, total_tokens: 35 },
      }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.write(JSON.stringify({ model: "m", message: { role: "assistant", content: "PONG" }, done: false }) + "\n");
    res.end(JSON.stringify({ model: "m", message: { role: "assistant", content: "" }, done: true, done_reason: "stop", prompt_eval_count: 34, eval_count: 1 }) + "\n");
  });
});

let baseUrl;
beforeAll(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

const call = (stream) => handleChatCore({
  body: { model: "ollama-local/m", messages: [{ role: "user", content: "Reply exactly: PONG" }], stream },
  modelInfo: { provider: "ollama-local", model: "m" },
  credentials: { providerSpecificData: { baseUrl }, apiKey: "x" },
  clientRawRequest: { endpoint: "/v1/chat/completions", body: {}, headers: {} },
  connectionId: "test-conn",
  apiKey: "test-key",
});

describe("ollama-local response passthrough", () => {
  it("keeps an OpenAI-shaped non-stream body instead of zeroing content and usage", async () => {
    mode = "openai-json";
    const result = await call(false);
    expect(result.success).toBe(true);
    const json = await result.response.json();
    expect(json.choices[0].message.content).toBe("PONG");
    expect(json.usage.completion_tokens).toBe(1);
  });

  it("accepts Ollama's application/x-ndjson stream", async () => {
    mode = "ndjson";
    const result = await call(true);
    expect(result.success).toBe(true);
    const text = await result.response.text();
    expect(text).not.toContain("upstream non-SSE");
    expect(text).toContain('"content":"PONG"');
    expect(text).toContain('"prompt_tokens":34');
  });
});

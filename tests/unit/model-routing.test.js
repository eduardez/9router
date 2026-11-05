import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;

async function setupDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-model-routing-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();

  const { createProviderNode, createProviderConnection } = await import("@/models/index.js");
  const { getModelInfo } = await import("@/sse/services/model.js");

  return {
    createProviderNode,
    createProviderConnection,
    getModelInfo,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

describe("model routing", () => {
  let cleanup = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cleanup();
    cleanup = () => {};
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
  });

  it("keeps built-in provider aliases ahead of compatible node prefixes", async () => {
    const ctx = await setupDb();
    cleanup = ctx.cleanup;

    await ctx.createProviderNode({
      id: "openai-compatible-chat-test",
      type: "openai-compatible",
      name: "Compatible CF Collision",
      prefix: "cf",
      apiType: "chat",
      baseUrl: "https://compatible.test/v1",
    });

    await expect(ctx.getModelInfo("cf/@cf/black-forest-labs/flux-2-klein-9b"))
      .resolves.toEqual({
        provider: "cloudflare-ai",
        model: "@cf/black-forest-labs/flux-2-klein-9b",
      });
  });

  it("still routes non-reserved compatible node prefixes", async () => {
    const ctx = await setupDb();
    cleanup = ctx.cleanup;

    await ctx.createProviderNode({
      id: "openai-compatible-chat-test",
      type: "openai-compatible",
      name: "Compatible OCT",
      prefix: "oct",
      apiType: "chat",
      baseUrl: "https://compatible.test/v1",
    });

    await expect(ctx.getModelInfo("oct/gpt-image-1"))
      .resolves.toEqual({
        provider: "openai-compatible-chat-test",
        model: "gpt-image-1",
      });
  });

  it("routes a reserved-prefix node that owns the only credentials (atria, #78)", async () => {
    const ctx = await setupDb();
    cleanup = ctx.cleanup;

    await ctx.createProviderNode({
      id: "openai-compatible-chat-atria",
      type: "openai-compatible",
      name: "Atria AI",
      prefix: "atria",
      apiType: "chat",
      baseUrl: "https://api.atria-asi.ai/v1",
    });
    await ctx.createProviderConnection({
      provider: "openai-compatible-chat-atria",
      authType: "apikey",
      name: "Atria key",
      apiKey: "sk-atria",
    });

    await expect(ctx.getModelInfo("atria/Atria-Dawn"))
      .resolves.toEqual({
        provider: "openai-compatible-chat-atria",
        model: "Atria-Dawn",
      });
  });

  it("keeps a reserved prefix on the built-in provider when both have credentials", async () => {
    const ctx = await setupDb();
    cleanup = ctx.cleanup;

    await ctx.createProviderNode({
      id: "openai-compatible-chat-atria",
      type: "openai-compatible",
      name: "Atria AI",
      prefix: "atria",
      apiType: "chat",
      baseUrl: "https://api.atria-asi.ai/v1",
    });
    await ctx.createProviderConnection({
      provider: "openai-compatible-chat-atria",
      authType: "apikey",
      name: "Atria key",
      apiKey: "sk-atria",
    });
    await ctx.createProviderConnection({
      provider: "atria",
      authType: "apikey",
      name: "Built-in Atria key",
      apiKey: "sk-builtin",
    });

    await expect(ctx.getModelInfo("atria/Atria-Dawn"))
      .resolves.toEqual({
        provider: "atria",
        model: "Atria-Dawn",
      });
  });

  it("keeps a credential-less reserved-prefix node behind the built-in provider", async () => {
    const ctx = await setupDb();
    cleanup = ctx.cleanup;

    await ctx.createProviderNode({
      id: "openai-compatible-chat-atria",
      type: "openai-compatible",
      name: "Atria AI",
      prefix: "atria",
      apiType: "chat",
      baseUrl: "https://api.atria-asi.ai/v1",
    });

    await expect(ctx.getModelInfo("atria/Atria-Dawn"))
      .resolves.toEqual({
        provider: "atria",
        model: "Atria-Dawn",
      });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiKeys: vi.fn(),
  getConsistentMachineId: vi.fn(),
  getProviderConnectionById: vi.fn(),
  updateProviderConnection: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getApiKeys: mocks.getApiKeys,
  getProviderConnectionById: mocks.getProviderConnectionById,
  updateProviderConnection: mocks.updateProviderConnection,
}));

vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: mocks.getConsistentMachineId,
}));

const originalFetch = global.fetch;

// OpenCode Free latches the caller IP out of the free tier when the dashboard
// probes it (429 FreeUsageLimitError / 403 FreeTierError), so no dashboard test
// path may reach upstream (Refs #79).
describe("OpenCode Free dashboard test guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiKeys.mockResolvedValue([]);
    mocks.getConsistentMachineId.mockResolvedValue("cli-token");
    mocks.updateProviderConnection.mockResolvedValue(undefined);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("refuses model pings for oc/* and opencode/* without touching the network", async () => {
    const { pingModelByKind } = await import("../../src/app/api/models/test/ping.js");

    for (const model of ["oc/muse-spark-1.3-contributor-free", "opencode/union-alpha"]) {
      for (const kind of ["llm", "systemone"]) {
        const result = await pingModelByKind(model, kind, "http://127.0.0.1:20127");
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/cannot be tested from the dashboard/i);
      }
    }

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("still probes other providers", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "hi" } }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const { pingModelByKind } = await import("../../src/app/api/models/test/ping.js");
    const result = await pingModelByKind("openai/gpt-4o", "llm", "http://127.0.0.1:20127");

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps an OpenCode Free connection test local and warning-flagged", async () => {
    mocks.getProviderConnectionById.mockResolvedValue({
      id: "conn-oc",
      provider: "opencode",
      authType: "apikey",
      apiKey: "",
      providerSpecificData: {},
    });

    const { testSingleConnection } = await import("../../src/app/api/providers/[id]/test/testUtils.js");
    // Some transitive modules patch global.fetch on import; install the spy after them.
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    const result = await testSingleConnection("conn-oc");

    expect(result.valid).toBe(true);
    expect(result.error).toMatch(/cannot be tested from the dashboard/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocks.updateProviderConnection).toHaveBeenCalledWith("conn-oc", expect.objectContaining({
      testStatus: "active",
    }));
  });
});

// Guards the NVIDIA 404 fix: clients dash version separators, NIM only serves the dotted id
// and answers anything else with a bare-text 404 "page not found".
import { describe, it, expect } from "vitest";
import { getModelUpstreamId, isValidModel } from "../../open-sse/config/providerModels.js";

describe("nvidia model ids", () => {
  it("resolves a dash-version client id to the dotted catalog id", () => {
    expect(getModelUpstreamId("nvidia", "z-ai/glm-5-3-flash")).toBe("z-ai/glm-5.3-flash");
    expect(isValidModel("nvidia", "z-ai/glm-5-3-flash")).toBe(true);
  });

  it("keeps a dotted catalog id verbatim", () => {
    expect(getModelUpstreamId("nvidia", "z-ai/glm-5.3-flash")).toBe("z-ai/glm-5.3-flash");
  });

  it("leaves an unlisted id alone", () => {
    expect(getModelUpstreamId("nvidia", "z-ai/glm-9-9")).toBe("z-ai/glm-9-9");
    expect(isValidModel("nvidia", "z-ai/glm-9-9")).toBe(false);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("HINDSIGHT_")) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("applies defaults", () => {
    const config = loadConfig();
    expect(config.retainMode).toBe("facts");
    expect(config.recallBudget).toBe("mid");
    expect(config.autoRecall).toBe(true);
    expect(config.autoRetain).toBe(true);
  });

  it("applies plugin options", () => {
    const config = loadConfig({ bankId: "my-project", recallBudget: "high" });
    expect(config.bankId).toBe("my-project");
    expect(config.recallBudget).toBe("high");
  });

  it("supports connection options in plugin options", () => {
    const configWithUrl = loadConfig({ hindsightApiUrl: "http://localhost:8888" });
    expect(configWithUrl.hindsightApiUrl).toBe("http://localhost:8888");
    expect(configWithUrl.hindsightApiToken).toBeNull();

    const configWithToken = loadConfig({
      hindsightApiUrl: "https://api.hindsight.vectorize.io",
      hindsightApiToken: "hz_secret",
    });
    expect(configWithToken.hindsightApiUrl).toBe("https://api.hindsight.vectorize.io");
    expect(configWithToken.hindsightApiToken).toBe("hz_secret");
  });

  it("applies environment variable overrides", () => {
    process.env.HINDSIGHT_BANK_ID = "env-bank";
    process.env.HINDSIGHT_AUTO_RECALL = "false";
    process.env.HINDSIGHT_RETAIN_EVERY_N_TURNS = "5";
    process.env.HINDSIGHT_RECALL_TAGS = "a,b,c";

    const config = loadConfig({ bankId: "opt-bank" });
    expect(config.bankId).toBe("env-bank");
    expect(config.autoRecall).toBe(false);
    expect(config.retainEveryNTurns).toBe(5);
    expect(config.recallTags).toEqual(["a", "b", "c"]);
  });

  it("falls back invalid enum values", () => {
    const config = loadConfig({
      retainMode: "invalid",
      recallBudget: "huge",
      recallTagsMatch: "maybe",
    });
    expect(config.retainMode).toBe("facts");
    expect(config.recallBudget).toBe("mid");
    expect(config.recallTagsMatch).toBe("any");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { deriveBankId } from "../../src/bank.js";

describe("deriveBankId", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    warnSpy.mockClear();
  });
  it("uses static bankId when dynamic is disabled", () => {
    const id = deriveBankId(
      {
        bankId: "my-project",
        bankIdPrefix: "",
        dynamicBankId: false,
        dynamicBankGranularity: ["agent", "project"],
        agentName: "opencode",
      },
      "/tmp/foo"
    );
    expect(id).toBe("my-project");
  });

  it("uses default bank name when none configured", () => {
    const id = deriveBankId(
      {
        bankId: null,
        bankIdPrefix: "",
        dynamicBankId: false,
        dynamicBankGranularity: ["agent", "project"],
        agentName: "opencode",
      },
      "/tmp/foo"
    );
    expect(id).toBe("opencode");
  });

  it("applies prefix", () => {
    const id = deriveBankId(
      {
        bankId: "my-project",
        bankIdPrefix: "prod",
        dynamicBankId: false,
        dynamicBankGranularity: ["agent", "project"],
        agentName: "opencode",
      },
      "/tmp/foo"
    );
    expect(id).toBe("prod-my-project");
  });

  it("composes dynamic bank id", () => {
    const id = deriveBankId(
      {
        bankId: null,
        bankIdPrefix: "",
        dynamicBankId: true,
        dynamicBankGranularity: ["agent", "project"],
        agentName: "reviewer",
      },
      "/tmp/foo"
    );
    expect(id).toBe("reviewer::foo");
  });

  it("ignores unknown granularity fields", () => {
    const id = deriveBankId(
      {
        bankId: null,
        bankIdPrefix: "",
        dynamicBankId: true,
        dynamicBankGranularity: ["agent", "unknown", "project"],
        agentName: "reviewer",
      },
      "/tmp/foo"
    );
    expect(id).toBe("reviewer::foo");
  });
});

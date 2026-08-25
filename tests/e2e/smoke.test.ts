import { describe, it, expect } from "vitest";

const pluginOptions = {
  hindsightApiUrl: "http://cerebro.tail7ad501.ts.net:8888",
  dynamicBankId: true,
  dynamicBankGranularity: ["agent", "gitProject"],
};

describe("OpenCode config smoke test", () => {
  it("plugin options are valid", () => {
    expect(pluginOptions.hindsightApiUrl).toBe("http://cerebro.tail7ad501.ts.net:8888");
    expect(pluginOptions.dynamicBankId).toBe(true);
    expect(pluginOptions.dynamicBankGranularity).toEqual(["agent", "gitProject"]);
  });

  it("imports the plugin entry point", async () => {
    const plugin = await import("../../dist/index.js");
    expect(typeof plugin.default).toBe("object");
    expect(plugin.default.id).toBe("hindsight");
    expect(typeof plugin.default.setup).toBe("function");
  });

  it("initializes with a mock OpenCode context using the project config", async () => {
    const plugin = (await import("../../dist/index.js")).default;

    const ctx: any = {
      options: pluginOptions,
      storage: {
        get: async () => undefined,
        set: async () => {},
      },
      worktree: "/Users/brycehamrick/src-local/opencode-v2-hindsight",
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      agent: {
        default: { id: "opencode" },
      },
      tool: {
        transform: async (cb: any) => {
          const draft = { add: () => {} };
          cb(draft);
        },
      },
      session: {
        hook: async (_name: string, _cb: any) => {
          return { dispose: async () => {} };
        },
      },
      event: {
        subscribe: ({ signal }: { signal: AbortSignal }) => {
          return {
            [Symbol.asyncIterator]: () => ({
              next: async () => {
                return new Promise((resolve) => {
                  const onAbort = () => resolve({ done: true, value: undefined });
                  if (signal.aborted) return onAbort();
                  signal.addEventListener("abort", onAbort, { once: true });
                });
              },
            }),
          };
        },
      },
    };

    const cleanup = await plugin.setup(ctx);
    expect(typeof cleanup).toBe("function");

    // Cleanup should not throw.
    await cleanup();
  });
});

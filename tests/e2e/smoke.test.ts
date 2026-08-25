import { describe, it, expect } from "vitest";

describe("OpenCode config smoke test", () => {
  it("loads the project opencode.json config and parses plugin options", async () => {
    const configPath = "/Users/brycehamrick/src-local/opencode-v2-hindsight/.opencode/opencode.json";
    const fs = await import("node:fs");
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);

    expect(config.$schema).toBe("https://opencode.ai/config.json");
    expect(Array.isArray(config.plugins)).toBe(true);
    expect(config.plugins.length).toBe(1);

    const plugin = config.plugins[0];
    expect(typeof plugin.package).toBe("string");
    expect(plugin.package).toContain("dist/index.js");
    expect(plugin.options.hindsightApiUrl).toBe("http://cerebro.tail7ad501.ts.net:8888");
    expect(plugin.options.dynamicBankId).toBe(true);
    expect(plugin.options.dynamicBankGranularity).toEqual(["agent", "gitProject"]);
  });

  it("imports the plugin entry point", async () => {
    const plugin = await import("../../dist/index.js");
    expect(typeof plugin.default).toBe("object");
    expect(plugin.default.id).toBe("hindsight");
    expect(typeof plugin.default.setup).toBe("function");
  });

  it("initializes with a mock OpenCode context using the project config", async () => {
    const plugin = (await import("../../dist/index.js")).default;
    const fs = await import("node:fs");
    const raw = fs.readFileSync(
      "/Users/brycehamrick/src-local/opencode-v2-hindsight/.opencode/opencode.json",
      "utf-8"
    );
    const options = JSON.parse(raw).plugins[0].options;

    const ctx: any = {
      options,
      storage: {
        get: async () => undefined,
        set: async () => {},
      },
      workspace: { directory: "/Users/brycehamrick/src-local/opencode-v2-hindsight" },
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

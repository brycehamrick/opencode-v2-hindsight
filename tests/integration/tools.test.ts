import { describe, it, expect, vi } from "vitest";
import { registerTools } from "../../src/tools/index.js";
import type { MemoryManager } from "../../src/memory/manager.js";

describe("registerTools", () => {
  it("registers all four hindsight tools", async () => {
    const added: any[] = [];
    const ctx = {
      tool: {
        transform: vi.fn((cb: any) => {
          const draft = {
            add: (tool: any) => {
              added.push(tool);
            },
          };
          cb(draft);
          return Promise.resolve();
        }),
      },
    };

    const memory: MemoryManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      getCoreMemories: vi.fn().mockResolvedValue([]),
      recallForMessage: vi.fn().mockResolvedValue([]),
      recallByQuery: vi.fn().mockResolvedValue([]),
      reflect: vi.fn().mockResolvedValue(""),
      retainTurns: vi.fn().mockResolvedValue(undefined),
      retainFact: vi.fn().mockResolvedValue(undefined),
      forget: vi.fn().mockResolvedValue(false),
      onCompaction: vi.fn().mockResolvedValue(null),
    };

    await registerTools(ctx as any, memory);

    const names = added.map((t) => t.name).sort();
    expect(names).toEqual(["hindsight_forget", "hindsight_recall", "hindsight_reflect", "hindsight_retain", "hindsight_status"]);
    for (const tool of added) {
      expect(tool.options?.namespace).toBe("hindsight");
      expect(tool.options?.codemode).toBe(true);
    }

    // Verify tags are passed as tags, not metadata.
    const retainTool = added.find((t) => t.name === "hindsight_retain");
    await retainTool.execute({ content: "test", tags: ["a", "b"] });
    expect(memory.retainFact).toHaveBeenCalledWith("test", undefined, undefined, ["a", "b"], undefined);
  });
});

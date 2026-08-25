import { describe, it, expect } from "vitest";
import { resolveWorkspaceDirectory } from "../../src/workspace.js";

describe("resolveWorkspaceDirectory", () => {
  it("prefers ctx.workspace when it points to a project root", () => {
    const dir = resolveWorkspaceDirectory({
      workspace: "/Users/brycehamrick/src-local/opencode-v2-hindsight",
    });
    expect(dir).toBe("/Users/brycehamrick/src-local/opencode-v2-hindsight");
  });

  it("resolves ctx.workspace.directory", () => {
    const dir = resolveWorkspaceDirectory({
      workspace: { directory: "/Users/brycehamrick/src-local/opencode-v2-hindsight" },
    });
    expect(dir).toBe("/Users/brycehamrick/src-local/opencode-v2-hindsight");
  });

  it("falls back to process.cwd()", () => {
    const dir = resolveWorkspaceDirectory({});
    expect(dir).toBe(process.cwd());
  });

  it("finds the project root from the plugin file location even when ctx.workspace is wrong", () => {
    const dir = resolveWorkspaceDirectory({ workspace: "/Users/brycehamrick" });
    expect(dir).toBe("/Users/brycehamrick/src-local/opencode-v2-hindsight");
  });
});

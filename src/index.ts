/**
 * Hindsight OpenCode V2 Plugin
 *
 * Token-efficient long-term memory for OpenCode agents.
 */

import { Plugin } from "@opencode-ai/plugin";
import { loadConfig, type HindsightPluginOptions } from "./config.js";
import { createMemoryManager } from "./memory/manager.js";
import { loadState, type StorageContext } from "./state.js";
import { registerTools } from "./tools/index.js";
import { registerHooks } from "./hooks/index.js";

export default Plugin.define({
  id: "hindsight",
  async setup(ctx) {
    const rawOptions = ((ctx as any).options ?? {}) as HindsightPluginOptions;
    const config = loadConfig(rawOptions);
    const state = await loadState(ctx.storage as StorageContext | undefined);

    const directory =
      typeof (ctx as any).workspace === "string"
        ? (ctx as any).workspace
        : (ctx as any).workspace?.directory ?? process.cwd();

    // Resolve the default agent name. OpenCode V2 exposes ctx.agent; fall back
    // to the configured agentName (or "opencode") when it is unavailable.
    const defaultAgentName =
      (ctx as any).agent?.default?.id ??
      (ctx as any).agent?.get?.("default")?.id ??
      config.agentName ??
      "opencode";

    const memory = createMemoryManager({
      config,
      state,
      directory,
      logger: (ctx as any).logger ?? console,
      storage: ctx.storage as StorageContext | undefined,
      defaultAgentName,
    });

    await memory.initialize(defaultAgentName);

    await registerTools(ctx, memory);
    const cleanupHooks = await registerHooks(ctx, memory);

    return () => {
      cleanupHooks?.();
      void memory.shutdown();
    };
  },
});

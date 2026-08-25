import type { PluginState } from "./types.js";

const STATE_KEY = "hindsight:state";

export interface StorageContext {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export async function loadState(storage?: StorageContext): Promise<PluginState> {
  const empty: PluginState = { missions: [], sessions: {} };
  if (!storage) return empty;

  try {
    const raw = await storage.get(STATE_KEY);
    if (!raw) return empty;
    const parsed = raw as PluginState;
    if (!parsed.missions) parsed.missions = [];
    if (!parsed.sessions) parsed.sessions = {};
    return parsed;
  } catch {
    return empty;
  }
}

export async function saveState(storage: StorageContext | undefined, state: PluginState): Promise<void> {
  if (!storage) return;
  await storage.set(STATE_KEY, state);
}

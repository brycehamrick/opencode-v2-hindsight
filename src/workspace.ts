import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PROJECT_MARKERS = [
  ".opencode/opencode.json",
  ".opencode/opencode.jsonc",
  "opencode.jsonc",
  "opencode.json",
];

function exists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function findGitRoot(startDir: string): string | null {
  if (!startDir) return null;
  try {
    const root = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      {
        cwd: startDir,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1000,
      }
    ).trim();
    if (!root) return null;
    if (root.endsWith("/.git")) {
      return dirname(root);
    }
    return root;
  } catch {
    return null;
  }
}

function findMarkerDir(startDir: string, marker: string): string | null {
  let dir = resolve(startDir);
  let last = "";
  while (dir !== last) {
    if (exists(join(dir, marker))) return dir;
    last = dir;
    dir = dirname(dir);
  }
  return null;
}

function findProjectRoot(startDir: string): string | null {
  if (!startDir) return null;

  // Prefer explicit project config markers.
  for (const marker of PROJECT_MARKERS) {
    const configDir = findMarkerDir(startDir, marker);
    if (configDir) return configDir;
  }

  // Fall back to git root.
  return findGitRoot(startDir);
}

/**
 * Resolve the most accurate workspace directory available.
 *
 * Order of preference:
 * 1. ctx.workspace (string or .directory)
 * 2. process.cwd()
 * 3. The directory containing this plugin file (useful for local plugin installs)
 * 4. Fallback to ctx.workspace or process.cwd()
 */
export function resolveWorkspaceDirectory(ctx: any): string {
  const candidates: string[] = [];

  const ctxWorkspace =
    typeof ctx?.workspace === "string"
      ? ctx.workspace
      : ctx?.workspace?.directory;
  if (ctxWorkspace) candidates.push(ctxWorkspace);

  if (typeof process !== "undefined" && process.cwd) {
    candidates.push(process.cwd());
  }

  // For local plugin installs, the plugin file lives inside the project.
  try {
    const pluginFile = fileURLToPath(import.meta.url);
    candidates.push(dirname(pluginFile));
  } catch {
    // Ignore if import.meta.url is unavailable.
  }

  for (const candidate of candidates) {
    const root = findProjectRoot(candidate);
    if (root) return root;
  }

  return ctxWorkspace || process.cwd();
}

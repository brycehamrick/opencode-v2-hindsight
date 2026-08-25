import { basename, dirname } from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_BANK_NAME = "opencode";
const VALID_FIELDS = new Set(["agent", "project", "gitProject", "channel", "user"]);

export interface BankConfig {
  bankId: string | null;
  bankIdPrefix: string;
  dynamicBankId: boolean;
  dynamicBankGranularity: ("agent" | "project" | "gitProject" | "channel" | "user")[];
  agentName: string;
}

function getProjectRootFromGit(directory: string): string | null {
  if (!directory) return null;
  try {
    const commonDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      {
        cwd: directory,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1000,
      }
    ).trim();
    if (!commonDir) return null;

    if (basename(commonDir) === ".git") {
      return dirname(commonDir);
    }

    if (basename(commonDir).startsWith(".") && isBareRepository(commonDir)) {
      return dirname(commonDir);
    }

    return commonDir;
  } catch {
    return null;
  }
}

function isBareRepository(commonDir: string): boolean {
  try {
    return (
      execFileSync("git", ["-C", commonDir, "rev-parse", "--is-bare-repository"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1000,
        env: { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined },
      }).trim() === "true"
    );
  } catch {
    return false;
  }
}

function deriveGitProjectName(directory: string): string {
  const projectRoot = getProjectRootFromGit(directory);
  if (projectRoot) return basename(projectRoot);
  return directory ? basename(directory) : "unknown";
}

export function deriveBankId(config: BankConfig, directory: string): string {
  const prefix = config.bankIdPrefix;

  if (!config.dynamicBankId) {
    const base = config.bankId || DEFAULT_BANK_NAME;
    return prefix ? `${prefix}-${base}` : base;
  }

  const fields = config.dynamicBankGranularity?.length
    ? config.dynamicBankGranularity
    : ["agent", "project"];

  for (const f of fields) {
    if (!VALID_FIELDS.has(f)) {
      // Unknown fields are logged but ignored to keep the plugin functional.
      console.warn(`[Hindsight] Unknown dynamicBankGranularity field "${f}" — ignoring`);
    }
  }

  const channelId = process.env.HINDSIGHT_CHANNEL_ID || "";
  const userId = process.env.HINDSIGHT_USER_ID || "";

  const fieldResolvers: Record<string, () => string> = {
    agent: () => config.agentName || "opencode",
    project: () => (directory ? basename(directory) : "unknown"),
    gitProject: () => deriveGitProjectName(directory),
    channel: () => channelId || "default",
    user: () => userId || "anonymous",
  };

  const segments = fields
    .filter((f) => VALID_FIELDS.has(f))
    .map((f) => fieldResolvers[f]?.() || "unknown");

  const baseBankId = segments.join("::");
  return prefix ? `${prefix}-${baseBankId}` : baseBankId;
}

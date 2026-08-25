import type { Message, RecallResult } from "../types.js";
import type { Logger } from "../logger.js";
import type { HindsightConfig } from "../config.js";
import type { HindsightClientWrapper } from "./client.js";
import {
  composeRecallQuery,
  truncateRecallQuery,
  formatMemories,
  formatMemoryContext,
  formatCurrentTime,
} from "./content.js";
import { budgetToTokens, trimMemoriesToBudget } from "./tokens.js";

export interface RecallEngine {
  recallCoreMemories(): Promise<RecallResult[]>;
  recallForMessage(message: string, recentMessages: Message[]): Promise<RecallResult[]>;
  recallByQuery(query: string, maxTokens?: number): Promise<RecallResult[]>;
  recallForCompaction(query: string): Promise<RecallResult[]>;
}

export function createRecallEngine(
  client: HindsightClientWrapper,
  bankId: string,
  config: HindsightConfig,
  logger: Logger
): RecallEngine {
  async function callRecall(
    query: string,
    maxTokens: number,
    types?: string[],
    tags?: string[],
    tagsMatch?: HindsightConfig["recallTagsMatch"]
  ): Promise<RecallResult[]> {
    try {
      const response = await client.recall(bankId, query, {
        budget: config.recallBudget,
        maxTokens,
        types,
        tags,
        tagsMatch: tagsMatch ?? config.recallTagsMatch,
      });
      return (response.results || []).map((r) => ({
        text: r.text,
        type: r.type ?? null,
        mentioned_at: r.mentioned_at ?? null,
        metadata: r.metadata ?? {},
      }));
    } catch (error) {
      logger.error("Recall failed", { error: String(error), query });
      return [];
    }
  }

  async function recallCoreMemories(): Promise<RecallResult[]> {
    if (!config.autoRecall) return [];
    const maxTokens = Math.min(config.coreMemoryMaxTokens, budgetToTokens(config.recallBudget));
    // Hindsight's supported fact types are experience/opinion/world, so we
    // identify core memories by the "core" tag rather than by type.
    const results = await callRecall(
      "core memories user preferences project conventions persistent decisions",
      maxTokens,
      ["world"],
      ["core"],
      "any_strict"
    );
    return deduplicateByText(trimMemoriesToBudget(results, config.coreMemoryMaxTokens));
  }

  async function recallForMessage(
    message: string,
    recentMessages: Message[]
  ): Promise<RecallResult[]> {
    if (!config.autoRecall) return [];

    const composed = composeRecallQuery(message, recentMessages, config.recallContextTurns);
    const query = truncateRecallQuery(composed, message, config.recallMaxQueryChars);

    const maxTokens = Math.min(
      config.perMessageRecallMaxTokens,
      budgetToTokens(config.recallBudget)
    );

    const results = await callRecall(
      query,
      maxTokens,
      config.recallTypes,
      config.recallTags.length ? config.recallTags : undefined
    );

    return deduplicateByText(trimMemoriesToBudget(results, config.perMessageRecallMaxTokens));
  }

  async function recallByQuery(query: string, maxTokens?: number): Promise<RecallResult[]> {
    const effectiveMaxTokens = maxTokens ?? config.perMessageRecallMaxTokens;
    const results = await callRecall(
      query,
      Math.min(effectiveMaxTokens, budgetToTokens(config.recallBudget)),
      config.recallTypes,
      config.recallTags.length ? config.recallTags : undefined
    );
    return deduplicateByText(trimMemoriesToBudget(results, effectiveMaxTokens));
  }

  async function recallForCompaction(query: string): Promise<RecallResult[]> {
    const maxTokens = Math.min(
      config.compactionRecallMaxTokens,
      budgetToTokens(config.recallBudget)
    );
    const results = await callRecall(
      query,
      maxTokens,
      config.recallTypes,
      config.recallTags.length ? config.recallTags : undefined
    );
    return deduplicateByText(trimMemoriesToBudget(results, config.compactionRecallMaxTokens));
  }

  return {
    recallCoreMemories,
    recallForMessage,
    recallByQuery,
    recallForCompaction,
  };
}

function deduplicateByText<T extends { text: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.text.trim().toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export { formatMemories, formatMemoryContext, formatCurrentTime };

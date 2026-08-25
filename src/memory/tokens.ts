/**
 * Token budgeting utilities.
 *
 * Hindsight's recall budget maps to approximate token ranges.
 * We use these to cap injected context locally.
 */

export type RecallBudget = "low" | "mid" | "high";

const BUDGET_TO_TOKENS: Record<RecallBudget, number> = {
  low: 256,
  mid: 512,
  high: 1024,
};

export function budgetToTokens(budget: RecallBudget): number {
  return BUDGET_TO_TOKENS[budget] ?? BUDGET_TO_TOKENS.mid;
}

export function estimateTokens(text: string): number {
  // Very rough approximation: ~4 characters per token for English/code text.
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateChars(tokens: number): number {
  return tokens * 4;
}

export interface MemoryBudget {
  coreMemory: number;
  perMessageRecall: number;
  compactionRecall: number;
}

export function trimMemoriesToBudget(
  memories: { text: string; type?: string | null }[],
  maxTokens: number
): { text: string; type?: string | null }[] {
  if (maxTokens <= 0) return [];

  const result: { text: string; type?: string | null }[] = [];
  let usedTokens = 0;

  for (const memory of memories) {
    const tokens = estimateTokens(memory.text);
    if (usedTokens + tokens > maxTokens) {
      const remainingTokens = maxTokens - usedTokens;
      if (remainingTokens > 10) {
        const chars = estimateChars(remainingTokens - 1);
        result.push({ ...memory, text: memory.text.slice(0, chars) + "..." });
      }
      break;
    }
    result.push(memory);
    usedTokens += tokens;
  }

  return result;
}

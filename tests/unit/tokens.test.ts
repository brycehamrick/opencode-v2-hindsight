import { describe, it, expect } from "vitest";
import { budgetToTokens, estimateTokens, trimMemoriesToBudget } from "../../src/memory/tokens.js";

describe("token budgeting", () => {
  it("maps budgets to tokens", () => {
    expect(budgetToTokens("low")).toBe(256);
    expect(budgetToTokens("mid")).toBe(512);
    expect(budgetToTokens("high")).toBe(1024);
  });

  it("estimates tokens from characters", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("trims memories to budget", () => {
    const memories = Array.from({ length: 10 }, (_, i) => ({
      text: `memory ${i} ${"x".repeat(100)}`,
    }));
    const trimmed = trimMemoriesToBudget(memories, 100);
    let totalTokens = 0;
    for (const m of trimmed) {
      totalTokens += estimateTokens(m.text);
    }
    expect(totalTokens).toBeLessThanOrEqual(110);
  });

  it("returns empty when budget is zero", () => {
    expect(trimMemoriesToBudget([{ text: "foo" }], 0)).toEqual([]);
  });
});

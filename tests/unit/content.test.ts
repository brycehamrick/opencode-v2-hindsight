import { describe, it, expect } from "vitest";
import {
  stripMemoryTags,
  stripSecrets,
  stripBase64,
  sanitizeForRetention,
  composeRecallQuery,
  truncateRecallQuery,
  sliceLastTurnsByUserBoundary,
  formatMemories,
  formatMemoryContext,
  estimateTokens,
  truncateToApproxTokens,
} from "../../src/memory/content.js";
import type { Message } from "../../src/types.js";

describe("content processing", () => {
  describe("stripMemoryTags", () => {
    it("removes hindsight memory blocks", () => {
      const content = `Hello <hindsight_memories>\n- old fact\n</hindsight_memories> world`;
      expect(stripMemoryTags(content)).toBe("Hello world");
    });

    it("removes relevant memory blocks", () => {
      const content = `Start <relevant_memories>foo</relevant_memories> end`;
      expect(stripMemoryTags(content)).toBe("Start end");
    });
  });

  describe("stripSecrets", () => {
    it("redacts bearer tokens", () => {
      const content = `Authorization: Bearer sk-abc123xyz`;
      expect(stripSecrets(content)).toContain("[REDACTED_AUTH]");
      expect(stripSecrets(content)).not.toContain("sk-abc123xyz");
    });

    it("redacts api keys", () => {
      const content = `api_key = "supersecretvalue12345"`;
      expect(stripSecrets(content)).toContain("[REDACTED_SECRET]");
    });

    it("redacts github tokens", () => {
      const content = `token ghp_abcdef012345678901234567890123456789`;
      expect(stripSecrets(content)).toContain("[REDACTED_GITHUB_TOKEN]");
    });
  });

  describe("stripBase64", () => {
    it("collapses long base64 blobs", () => {
      const base64 = "a".repeat(200);
      expect(stripBase64(base64)).toBe("[BASE64:200chars]");
    });

    it("leaves short strings alone", () => {
      expect(stripBase64("short")).toBe("short");
    });
  });

  describe("sanitizeForRetention", () => {
    it("applies all sanitizers and truncates", () => {
      const content = `User said: hello <hindsight_memories>old</hindsight_memories> token: sk-abc123 ${"word ".repeat(500)}`;
      const result = sanitizeForRetention(content, {
        stripSecrets: true,
        stripBase64: true,
        maxLength: 100,
      });
      expect(result).not.toContain("sk-abc123");
      expect(result).not.toContain("<hindsight_memories>");
      expect(result.length).toBeLessThanOrEqual(120);
      expect(result.endsWith("...[truncated]")).toBe(true);
    });
  });

  describe("composeRecallQuery", () => {
    it("returns latest query only when context turns is 1", () => {
      const messages: Message[] = [
        { role: "user", content: "first" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "second" },
      ];
      expect(composeRecallQuery("second", messages, 1)).toBe("second");
    });

    it("includes prior context when context turns > 1", () => {
      const messages: Message[] = [
        { role: "user", content: "first" },
        { role: "assistant", content: "answer one" },
        { role: "user", content: "second" },
        { role: "assistant", content: "answer two" },
        { role: "user", content: "third" },
      ];
      const query = composeRecallQuery("third", messages, 3);
      expect(query).toContain("Prior context:");
      expect(query).toContain("third");
      expect(query).toContain("second");
    });
  });

  describe("truncateRecallQuery", () => {
    it("returns original if within budget", () => {
      const query = "hello world";
      expect(truncateRecallQuery(query, "hello world", 100)).toBe(query);
    });

    it("drops oldest context lines first", () => {
      const query = "Prior context:\n\none\ntwo\n\nlatest";
      const result = truncateRecallQuery(query, "latest", 40);
      expect(result).toContain("latest");
      expect(result.length).toBeLessThanOrEqual(40);
    });
  });

  describe("sliceLastTurnsByUserBoundary", () => {
    it("slices from the last N user turns", () => {
      const messages: Message[] = [
        { role: "user", content: "1" },
        { role: "assistant", content: "a" },
        { role: "user", content: "2" },
        { role: "assistant", content: "b" },
        { role: "user", content: "3" },
      ];
      const sliced = sliceLastTurnsByUserBoundary(messages, 2);
      expect(sliced.length).toBe(3);
      expect(sliced[0].content).toBe("2");
    });
  });

  describe("formatMemories", () => {
    it("formats results as bullets", () => {
      const results = [{ text: "fact one", type: "fact" }, { text: "fact two" }];
      const formatted = formatMemories(results);
      expect(formatted).toContain("- fact one [fact]");
      expect(formatted).toContain("- fact two");
    });
  });

  describe("formatMemoryContext", () => {
    it("returns null for empty results", () => {
      expect(formatMemoryContext([])).toBeNull();
    });

    it("respects token budget", () => {
      const results = Array.from({ length: 20 }, (_, i) => ({ text: `memory ${i} ${"x".repeat(100)}` }));
      const context = formatMemoryContext(results, { maxTokens: 50 });
      expect(context).not.toBeNull();
      expect(context!.length).toBeLessThan(300);
    });
  });

  describe("token helpers", () => {
    it("estimates tokens", () => {
      expect(estimateTokens("x".repeat(400))).toBe(100);
    });

    it("truncates to approximate tokens", () => {
      const text = Array.from({ length: 20 }, (_, i) => `line ${i} ${"x".repeat(50)}`).join("\n");
      const truncated = truncateToApproxTokens(text, 50);
      expect(estimateTokens(truncated)).toBeLessThanOrEqual(55);
    });
  });
});

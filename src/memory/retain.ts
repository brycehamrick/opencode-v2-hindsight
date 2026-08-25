import type { Message, PluginState, SessionState } from "../types.js";
import type { Logger } from "../logger.js";
import type { HindsightConfig } from "../config.js";
import type { HindsightClientWrapper } from "./client.js";
import { sanitizeForRetention, sliceLastTurnsByUserBoundary, stripMemoryTags } from "./content.js";

export interface RetentionEngine {
  retainFact(
    fact: string,
    context?: string,
    metadata?: Record<string, string>,
    tags?: string[]
  ): Promise<void>;
  retainTurns(sessionId: string, turns: Message[], state: SessionState): Promise<SessionState>;
  deleteByDocumentId(documentId: string): Promise<boolean>;
  deleteByQuery(query: string): Promise<boolean>;
}

export function createRetentionEngine(
  client: HindsightClientWrapper,
  bankId: string,
  config: HindsightConfig,
  logger: Logger
): RetentionEngine {
  const pendingRetains = new Set<string>();

  async function retainFact(
    fact: string,
    context?: string,
    metadata: Record<string, string> = {},
    tags?: string[]
  ): Promise<void> {
    const content = sanitizeForRetention(fact, {
      stripSecrets: config.stripSecrets,
      stripBase64: config.stripBase64,
      maxLength: config.maxRetainedMessageLength,
    });
    if (!content) {
      logger.debug("Skipping empty fact after sanitization");
      return;
    }

    const documentId = `fact-${hashContent(content)}`;
    const key = `${bankId}:${documentId}`;
    if (pendingRetains.has(key)) {
      logger.debug("Skipping duplicate in-flight fact retain", { documentId });
      return;
    }
    pendingRetains.add(key);

    try {
      await client.retain(bankId, content, {
        context: context || config.retainContext,
        documentId,
        tags: [...config.retainTags, "fact", "tool", ...(tags ?? [])],
        metadata: { ...config.retainMetadata, ...metadata },
        async: true,
      });
      logger.debug("Retained fact", { documentId, length: content.length });
    } finally {
      pendingRetains.delete(key);
    }
  }

  async function retainTurns(
    sessionId: string,
    turns: Message[],
    state: SessionState
  ): Promise<SessionState> {
    if (!config.autoRetain || config.retainMode === "none" || !turns.length) {
      return state;
    }

    if (config.retainMode === "facts") {
      return await retainFactsFromTurns(sessionId, turns, state);
    }

    return await retainTranscriptChunks(sessionId, turns, state);
  }

  async function retainFactsFromTurns(
    sessionId: string,
    turns: Message[],
    state: SessionState
  ): Promise<SessionState> {
    const userTurns = turns.filter((m) => m.role === "user").length;
    if (userTurns - state.lastRetainedTurn < config.retainEveryNTurns) {
      return state;
    }

    const windowTurns = config.retainEveryNTurns + config.retainOverlapTurns;
    const targetMessages = sliceLastTurnsByUserBoundary(turns, windowTurns);
    const facts = extractAtomicFacts(targetMessages, config.extractionMaxTokens);

    let retained = 0;
    for (const fact of facts) {
      const content = sanitizeForRetention(fact, {
        stripSecrets: config.stripSecrets,
        stripBase64: config.stripBase64,
        maxLength: config.maxRetainedMessageLength,
      });
      if (!content) continue;

      const documentId = `fact-${hashContent(content)}`;
      const key = `${bankId}:${documentId}`;
      if (pendingRetains.has(key)) continue;
      pendingRetains.add(key);

      try {
        await client.retain(bankId, content, {
          context: config.retainContext,
          documentId,
          tags: [...config.retainTags, "fact", "auto"],
          metadata: {
            ...config.retainMetadata,
            session_id: sessionId,
            retained_at: new Date().toISOString(),
          },
          async: true,
        });
        retained++;
      } finally {
        pendingRetains.delete(key);
      }
    }

    logger.debug("Retained atomic facts", { sessionId, retained, userTurns });
    return { ...state, lastRetainedTurn: userTurns };
  }

  async function retainTranscriptChunks(
    sessionId: string,
    turns: Message[],
    state: SessionState
  ): Promise<SessionState> {
    const userTurns = turns.filter((m) => m.role === "user").length;
    if (userTurns - state.lastRetainedTurn < config.retainEveryNTurns) {
      return state;
    }

    const retainFullWindow = config.retainMode === "transcript"; // always chunked in this engine
    let targetMessages: Message[];
    let documentId: string;

    if (retainFullWindow) {
      targetMessages = turns;
      documentId = sessionId;
    } else {
      const windowTurns = config.retainEveryNTurns + config.retainOverlapTurns;
      targetMessages = sliceLastTurnsByUserBoundary(turns, windowTurns);
      documentId = `${sessionId}-${userTurns}`;
    }

    // Delete the previous chunked transcript so we don't accumulate overlapping chunks.
    if (state.lastTranscriptDocumentId && state.lastTranscriptDocumentId !== documentId) {
      try {
        await client.deleteDocument(bankId, state.lastTranscriptDocumentId);
      } catch {
        // Ignore delete failures; the chunk will simply coexist.
      }
    }

    const parts: string[] = [];
    for (const msg of targetMessages) {
      const content = sanitizeForRetention(msg.content, {
        stripSecrets: config.stripSecrets,
        stripBase64: config.stripBase64,
        maxLength: config.maxRetainedMessageLength,
      });
      if (!content) continue;
      parts.push(`[role: ${msg.role}]\n${content}\n[${msg.role}:end]`);
    }

    if (!parts.length) return state;

    const transcript = parts.join("\n\n");
    if (transcript.trim().length < 10) return state;

    await client.retain(bankId, transcript, {
      context: config.retainContext,
      documentId,
      tags: [...config.retainTags, "transcript", "auto"],
      metadata: {
        ...config.retainMetadata,
        session_id: sessionId,
        user_turns: String(userTurns),
        retained_at: new Date().toISOString(),
      },
      async: true,
    });

    logger.debug("Retained transcript chunk", { sessionId, documentId, userTurns });
    return { ...state, lastRetainedTurn: userTurns, lastTranscriptDocumentId: documentId };
  }

  async function deleteByDocumentId(documentId: string): Promise<boolean> {
    return await client.deleteDocument(bankId, documentId);
  }

  async function deleteByQuery(_query: string): Promise<boolean> {
    // The Hindsight client does not expose a query-based delete in the V1 package.
    // In the future this can use a delete-by-query API if available.
    logger.warn("deleteByQuery is not supported by the current Hindsight client");
    return false;
  }

  return {
    retainFact,
    retainTurns,
    deleteByDocumentId,
    deleteByQuery,
  };
}

function hashContent(content: string): string {
  // Simple stable hash for deterministic document IDs.
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function extractAtomicFacts(messages: Message[], _maxTokens: number): string[] {
  // MVP: turn the last user/assistant exchange into one or two atomic facts.
  // A future version can use a lightweight LLM call for richer extraction.
  const facts: string[] = [];
  let currentTurn: Message[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    currentTurn.unshift(msg);
    if (msg.role === "user") break;
  }

  if (!currentTurn.length) return facts;

  const userMsg = currentTurn.find((m) => m.role === "user");
  const assistantMsg = currentTurn.find((m) => m.role === "assistant");

  if (userMsg && assistantMsg) {
    const fact = stripMemoryTags(
      `User asked: ${userMsg.content.trim()}\nAssistant concluded: ${assistantMsg.content.trim()}`
    );
    facts.push(fact);
  } else if (userMsg) {
    facts.push(stripMemoryTags(userMsg.content.trim()));
  }

  return facts;
}

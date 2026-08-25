import { HindsightClient } from "@vectorize-io/hindsight-client";
import type { Logger } from "../logger.js";
import type { RecallBudget } from "./tokens.js";

export interface HindsightClientConfig {
  baseUrl: string;
  apiKey: string | null;
  logger: Logger;
}

export interface RecallOptions {
  budget: RecallBudget;
  maxTokens?: number;
  types?: string[];
  tags?: string[];
  tagsMatch?: "any" | "all" | "any_strict" | "all_strict";
}

export interface RetainOptions {
  context?: string;
  documentId?: string;
  tags?: string[];
  metadata?: Record<string, string>;
  async?: boolean;
}

export interface ReflectOptions {
  context?: string;
  budget?: RecallBudget;
}

export interface RecallResponse {
  results: { text: string; type?: string | null; mentioned_at?: string | null; metadata?: Record<string, string> | null }[];
}

export interface ReflectResponse {
  text: string | null;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  logger: Logger,
  retries = 3,
  baseDelayMs = 250
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isRetryable = isRetryableError(error);
      if (!isRetryable || attempt === retries - 1) break;
      const delay = baseDelayMs * 2 ** attempt;
      logger.debug("Hindsight API call failed, retrying", { attempt: attempt + 1, delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { status?: number }).status;
    if (status && status >= 500) return true;
    const code = (error as { code?: string }).code;
    if (code && ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"].includes(code)) return true;
  }
  return false;
}

export function createHindsightClientWrapper(config: HindsightClientConfig): HindsightClientWrapper {
  return new HindsightClientWrapper(config);
}

export class HindsightClientWrapper {
  private readonly client: HindsightClient;
  private readonly logger: Logger;
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(config: HindsightClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey || null;
    this.client = new HindsightClient({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey || undefined,
    });
    this.logger = config.logger;
  }

  async createBank(
    bankId: string,
    options: { reflectMission?: string; retainMission?: string } = {}
  ): Promise<void> {
    await withRetry(
      () => this.client.createBank(bankId, options),
      this.logger
    );
  }

  async recall(bankId: string, query: string, options: RecallOptions): Promise<RecallResponse> {
    return await withRetry(
      () =>
        this.client.recall(bankId, query, {
          budget: options.budget,
          maxTokens: options.maxTokens,
          types: options.types,
          tags: options.tags,
          tagsMatch: options.tagsMatch,
        }),
      this.logger
    );
  }

  async retain(bankId: string, content: string, options: RetainOptions = {}): Promise<void> {
    await withRetry(
      () =>
        this.client.retain(bankId, content, {
          context: options.context,
          documentId: options.documentId,
          tags: options.tags,
          metadata: options.metadata,
          async: options.async,
        }),
      this.logger
    );
  }

  async reflect(bankId: string, query: string, options: ReflectOptions = {}): Promise<ReflectResponse> {
    return await withRetry(
      () =>
        this.client.reflect(bankId, query, {
          context: options.context,
          budget: options.budget,
        }),
      this.logger
    );
  }

  async deleteDocument(bankId: string, documentId: string): Promise<boolean> {
    const clientDelete = (this.client as any).deleteDocument;
    if (typeof clientDelete === "function") {
      await withRetry(() => clientDelete.call(this.client, bankId, documentId), this.logger);
      return true;
    }

    // Fallback to a direct REST call if the installed client version does not
    // expose deleteDocument (e.g. older hindsight-client packages).
    await withRetry(() => this.deleteDocumentViaFetch(bankId, documentId), this.logger);
    return true;
  }

  private async deleteDocumentViaFetch(bankId: string, documentId: string): Promise<void> {
    const url = `${this.baseUrl}/v1/default/banks/${encodeURIComponent(bankId)}/documents/${encodeURIComponent(documentId)}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const response = await fetch(url, { method: "DELETE", headers });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`deleteDocument failed: ${response.status} ${body}`);
    }
  }
}

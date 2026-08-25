export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp?: string;
}

export interface RecallResult {
  text: string;
  type?: string | null;
  mentioned_at?: string | null;
  score?: number;
  documentId?: string;
  metadata?: Record<string, string>;
}

export interface PluginState {
  missions: string[];
  sessions: Record<string, SessionState>;
}

export interface SessionState {
  lastRetainedTurn: number;
  lastRecallQuery?: string;
  lastRecallAt?: number;
  lastTranscriptDocumentId?: string;
}

# @vectorize-io/opencode-v2-hindsight

A best-in-class, token-efficient long-term memory plugin for [OpenCode V2](https://opencode.ai).

## Features

- **Per-message recall** — memories are fetched for the *current* user message, not just at session start.
- **Core memory** — a small, always-injected block of high-stability facts (preferences, conventions).
- **Per-agent scoping** — different OpenCode agents can have isolated memory banks.
- **Smart retention** — defaults to retaining atomic facts instead of full transcripts.
- **Token budgets** — caps injected memory per turn to avoid wasting tokens.
- **Safety** — strips secrets, API keys, base64 blobs, and large tool outputs before retention.
- **Durable state** — plugin state survives restarts via `ctx.storage`.
- **Explicit tools** — `hindsight_retain`, `hindsight_recall`, `hindsight_reflect`, `hindsight_forget`.
- **Self-hosted or hosted** — works with your own Hindsight instance or Hindsight Cloud.

## Installation

Add to your OpenCode V2 config (`opencode.jsonc`):

```jsonc
{
  "plugins": [
    {
      "package": "@vectorize-io/opencode-v2-hindsight",
      "options": {
        "bankId": "my-project"
      }
    }
  ]
}
```

## Hindsight Cloud (hosted)

Set your API token:

```bash
export HINDSIGHT_API_TOKEN="hz_..."
```

The default endpoint is `https://api.hindsight.vectorize.io`.

## Self-hosted Hindsight

Point the plugin at your local server and omit the API token:

```jsonc
{
  "plugins": [
    {
      "package": "@vectorize-io/opencode-v2-hindsight",
      "options": {
        "hindsightApiUrl": "http://localhost:8888",
        "hindsightApiToken": null
      }
    }
  ]
}
```

## Per-agent scoping

OpenCode V2 supports multiple agents. To give each agent its own memory bank, enable dynamic bank IDs and include `agent` in the granularity:

```jsonc
{
  "plugins": [
    {
      "package": "@vectorize-io/opencode-v2-hindsight",
      "options": {
        "dynamicBankId": true,
        "dynamicBankGranularity": ["agent", "project"]
      }
    }
  ]
}
```

With this config a session running the `reviewer` agent gets bank `reviewer::my-project`, while a session running the `debugger` agent gets `debugger::my-project`. Memories never leak across agents.

The agent name is resolved in this order:
1. The active agent from the OpenCode session/event (`event.agent.id` or `event.session.agent.id`)
2. `ctx.agent.default.id` at plugin setup
3. The `agentName` plugin option
4. Fallback `"opencode"`

All explicit tools accept an optional `agent` parameter to target a specific agent's bank.

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `hindsightApiUrl` | `https://api.hindsight.vectorize.io` | Hindsight API base URL |
| `hindsightApiToken` | `null` | API token (`null` for self-hosted) |
| `bankId` | `null` | Static bank ID |
| `bankIdPrefix` | `""` | Prefix added to derived bank IDs |
| `dynamicBankId` | `false` | Derive bank ID from agent/project/etc. |
| `dynamicBankGranularity` | `["agent", "project"]` | Fields for dynamic bank ID |
| `agentName` | `"opencode"` | Default agent name fallback |
| `bankMission` | `""` | Mission set when creating a bank |
| `retainMission` | `null` | Retain mission for the bank |
| `autoRecall` | `true` | Recall memories per user message |
| `autoRetain` | `true` | Retain conversation automatically |
| `retainMode` | `"facts"` | `"facts"`, `"transcript"`, or `"none"` |
| `coreMemoryMaxTokens` | `256` | Max tokens for always-injected core memory |
| `perMessageRecallMaxTokens` | `512` | Max tokens recalled per user message |
| `compactionRecallMaxTokens` | `512` | Max tokens recalled during compaction |
| `extractionMaxTokens` | `256` | Max tokens for extracted facts |
| `recallBudget` | `"mid"` | Hindsight recall budget (`low`/`mid`/`high`) |
| `recallContextTurns` | `2` | User turns included in recall query context |
| `recallMaxQueryChars` | `800` | Max characters in composed recall query |
| `recallPromptPreamble` | (see source) | Preamble prepended to injected memory context |
| `recallTypes` | `["world", "experience"]` | Memory types to recall |
| `recallTags` | `[]` | Tags to filter recall |
| `recallTagsMatch` | `"any"` | Tag matching mode |
| `retainContext` | `"opencode"` | Default context for retained memories |
| `retainEveryNTurns` | `3` | Retain every N user turns |
| `retainOverlapTurns` | `2` | Overlap turns between retention windows |
| `retainTags` | `[]` | Tags added to retained memories |
| `retainMetadata` | `{}` | Metadata added to retained memories |
| `stripSecrets` | `true` | Remove secrets before retention |
| `stripBase64` | `true` | Collapse large base64 blobs |
| `maxRetainedMessageLength` | `4000` | Max characters of any retained message |
| `debug` | `false` | Enable debug logging |

Environment variables override plugin options: `HINDSIGHT_API_URL`, `HINDSIGHT_API_TOKEN`, `HINDSIGHT_BANK_ID`, `HINDSIGHT_AGENT_NAME`, `HINDSIGHT_AUTO_RECALL`, `HINDSIGHT_RETAIN_MODE`, etc.

## Tools

- `hindsight_retain(content, context?, tags?, agent?)` — store a fact or decision.
- `hindsight_recall(query, maxTokens?, agent?)` — search memory.
- `hindsight_reflect(query, context?, agent?)` — synthesize an answer from memory.
- `hindsight_forget(documentId?, query?, agent?)` — remove a memory by document ID.

## Development

```bash
npm install
npm test
npm run build
```

## Status

This plugin targets OpenCode V2 and is **not** compatible with OpenCode V1. It is ready for local integration testing; E2E tests against a live Hindsight instance are still pending.

## License

MIT

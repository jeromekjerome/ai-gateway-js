# ai-gateway-js

> Lightweight multi-provider LLM routing for Node.js — OpenAI, Anthropic, and Google with priority routing, automatic fallback, cost tracking, and latency optimization. **Zero dependencies.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-blue)](https://www.typescriptlang.org) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why

Modern AI applications can't afford a single point of failure. When OpenAI is down, your app shouldn't be. When Gemini is cheaper for your workload, you should know. `ai-gateway-js` gives you a single unified interface across all major LLM providers — with smart routing baked in.

Built from production patterns across a portfolio of legal-AI, hospitality-tech, and content-pipeline applications at [AI Strategies NYC](https://aistrategiesnyc.com).

## Features

- **Multi-provider** — OpenAI (GPT-4o, GPT-4o-mini), Anthropic (Claude 3/3.5), Google (Gemini)
- **4 routing strategies** — `priority`, `round-robin`, `lowest-cost`, `lowest-latency`
- **Automatic fallback** — retry on the next provider when the primary fails
- **Cost tracking** — per-provider USD cost tracking using configurable token prices
- **Latency tracking** — running average latency per provider; drives `lowest-latency` routing
- **Timeout control** — configurable per-gateway request timeout
- **TypeScript-first** — complete type coverage, no `any`
- **Zero dependencies** — uses only the native `fetch` API (Node 18+)

## Install

```bash
npm install ai-gateway-js
```

## Quick Start

```typescript
import { AIGateway } from 'ai-gateway-js';

const gateway = new AIGateway({
  strategy: 'priority',
  fallback: true,
  providers: [
    {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: 'claude-3-haiku-20240307',
      priority: 10,
      costPerInputToken: 0.00000025,
      costPerOutputToken: 0.00000125,
    },
    {
      name: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini',
      priority: 5,
      costPerInputToken: 0.00000015,
      costPerOutputToken: 0.0000006,
    },
  ],
});

const response = await gateway.complete({
  messages: [
    { role: 'system', content: 'You are a concise assistant.' },
    { role: 'user', content: 'What are the main principles of REST?' },
  ],
});

console.log(response.content);
console.log(response.provider);   // 'anthropic' (or 'openai' on fallback)
console.log(response.latencyMs);  // e.g. 423
console.log(response.cost);       // e.g. 0.000031
```

## Routing Strategies

| Strategy | Behavior |
|---|---|
| `priority` | Always try the highest-`priority` provider first; fall back on error |
| `round-robin` | Distribute requests evenly across all configured providers |
| `lowest-cost` | Route to the provider with the lowest running average cost-per-request |
| `lowest-latency` | Route to the provider with the lowest running average latency |

```typescript
const gateway = new AIGateway({
  strategy: 'lowest-latency',  // auto-learns fastest provider over time
  fallback: true,
  providers: [ /* ... */ ],
});
```

## Fallback

With `fallback: true` (default), a failed request is automatically retried on the next provider in the ordered list. All provider errors are collected; if every provider fails, an `AggregateError` is thrown.

```typescript
// fallback: true — tries anthropic, then openai if anthropic fails
const gateway = new AIGateway({
  fallback: true,
  providers: [anthropicConfig, openaiConfig],
});

// fallback: false — surfaces errors immediately
const strict = new AIGateway({
  fallback: false,
  providers: [openaiConfig],
});
```

## Provider Configuration

```typescript
interface ProviderConfig {
  name: string;                // 'openai' | 'anthropic' | 'google' (or any prefix)
  apiKey: string;
  model?: string;              // override default model
  priority?: number;           // higher = preferred (default: 0)
  maxTokens?: number;          // default output token limit
  costPerInputToken?: number;  // USD per input token (for cost tracking)
  costPerOutputToken?: number; // USD per output token (for cost tracking)
  baseUrl?: string;            // override API base URL (for proxies / local)
}
```

**Default models:**

| Provider | Default model |
|---|---|
| `openai` | `gpt-4o-mini` |
| `anthropic` | `claude-3-haiku-20240307` |
| `google` | `gemini-1.5-flash` |

**Current provider pricing** (configure `costPer*` to match your plan):

| Model | Input / 1M tokens | Output / 1M tokens |
|---|---|---|
| GPT-4o mini | $0.15 | $0.60 |
| Claude 3 Haiku | $0.25 | $1.25 |
| Gemini 1.5 Flash | $0.075 | $0.30 |

## Response Shape

```typescript
interface CompletionResponse {
  content: string;          // The model's text output
  provider: string;         // Provider that served this response
  model: string;            // Model that was used
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latencyMs: number;        // Wall-clock request time in ms
  cost: number;             // Estimated USD cost (0 if costPer* not set)
}
```

## Observability

```typescript
const stats = gateway.getStats();
// {
//   anthropic: {
//     requests: 42, failures: 1,
//     totalLatencyMs: 18340, totalCost: 0.00312,
//     lastError: 'Anthropic error (529): Overloaded',
//     lastErrorAt: 2026-03-29T14:22:01.000Z
//   },
//   openai: { requests: 8, failures: 0, totalLatencyMs: 4120, totalCost: 0.00048 }
// }

const providers = gateway.getProviders();
// ['anthropic', 'openai']
```

## Examples

See the [`examples/`](./examples) directory:

- [`basic-routing.js`](./examples/basic-routing.js) — priority routing with Anthropic + OpenAI
- [`fallback.js`](./examples/fallback.js) — automatic fallback when a provider is unavailable
- [`cost-optimization.js`](./examples/cost-optimization.js) — `lowest-cost` routing across 3 providers with stats

To run an example after cloning:

```bash
npm install
npm run build
ANTHROPIC_API_KEY=sk-ant-... node examples/basic-routing.js
```

## Custom / OpenAI-Compatible Providers

You can point any provider at a custom `baseUrl` to use local models or proxies that implement the OpenAI-compatible API:

```typescript
{
  name: 'openai-local',
  apiKey: 'none',
  model: 'llama-3-8b',
  baseUrl: 'http://localhost:11434/v1',
  priority: 20,
}
```

## TypeScript

All types are exported from the package root:

```typescript
import type {
  Message,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  GatewayConfig,
  RoutingStrategy,
  ProviderStats,
} from 'ai-gateway-js';
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- TypeScript 5+ (for TypeScript users)

## License

MIT © [Jerome W. Dewald](https://github.com/jeromekjerome) / AI Strategies NYC

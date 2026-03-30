/**
 * cost-optimization.js
 *
 * Lowest-cost routing across OpenAI, Anthropic, and Google.
 * After a warm-up round, the gateway learns each provider's actual
 * average cost-per-request and routes subsequent calls to the cheapest.
 *
 * Run:
 *   OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... GOOGLE_API_KEY=... \
 *     node examples/cost-optimization.js
 */

const { AIGateway } = require('../dist');

async function main() {
  const gateway = new AIGateway({
    strategy: 'lowest-cost',
    fallback: true,
    providers: [
      {
        name: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        costPerInputToken: 0.00000015,
        costPerOutputToken: 0.0000006,
      },
      {
        name: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307',
        costPerInputToken: 0.00000025,
        costPerOutputToken: 0.00000125,
      },
      {
        name: 'google',
        apiKey: process.env.GOOGLE_API_KEY,
        model: 'gemini-1.5-flash',
        costPerInputToken: 0.000000075,
        costPerOutputToken: 0.0000003,
      },
    ],
  });

  const prompts = [
    'Define idempotency in one sentence.',
    'What is a webhook?',
    'Explain JWT tokens in one sentence.',
    'What does CORS stand for?',
    'Describe the CAP theorem briefly.',
  ];

  console.log('Running 5 completions with lowest-cost routing...\n');

  for (const prompt of prompts) {
    const r = await gateway.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 128,
    });
    console.log(`[${r.provider.padEnd(12)}] $${r.cost.toFixed(6)} | ${r.latencyMs}ms | ${r.usage.totalTokens} tokens`);
  }

  console.log('\n--- Final provider stats ---');
  for (const [name, s] of Object.entries(gateway.getStats())) {
    if (s.requests === 0) continue;
    const avgCost = (s.totalCost / s.requests).toFixed(6);
    const avgLatency = Math.round(s.totalLatencyMs / s.requests);
    console.log(`${name.padEnd(12)}: ${s.requests} reqs | avg cost $${avgCost} | avg latency ${avgLatency}ms | ${s.failures} failures`);
  }
}

main().catch(console.error);

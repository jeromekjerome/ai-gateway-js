/**
 * basic-routing.js
 *
 * Priority-based routing: Anthropic (Claude) first, OpenAI as backup.
 * With fallback: true, if the primary provider fails the request
 * automatically retries on the next provider in priority order.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... OPENAI_API_KEY=sk-... node examples/basic-routing.js
 */

const { AIGateway } = require('../dist');

async function main() {
  const gateway = new AIGateway({
    strategy: 'priority',
    fallback: true,
    timeout: 15000,
    providers: [
      {
        name: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307',
        priority: 10,
        costPerInputToken: 0.00000025,
        costPerOutputToken: 0.00000125,
      },
      {
        name: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        priority: 5,
        costPerInputToken: 0.00000015,
        costPerOutputToken: 0.0000006,
      },
    ],
  });

  const response = await gateway.complete({
    messages: [
      { role: 'system', content: 'You are a concise technical assistant.' },
      { role: 'user', content: 'What are the three most important things to know about REST APIs?' },
    ],
    maxTokens: 256,
    temperature: 0.3,
  });

  console.log(`Provider : ${response.provider} / ${response.model}`);
  console.log(`Latency  : ${response.latencyMs}ms`);
  console.log(`Tokens   : ${response.usage.totalTokens} (est. cost $${response.cost.toFixed(6)})`);
  console.log(`\n${response.content}`);
}

main().catch(console.error);

/**
 * fallback.js
 *
 * Demonstrates automatic fallback: the first provider is given a bad API key,
 * so the gateway automatically retries on the second provider.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... node examples/fallback.js
 */

const { AIGateway } = require('../dist');

async function main() {
  const gateway = new AIGateway({
    strategy: 'priority',
    fallback: true,
    providers: [
      {
        name: 'openai-bad',
        apiKey: 'invalid-key-triggers-fallback',
        model: 'gpt-4o-mini',
        priority: 10,
      },
      {
        name: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-haiku-20240307',
        priority: 5,
      },
    ],
  });

  try {
    const response = await gateway.complete({
      messages: [{ role: 'user', content: 'Say "fallback successful" and nothing else.' }],
    });
    console.log(`Served by: ${response.provider}`); // anthropic
    console.log(response.content);
  } catch (err) {
    console.error('All providers failed:', err.message);
  }

  // Inspect failure stats
  const stats = gateway.getStats();
  console.log('\nProvider stats:');
  for (const [name, s] of Object.entries(stats)) {
    console.log(`  ${name}: ${s.requests} requests, ${s.failures} failures${s.lastError ? ` (last error: ${s.lastError})` : ''}`);
  }
}

main().catch(console.error);

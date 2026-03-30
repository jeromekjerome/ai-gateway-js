import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { GoogleProvider } from './providers/google';
import type { BaseProvider } from './providers/base';
import type {
  CompletionRequest,
  CompletionResponse,
  GatewayConfig,
  ProviderConfig,
  ProviderStats,
} from './types';

export class AIGateway {
  private providers: BaseProvider[];
  private config: Required<GatewayConfig>;
  private stats: Map<string, ProviderStats>;
  private roundRobinIndex = 0;

  constructor(config: GatewayConfig) {
    this.config = {
      strategy: 'priority',
      fallback: true,
      timeout: 30000,
      ...config,
    };
    this.providers = config.providers.map(c => this.buildProvider(c));
    this.stats = new Map(
      this.providers.map(p => [
        p.name,
        { requests: 0, failures: 0, totalLatencyMs: 0, totalCost: 0 },
      ])
    );
  }

  private buildProvider(config: ProviderConfig): BaseProvider {
    const key = config.name.toLowerCase();
    if (key === 'openai' || key.startsWith('openai')) return new OpenAIProvider(config);
    if (key === 'anthropic' || key.startsWith('claude') || key.startsWith('anthropic')) return new AnthropicProvider(config);
    if (key === 'google' || key.startsWith('gemini') || key.startsWith('google')) return new GoogleProvider(config);
    throw new Error(
      `Unknown provider "${config.name}". Supported name prefixes: openai, anthropic, claude, google, gemini`
    );
  }

  private orderedProviders(): BaseProvider[] {
    switch (this.config.strategy) {
      case 'round-robin': {
        const idx = this.roundRobinIndex++ % this.providers.length;
        const selected = this.providers[idx];
        return [selected, ...this.providers.filter(p => p !== selected)];
      }
      case 'lowest-cost':
        return [...this.providers].sort((a, b) => {
          const sa = this.stats.get(a.name)!;
          const sb = this.stats.get(b.name)!;
          const avgA = sa.requests > 0 ? sa.totalCost / sa.requests : 0;
          const avgB = sb.requests > 0 ? sb.totalCost / sb.requests : 0;
          return avgA - avgB;
        });
      case 'lowest-latency':
        return [...this.providers].sort((a, b) => {
          const sa = this.stats.get(a.name)!;
          const sb = this.stats.get(b.name)!;
          const avgA = sa.requests > 0 ? sa.totalLatencyMs / sa.requests : Infinity;
          const avgB = sb.requests > 0 ? sb.totalLatencyMs / sb.requests : Infinity;
          return avgA - avgB;
        });
      case 'priority':
      default:
        return [...this.providers].sort((a, b) => b.priority - a.priority);
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const ordered = this.orderedProviders();
    const attempts = this.config.fallback ? ordered.length : 1;
    const errors: Error[] = [];

    for (let i = 0; i < attempts; i++) {
      const provider = ordered[i];
      const stats = this.stats.get(provider.name)!;
      stats.requests++;

      try {
        const result = await Promise.race([
          provider.complete(request),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${this.config.timeout}ms`)), this.config.timeout)
          ),
        ]);
        stats.totalLatencyMs += result.latencyMs;
        stats.totalCost += result.cost;
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        stats.failures++;
        stats.lastError = error.message;
        stats.lastErrorAt = new Date();
        errors.push(error);
        if (!this.config.fallback) throw error;
      }
    }

    throw new AggregateError(
      errors,
      `All ${attempts} provider(s) failed. Last error: ${errors[errors.length - 1]?.message}`
    );
  }

  getStats(): Record<string, ProviderStats> {
    return Object.fromEntries(this.stats);
  }

  getProviders(): string[] {
    return this.providers.map(p => p.name);
  }
}

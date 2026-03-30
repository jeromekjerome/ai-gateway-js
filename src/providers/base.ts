import type { CompletionRequest, CompletionResponse, ProviderConfig } from '../types';

export abstract class BaseProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  get name(): string {
    return this.config.name;
  }

  get priority(): number {
    return this.config.priority ?? 0;
  }

  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;

  protected calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (this.config.costPerInputToken ?? 0) * inputTokens;
    const outputCost = (this.config.costPerOutputToken ?? 0) * outputTokens;
    return inputCost + outputCost;
  }
}

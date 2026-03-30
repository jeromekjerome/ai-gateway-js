export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompletionRequest {
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResponse {
  content: string;
  provider: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  cost: number;
}

export interface ProviderConfig {
  name: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  priority?: number;
  maxTokens?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export type RoutingStrategy = 'priority' | 'round-robin' | 'lowest-cost' | 'lowest-latency';

export interface GatewayConfig {
  providers: ProviderConfig[];
  strategy?: RoutingStrategy;
  fallback?: boolean;
  timeout?: number;
}

export interface ProviderStats {
  requests: number;
  failures: number;
  totalLatencyMs: number;
  totalCost: number;
  lastError?: string;
  lastErrorAt?: Date;
}

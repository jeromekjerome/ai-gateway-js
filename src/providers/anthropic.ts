import { BaseProvider } from './base';
import type { CompletionRequest, CompletionResponse } from '../types';

export class AnthropicProvider extends BaseProvider {
  private model: string;

  constructor(config: ConstructorParameters<typeof BaseProvider>[0]) {
    super(config);
    this.model = config.model ?? 'claude-3-haiku-20240307';
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();
    const baseUrl = this.config.baseUrl ?? 'https://api.anthropic.com/v1';

    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.model,
      messages: conversationMessages,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 1024,
    };

    if (systemMessage) {
      body['system'] = systemMessage.content;
    }

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(`Anthropic error (${response.status}): ${err.error?.message ?? response.statusText}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };
    const latencyMs = Date.now() - start;
    const usage = data.usage ?? { input_tokens: 0, output_tokens: 0 };

    return {
      content: data.content[0]?.text ?? '',
      provider: this.name,
      model: this.model,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
      },
      latencyMs,
      cost: this.calculateCost(usage.input_tokens, usage.output_tokens),
    };
  }
}

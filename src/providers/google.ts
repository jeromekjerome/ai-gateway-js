import { BaseProvider } from './base';
import type { CompletionRequest, CompletionResponse } from '../types';

export class GoogleProvider extends BaseProvider {
  private model: string;

  constructor(config: ConstructorParameters<typeof BaseProvider>[0]) {
    super(config);
    this.model = config.model ?? 'gemini-1.5-flash';
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();
    const baseUrl = this.config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';

    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');

    const contents = conversationMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
      },
    };

    if (systemMessage) {
      body['systemInstruction'] = { parts: [{ text: systemMessage.content }] };
    }

    const response = await fetch(
      `${baseUrl}/models/${this.model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(`Google error (${response.status}): ${err.error?.message ?? response.statusText}`);
    }

    const data = await response.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
      usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
    };
    const latencyMs = Date.now() - start;
    const usage = data.usageMetadata ?? { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      provider: this.name,
      model: this.model,
      usage: {
        inputTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
        totalTokens: usage.totalTokenCount,
      },
      latencyMs,
      cost: this.calculateCost(usage.promptTokenCount, usage.candidatesTokenCount),
    };
  }
}

import type * as webllm from '@mlc-ai/web-llm';
import { LanguageModelV2 } from '@ai-sdk/provider';

/**
 * Creates a custom AI SDK provider for WebLLM
 * This allows us to use WebLLM with the AI SDK's streamText, generateText, etc.
 */
export function createWebLLMProvider(engine: webllm.MLCEngine, modelId: string): LanguageModelV2 {
  return {
    specificationVersion: 'v2',
    provider: 'webllm',
    modelId,
    supportedUrls: {},
    
    async doGenerate(options) {
      const messages = options.prompt.map((msg) => {
        if (msg.role === 'system') {
          return { role: 'system' as const, content: msg.content };
        } else if (msg.role === 'user') {
          const contentStr = msg.content
            .map(part => part.type === 'text' ? part.text : '')
            .join('\n');
          return { role: 'user' as const, content: contentStr };
        } else if (msg.role === 'assistant') {
          const contentStr = msg.content
            .map(part => part.type === 'text' ? part.text : '')
            .join('\n');
          return { role: 'assistant' as const, content: contentStr };
        }
        return { role: 'user' as const, content: '' };
      });

      const completion = await engine.chat.completions.create({
        messages,
        temperature: options.temperature,
        max_tokens: options.maxOutputTokens,
        top_p: options.topP,
      });

      const choice = completion.choices[0];
      const text = choice?.message?.content || '';

      return {
        content: [{ type: 'text' as const, text }],
        finishReason: choice?.finish_reason === 'stop' ? 'stop' : 'unknown',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        warnings: [],
      };
    },

    async doStream(options) {
      const messages = options.prompt.map((msg) => {
        if (msg.role === 'system') {
          return { role: 'system' as const, content: msg.content };
        } else if (msg.role === 'user') {
          const contentStr = msg.content
            .map(part => part.type === 'text' ? part.text : '')
            .join('\n');
          return { role: 'user' as const, content: contentStr };
        } else if (msg.role === 'assistant') {
          const contentStr = msg.content
            .map(part => part.type === 'text' ? part.text : '')
            .join('\n');
          return { role: 'assistant' as const, content: contentStr };
        }
        return { role: 'user' as const, content: '' };
      });

      const completion = await engine.chat.completions.create({
        messages,
        temperature: options.temperature,
        max_tokens: options.maxOutputTokens,
        top_p: options.topP,
        stream: true,
      });
      
      // Convert AsyncIterable to ReadableStream
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta?.content || '';
              if (delta) {
                controller.enqueue({
                  type: 'text-delta' as const,
                  id: `chunk-${Date.now()}`,
                  delta: delta,
                });
              }
            }

            // Send finish event
            controller.enqueue({
              type: 'finish' as const,
              finishReason: 'stop' as const,
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            });

            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return {
        stream,
      };
    },
  };
}

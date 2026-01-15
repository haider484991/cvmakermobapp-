import OpenAI from 'openai';
import type { AIModel, AIModelConfig, AIModelTier, AIError, AIErrorCode } from '@/types/ai';

/**
 * OpenRouter base URL for API requests
 */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Available AI models configuration
 */
export const AI_MODELS: Record<AIModelTier, AIModelConfig> = {
  fast: {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    tier: 'fast',
    description: 'Fast responses for quick suggestions',
    maxTokens: 4096,
    costPer1KTokens: 0.00025,
  },
  quality: {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    tier: 'quality',
    description: 'High-quality responses for detailed analysis',
    maxTokens: 4096,
    costPer1KTokens: 0.003,
  },
  budget: {
    id: 'x-ai/grok-4.1-fast',
    name: 'Grok 4.1 Fast',
    tier: 'budget',
    description: 'Cost-effective option for basic suggestions',
    maxTokens: 4096,
    costPer1KTokens: 0.0008,
  },
};

/**
 * Default model for each feature type
 */
export const DEFAULT_MODELS: Record<string, AIModelTier> = {
  summary: 'quality',
  bullets: 'fast',
  skills: 'fast',
  score: 'quality',
};

/**
 * Get the API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  console.log('[OpenRouter] API Key present:', !!apiKey, 'Length:', apiKey?.length, 'Starts with:', apiKey?.substring(0, 10));
  if (!apiKey) {
    throw createAIError('API_KEY_MISSING', 'OpenRouter API key is not configured');
  }
  return apiKey;
}

/**
 * Create the OpenAI client configured for OpenRouter
 */
export function createOpenRouterClient(): OpenAI {
  const apiKey = getApiKey();

  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    dangerouslyAllowBrowser: true, // Required for React Native
    defaultHeaders: {
      'HTTP-Referer': 'https://freeresumeai.app',
      'X-Title': 'FreeResume AI',
    },
  });
}

/**
 * Singleton client instance
 */
let clientInstance: OpenAI | null = null;

/**
 * Get or create the OpenRouter client instance
 */
export function getOpenRouterClient(): OpenAI {
  if (!clientInstance) {
    clientInstance = createOpenRouterClient();
  }
  return clientInstance;
}

/**
 * Reset the client instance (useful for testing or API key changes)
 */
export function resetOpenRouterClient(): void {
  clientInstance = null;
}

/**
 * Get model configuration by tier
 */
export function getModelByTier(tier: AIModelTier): AIModelConfig {
  return AI_MODELS[tier];
}

/**
 * Get model configuration by model ID
 */
export function getModelById(modelId: AIModel): AIModelConfig | undefined {
  return Object.values(AI_MODELS).find((model) => model.id === modelId);
}

/**
 * Create a standardized AI error
 */
export function createAIError(code: AIErrorCode, message: string): AIError {
  const retryableCodes: AIErrorCode[] = ['RATE_LIMITED', 'NETWORK_ERROR', 'MODEL_UNAVAILABLE'];

  return {
    code,
    message,
    retryable: retryableCodes.includes(code),
  };
}

/**
 * Parse OpenRouter/OpenAI errors into standardized format
 */
export function parseAPIError(error: unknown): AIError {
  if (error instanceof OpenAI.APIError) {
    switch (error.status) {
      case 401:
        return createAIError('API_KEY_INVALID', 'Invalid API key');
      case 429:
        return createAIError('RATE_LIMITED', 'Rate limit exceeded. Please try again later.');
      case 503:
        return createAIError('MODEL_UNAVAILABLE', 'Model is currently unavailable');
      default:
        return createAIError('UNKNOWN_ERROR', error.message);
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return createAIError('NETWORK_ERROR', 'Network error. Please check your connection.');
    }
    return createAIError('UNKNOWN_ERROR', error.message);
  }

  return createAIError('UNKNOWN_ERROR', 'An unexpected error occurred');
}

/**
 * Check if the API key is configured
 */
export function isAPIKeyConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_OPENROUTER_API_KEY);
}

/**
 * Chat completion request with OpenRouter
 */
export interface ChatCompletionOptions {
  model: AIModel;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: AIModel;
  tokensUsed: number;
  finishReason: string;
}

/**
 * Make a chat completion request to OpenRouter using fetch
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const apiKey = getApiKey();

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://freeresumeai.app',
        'X-Title': 'FreeResume AI',
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `API error: ${response.status}`;

      if (response.status === 401) {
        throw createAIError('API_KEY_INVALID', 'Invalid API key');
      } else if (response.status === 429) {
        throw createAIError('RATE_LIMITED', 'Rate limit exceeded. Please try again later.');
      } else if (response.status === 503) {
        throw createAIError('MODEL_UNAVAILABLE', 'Model is currently unavailable');
      }
      throw createAIError('UNKNOWN_ERROR', errorMessage);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.content) {
      throw createAIError('PARSE_ERROR', 'No content in response');
    }

    return {
      content: choice.message.content,
      model: options.model,
      tokensUsed: data.usage?.total_tokens ?? 0,
      finishReason: choice.finish_reason ?? 'unknown',
    };
  } catch (error) {
    if ((error as AIError).code) {
      throw error;
    }
    throw parseAPIError(error);
  }
}

/**
 * Parse JSON from AI response, handling potential markdown code blocks
 */
export function parseJSONResponse<T>(content: string): T {
  // Remove markdown code blocks if present
  let cleanContent = content.trim();

  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.slice(7);
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.slice(3);
  }

  if (cleanContent.endsWith('```')) {
    cleanContent = cleanContent.slice(0, -3);
  }

  cleanContent = cleanContent.trim();

  try {
    return JSON.parse(cleanContent) as T;
  } catch {
    throw createAIError('PARSE_ERROR', 'Failed to parse AI response as JSON');
  }
}

/**
 * Streaming chat completion options
 */
export interface StreamingChatCompletionOptions extends ChatCompletionOptions {
  onChunk: (chunk: string, fullText: string) => void;
  onComplete?: (fullText: string, tokensUsed: number) => void;
  onError?: (error: AIError) => void;
}

/**
 * Make a streaming chat completion request to OpenRouter
 * This provides real-time text output like ChatGPT
 */
export async function streamingChatCompletion(
  options: StreamingChatCompletionOptions
): Promise<void> {
  const apiKey = getApiKey();

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://freeresumeai.app',
        'X-Title': 'FreeResume AI',
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true, // Enable streaming
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `API error: ${response.status}`;

      if (response.status === 401) {
        throw createAIError('API_KEY_INVALID', 'Invalid API key');
      } else if (response.status === 429) {
        throw createAIError('RATE_LIMITED', 'Rate limit exceeded. Please try again later.');
      } else if (response.status === 503) {
        throw createAIError('MODEL_UNAVAILABLE', 'Model is currently unavailable');
      }
      throw createAIError('UNKNOWN_ERROR', errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw createAIError('NETWORK_ERROR', 'Failed to get response stream');
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let tokensUsed = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              fullText += content;
              options.onChunk(content, fullText);
            }

            // Capture usage info if available
            if (parsed.usage?.total_tokens) {
              tokensUsed = parsed.usage.total_tokens;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    options.onComplete?.(fullText, tokensUsed);
  } catch (error) {
    const aiError = (error as AIError).code ? (error as AIError) : parseAPIError(error);
    options.onError?.(aiError);
    throw aiError;
  }
}

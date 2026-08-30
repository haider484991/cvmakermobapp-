import type { AIError, AIErrorCode } from '@/types/ai';
import { isReasoningMandatoryError } from "./openrouterErrors";

/**
 * OpenRouter base URL for API requests
 */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Get the API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  if (!apiKey) {
    throw createAIError('API_KEY_MISSING', 'OpenRouter API key is not configured');
  }
  return apiKey;
}

/**
 * Create a standardized AI error
 */
export function createAIError(code: AIErrorCode, message: string): AIError {
  const retryableCodes: AIErrorCode[] = [
    'RATE_LIMITED',
    'NETWORK_ERROR',
    'MODEL_UNAVAILABLE',
    'TRUNCATED',
  ];

  return {
    code,
    message,
    retryable: retryableCodes.includes(code),
  };
}

/**
 * Parse fetch/runtime errors into standardized format
 */
export function parseAPIError(error: unknown): AIError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // React Native's fetch throws "Network request failed"
    if (message.includes('network') || message.includes('fetch')) {
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
 * Map an HTTP error status from OpenRouter to a standardized AIError.
 */
function errorFromStatus(status: number, message: string): AIError {
  switch (status) {
    case 401:
      return createAIError('API_KEY_INVALID', 'Invalid API key');
    case 429:
      return createAIError('RATE_LIMITED', 'Rate limit exceeded. Please try again later.');
    case 404:
    case 503:
      return createAIError('MODEL_UNAVAILABLE', 'Model is currently unavailable');
    default:
      return createAIError('UNKNOWN_ERROR', message);
  }
}

/**
 * Chat completion request with OpenRouter
 */
export interface ChatCompletionOptions {
  /** Primary model ID. */
  model: string;
  /**
   * Full fallback chain (usually from resolveModelChain). Sent as
   * OpenRouter's `models` array so a deprecated/unavailable primary falls
   * through server-side within a single request.
   */
  models?: string[];
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider to emit syntactically valid JSON. */
  responseFormat?: 'json_object';
  /**
   * Reasoning/"thinking" is disabled by default: it eats into max_tokens
   * (that's how resume imports got truncated into unparseable JSON) and
   * none of our extraction/rewrite tasks benefit from it. Models without
   * a reasoning control ignore the parameter.
   */
  allowReasoning?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  /** The model that actually answered (matters when the fallback chain engaged). */
  model: string;
  tokensUsed: number;
  finishReason: string;
}

/**
 * Build the OpenRouter request body shared by both completion functions.
 */
function buildRequestBody(options: ChatCompletionOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };
  if (options.models && options.models.length > 1) {
    // OpenRouter rejects fallback arrays longer than 3 with a 400.
    body.models = options.models.slice(0, 3);
  }
  if (options.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  if (!options.allowReasoning) {
    body.reasoning = { enabled: false };
  }
  return body;
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://freeresumeai.app',
    'X-Title': 'FreeResume AI',
  };
}

/**
 * Make a chat completion request to OpenRouter using fetch
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const apiKey = getApiKey();

  try {
    let response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify(buildRequestBody(options)),
    });

    // Some endpoints REQUIRE reasoning and hard-400 when we try to switch it
    // off. Seen live from users on 2026-08-27 (three failures in three
    // minutes, one person retrying): OpenRouter's `models` fallback array had
    // rolled the request onto openai/gpt-5-mini, which rejects
    // `reasoning:{enabled:false}` outright.
    //
    // We cannot predict this per-model, because with a fallback array
    // OpenRouter picks the model server-side after we've sent the body. So
    // recover instead: drop the flag and retry once. Future models that adopt
    // the same rule are covered without a code change.
    if (response.status === 400 && !options.allowReasoning) {
      const peek = await response.clone().json().catch(() => null);
      if (isReasoningMandatoryError(peek?.error?.message)) {
        response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: openRouterHeaders(apiKey),
          body: JSON.stringify(buildRequestBody({ ...options, allowReasoning: true })),
        });
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `API error: ${response.status}`;
      throw errorFromStatus(response.status, errorMessage);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const finishReason = choice?.finish_reason ?? 'unknown';

    // A hit on the token cap means the tail of the answer is missing —
    // for our JSON tasks that output is useless, so fail loudly instead
    // of letting JSON.parse produce a misleading "parse error".
    if (finishReason === 'length') {
      throw createAIError(
        'TRUNCATED',
        'The AI response was cut off before it finished. Please try again.'
      );
    }

    if (!choice?.message?.content) {
      throw createAIError('PARSE_ERROR', 'No content in response');
    }

    return {
      content: choice.message.content,
      model: data.model ?? options.model,
      tokensUsed: data.usage?.total_tokens ?? 0,
      finishReason,
    };
  } catch (error) {
    if ((error as AIError).code) {
      throw error;
    }
    throw parseAPIError(error);
  }
}

/**
 * Parse JSON from an AI response. Even with response_format enforcement,
 * some providers wrap output in markdown fences or stray prose, so this
 * degrades in steps: fenced block → raw parse → outermost {...} / [...] slice.
 */
export function parseJSONResponse<T>(content: string): T {
  let clean = content.trim();

  const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    clean = fenced[1].trim();
  } else {
    // Unclosed fence (typical of a truncated response) — strip what we can
    if (clean.startsWith('```json')) clean = clean.slice(7);
    else if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    clean = clean.trim();
  }

  try {
    return JSON.parse(clean) as T;
  } catch {
    // fall through to bracket extraction
  }

  const candidates: Array<[number, number]> = [
    [clean.indexOf('{'), clean.lastIndexOf('}')],
    [clean.indexOf('['), clean.lastIndexOf(']')],
  ];
  for (const [start, end] of candidates) {
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1)) as T;
      } catch {
        // try next candidate
      }
    }
  }

  throw createAIError('PARSE_ERROR', 'Failed to parse AI response as JSON');
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
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({ ...buildRequestBody(options), stream: true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `API error: ${response.status}`;
      throw errorFromStatus(response.status, errorMessage);
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

export { isReasoningMandatoryError };

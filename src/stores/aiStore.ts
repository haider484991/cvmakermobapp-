import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AIModel,
  AIError,
  AIUsageRecord,
  CachedSuggestion,
  SummaryGenerationResult,
  EnhancedBulletsResult,
  SkillSuggestionsResult,
  ResumeScore,
} from '@/types/ai';

/**
 * Cache expiration time (1 hour)
 */
const CACHE_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * Maximum usage records to keep
 */
const MAX_USAGE_RECORDS = 100;

/**
 * Suggestion cache types
 */
type SuggestionCacheKey = 'summary' | 'bullets' | 'skills' | 'score';

type SuggestionCacheValue =
  | SummaryGenerationResult
  | EnhancedBulletsResult
  | SkillSuggestionsResult
  | ResumeScore;

interface AIState {
  // Generation state
  isGenerating: boolean;
  currentOperation: string | null;
  error: AIError | null;

  // Streaming state
  isStreaming: boolean;
  streamingText: string;
  streamingComplete: boolean;

  // Suggestion cache
  suggestionCache: Record<string, CachedSuggestion<SuggestionCacheValue>>;

  // Usage tracking
  usageRecords: AIUsageRecord[];
  totalTokensUsed: number;

  // Preferences
  preferredModel: AIModel;

  // Actions
  setGenerating: (isGenerating: boolean, operation?: string | null) => void;
  setError: (error: AIError | null) => void;
  clearError: () => void;

  // Streaming actions
  startStreaming: (operation?: string) => void;
  appendStreamingText: (chunk: string) => void;
  setStreamingText: (text: string) => void;
  stopStreaming: () => void;
  resetStreaming: () => void;

  // Cache management
  getCachedSuggestion: <T extends SuggestionCacheValue>(
    type: SuggestionCacheKey,
    key: string
  ) => T | null;
  setCachedSuggestion: <T extends SuggestionCacheValue>(
    type: SuggestionCacheKey,
    key: string,
    data: T
  ) => void;
  clearSuggestions: (type?: SuggestionCacheKey) => void;
  clearExpiredCache: () => void;

  // Usage tracking
  trackUsage: (
    type: AIUsageRecord['type'],
    model: AIModel,
    tokensUsed: number
  ) => void;
  getUsageStats: () => {
    totalRequests: number;
    totalTokens: number;
    byType: Record<string, number>;
    byModel: Record<string, number>;
  };
  clearUsageHistory: () => void;

  // Preferences
  setPreferredModel: (model: AIModel) => void;
}

/**
 * Generate a cache key combining type and unique identifier
 */
function generateCacheKey(type: SuggestionCacheKey, key: string): string {
  return `${type}:${key}`;
}

/**
 * Check if a cached item has expired
 */
function isCacheExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // Initial state
      isGenerating: false,
      currentOperation: null,
      error: null,
      isStreaming: false,
      streamingText: '',
      streamingComplete: false,
      suggestionCache: {},
      usageRecords: [],
      totalTokensUsed: 0,
      preferredModel: 'x-ai/grok-4.3',

      // Generation state management
      setGenerating: (isGenerating, operation = null) =>
        set({
          isGenerating,
          currentOperation: isGenerating ? operation : null,
          error: isGenerating ? null : get().error,
        }),

      setError: (error) =>
        set({
          error,
          isGenerating: false,
          isStreaming: false,
          currentOperation: null,
        }),

      clearError: () => set({ error: null }),

      // Streaming state management
      startStreaming: (operation) =>
        set({
          isStreaming: true,
          isGenerating: true,
          streamingText: '',
          streamingComplete: false,
          currentOperation: operation || 'Generating...',
          error: null,
        }),

      appendStreamingText: (chunk) =>
        set((state) => ({
          streamingText: state.streamingText + chunk,
        })),

      setStreamingText: (text) =>
        set({
          streamingText: text,
        }),

      stopStreaming: () =>
        set({
          isStreaming: false,
          isGenerating: false,
          streamingComplete: true,
          currentOperation: null,
        }),

      resetStreaming: () =>
        set({
          isStreaming: false,
          streamingText: '',
          streamingComplete: false,
        }),

      // Cache management
      getCachedSuggestion: <T extends SuggestionCacheValue>(
        type: SuggestionCacheKey,
        key: string
      ): T | null => {
        const cacheKey = generateCacheKey(type, key);
        const cached = get().suggestionCache[cacheKey];

        if (!cached) return null;
        if (isCacheExpired(cached.expiresAt)) {
          // Clean up expired entry
          set((state) => {
            const { [cacheKey]: _, ...rest } = state.suggestionCache;
            return { suggestionCache: rest };
          });
          return null;
        }

        return cached.data as T;
      },

      setCachedSuggestion: <T extends SuggestionCacheValue>(
        type: SuggestionCacheKey,
        key: string,
        data: T
      ) => {
        const cacheKey = generateCacheKey(type, key);
        const expiresAt = new Date(Date.now() + CACHE_EXPIRATION_MS).toISOString();

        set((state) => ({
          suggestionCache: {
            ...state.suggestionCache,
            [cacheKey]: {
              data,
              cacheKey,
              expiresAt,
            },
          },
        }));
      },

      clearSuggestions: (type) => {
        if (type) {
          // Clear only suggestions of a specific type
          set((state) => {
            const filtered = Object.fromEntries(
              Object.entries(state.suggestionCache).filter(
                ([key]) => !key.startsWith(`${type}:`)
              )
            );
            return { suggestionCache: filtered };
          });
        } else {
          // Clear all suggestions
          set({ suggestionCache: {} });
        }
      },

      clearExpiredCache: () => {
        set((state) => {
          const filtered = Object.fromEntries(
            Object.entries(state.suggestionCache).filter(
              ([, value]) => !isCacheExpired(value.expiresAt)
            )
          );
          return { suggestionCache: filtered };
        });
      },

      // Usage tracking
      trackUsage: (type, model, tokensUsed) => {
        const record: AIUsageRecord = {
          id: Date.now().toString(),
          type,
          model,
          tokensUsed,
          timestamp: new Date().toISOString(),
        };

        set((state) => {
          // Keep only the most recent records
          const records = [record, ...state.usageRecords].slice(0, MAX_USAGE_RECORDS);

          return {
            usageRecords: records,
            totalTokensUsed: state.totalTokensUsed + tokensUsed,
          };
        });
      },

      getUsageStats: () => {
        const { usageRecords, totalTokensUsed } = get();

        const byType: Record<string, number> = {};
        const byModel: Record<string, number> = {};

        usageRecords.forEach((record) => {
          byType[record.type] = (byType[record.type] || 0) + 1;
          byModel[record.model] = (byModel[record.model] || 0) + 1;
        });

        return {
          totalRequests: usageRecords.length,
          totalTokens: totalTokensUsed,
          byType,
          byModel,
        };
      },

      clearUsageHistory: () =>
        set({
          usageRecords: [],
          totalTokensUsed: 0,
        }),

      // Preferences
      setPreferredModel: (model) => set({ preferredModel: model }),
    }),
    {
      name: 'ai-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Persist only these fields
        usageRecords: state.usageRecords,
        totalTokensUsed: state.totalTokensUsed,
        preferredModel: state.preferredModel,
        // Don't persist cache (let it regenerate) or transient state
      }),
    }
  )
);

/**
 * Selector for checking if AI is available
 */
export const selectIsAIAvailable = (state: AIState): boolean => {
  return !state.isGenerating && !state.error;
};

/**
 * Selector for current operation status
 */
export const selectOperationStatus = (
  state: AIState
): { isGenerating: boolean; operation: string | null; error: AIError | null } => ({
  isGenerating: state.isGenerating,
  operation: state.currentOperation,
  error: state.error,
});

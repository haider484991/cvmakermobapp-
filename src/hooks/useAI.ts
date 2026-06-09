import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAIStore } from '@/stores/aiStore';
import {
  generateSummary,
  generateSummaryStreaming,
  enhanceBulletPoints,
  enhanceBulletStreaming,
  suggestSkills,
  scoreResume,
  enhanceSingleBullet,
  structureFromNarrative,
  buildContextFromResume,
  streamTextGeneration,
} from '@/services/ai/resumeAI';
import type { NarrativeStructureResult } from '@/services/ai/resumeAI';
import { isAPIKeyConfigured, parseAPIError } from '@/lib/openrouter';
import type {
  AIContext,
  AIRequestOptions,
  SummaryGenerationResult,
  EnhancedBulletsResult,
  SkillSuggestionsResult,
  ResumeScore,
  AIError,
} from '@/types/ai';
import type { Resume, WorkExperience } from '@/types/resume';

/**
 * Query keys for React Query
 */
const AI_QUERY_KEYS = {
  summary: (contextHash: string) => ['ai', 'summary', contextHash] as const,
  bullets: (experienceId: string) => ['ai', 'bullets', experienceId] as const,
  skills: (jobTitle: string, industry: string) =>
    ['ai', 'skills', jobTitle, industry] as const,
  score: (resumeId: string, jobDescHash?: string) =>
    ['ai', 'score', resumeId, jobDescHash] as const,
};

/**
 * Generate a simple hash for caching purposes
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Hook for AI-powered summary generation
 */
export function useGenerateSummary() {
  const queryClient = useQueryClient();
  const { setGenerating, setError, trackUsage, getCachedSuggestion, setCachedSuggestion } =
    useAIStore();

  const mutation = useMutation<SummaryGenerationResult, AIError, AIContext>({
    mutationFn: async (context) => {
      // Check for cached result
      const cacheKey = simpleHash(JSON.stringify(context));
      const cached = getCachedSuggestion<SummaryGenerationResult>('summary', cacheKey);
      if (cached) {
        return cached;
      }

      const result = await generateSummary(context);

      // Cache the result
      setCachedSuggestion('summary', cacheKey, result);

      return result;
    },
    onMutate: () => {
      setGenerating(true, 'Generating professional summaries...');
    },
    onSuccess: (result) => {
      setGenerating(false);
      trackUsage('summary', result.model, result.tokensUsed);
    },
    onError: (error) => {
      setError(error);
    },
  });

  return {
    generateSummary: mutation.mutate,
    generateSummaryAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for AI-powered bullet point enhancement
 */
export function useEnhanceBullets() {
  const { setGenerating, setError, trackUsage, getCachedSuggestion, setCachedSuggestion } =
    useAIStore();

  const mutation = useMutation<EnhancedBulletsResult, AIError, WorkExperience>({
    mutationFn: async (experience) => {
      // Check for cached result
      const cacheKey = simpleHash(experience.id + experience.bullets.join(''));
      const cached = getCachedSuggestion<EnhancedBulletsResult>('bullets', cacheKey);
      if (cached) {
        return cached;
      }

      const result = await enhanceBulletPoints(experience);

      // Cache the result
      setCachedSuggestion('bullets', cacheKey, result);

      return result;
    },
    onMutate: () => {
      setGenerating(true, 'Enhancing bullet points...');
    },
    onSuccess: (result) => {
      setGenerating(false);
      trackUsage('bullets', result.model, result.tokensUsed);
    },
    onError: (error) => {
      setError(error);
    },
  });

  return {
    enhanceBullets: mutation.mutate,
    enhanceBulletsAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for AI-powered skill suggestions
 */
export function useSuggestSkills() {
  const { setGenerating, setError, trackUsage, getCachedSuggestion, setCachedSuggestion } =
    useAIStore();

  interface SkillsInput {
    jobTitle: string;
    industry: string;
    existingSkills?: string[];
  }

  const mutation = useMutation<SkillSuggestionsResult, AIError, SkillsInput>({
    mutationFn: async ({ jobTitle, industry, existingSkills }) => {
      // Check for cached result
      const cacheKey = simpleHash(jobTitle + industry);
      const cached = getCachedSuggestion<SkillSuggestionsResult>('skills', cacheKey);
      if (cached) {
        return cached;
      }

      const result = await suggestSkills(jobTitle, industry, existingSkills);

      // Cache the result
      setCachedSuggestion('skills', cacheKey, result);

      return result;
    },
    onMutate: () => {
      setGenerating(true, 'Suggesting relevant skills...');
    },
    onSuccess: (result) => {
      setGenerating(false);
      trackUsage('skills', result.model, result.tokensUsed);
    },
    onError: (error) => {
      setError(error);
    },
  });

  return {
    suggestSkills: mutation.mutate,
    suggestSkillsAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for AI-powered resume scoring
 */
export function useScoreResume() {
  const { setGenerating, setError, trackUsage, getCachedSuggestion, setCachedSuggestion } =
    useAIStore();

  interface ScoreInput {
    resume: Resume;
    jobDescription?: string;
  }

  const mutation = useMutation<ResumeScore, AIError, ScoreInput>({
    mutationFn: async ({ resume, jobDescription }) => {
      // Check for cached result
      const cacheKey = simpleHash(
        resume.id + resume.updatedAt + (jobDescription || '')
      );
      const cached = getCachedSuggestion<ResumeScore>('score', cacheKey);
      if (cached) {
        return cached;
      }

      const result = await scoreResume(resume, jobDescription);

      // Cache the result
      setCachedSuggestion('score', cacheKey, result);

      return result;
    },
    onMutate: () => {
      setGenerating(true, 'Analyzing your resume...');
    },
    onSuccess: (result) => {
      setGenerating(false);
      trackUsage('score', result.model, result.tokensUsed);
    },
    onError: (error) => {
      setError(error);
    },
  });

  return {
    scoreResume: mutation.mutate,
    scoreResumeAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for the "Tell me about yourself" wizard — turn a free-text user
 * narrative into a structured resume payload (header + summary + experience
 * + skills + ...). Caller previews the result, then applies via the
 * resume store.
 *
 * No caching: every narrative is treated as a fresh attempt. (Same user
 * may try multiple wordings to get a result they like.)
 */
export function useStructureFromNarrative() {
  const { setGenerating, setError, trackUsage } = useAIStore();

  const mutation = useMutation<NarrativeStructureResult, AIError, string>({
    mutationFn: async (narrative) => structureFromNarrative(narrative),
    onMutate: () => {
      setGenerating(true, 'Reading what you wrote and structuring your resume...');
    },
    onSuccess: (result) => {
      setGenerating(false);
      trackUsage('summary', result.model as any, result.tokensUsed);
    },
    onError: (error) => {
      setError(error);
    },
  });

  return {
    structure: mutation.mutate,
    structureAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for quick single bullet enhancement
 */
export function useEnhanceSingleBullet() {
  const { setGenerating, setError } = useAIStore();

  interface BulletInput {
    bullet: string;
    jobTitle?: string;
    options?: AIRequestOptions;
  }

  const mutation = useMutation<string, AIError, BulletInput>({
    mutationFn: async ({ bullet, jobTitle, options }) => {
      return enhanceSingleBullet(bullet, jobTitle, options);
    },
    onMutate: () => {
      setGenerating(true, 'Improving bullet point...');
    },
    onSuccess: () => {
      setGenerating(false);
    },
    onError: (error) => {
      setError(error);
    },
  });

  return {
    enhanceBullet: mutation.mutate,
    enhanceBulletAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for streaming summary generation (ChatGPT-like effect)
 */
export function useStreamingSummary() {
  const {
    startStreaming,
    appendStreamingText,
    stopStreaming,
    resetStreaming,
    setError,
    trackUsage,
    isStreaming,
    streamingText,
    streamingComplete,
  } = useAIStore();

  const generateStreamingSummary = useCallback(
    async (context: AIContext, options?: AIRequestOptions) => {
      startStreaming('Generating professional summary...');

      try {
        await generateSummaryStreaming(context, {
          onChunk: (_chunk, fullText) => {
            // Directly set the full text for smoother updates
            useAIStore.setState({ streamingText: fullText });
          },
          onComplete: (fullText, tokensUsed) => {
            stopStreaming();
            trackUsage('summary', options?.model || 'x-ai/grok-4.3', tokensUsed);
          },
          onError: (error) => {
            setError(error);
          },
        }, options);
      } catch (error) {
        // Error is already handled in onError callback
      }
    },
    [startStreaming, stopStreaming, setError, trackUsage]
  );

  return {
    generateStreamingSummary,
    isStreaming,
    streamingText,
    streamingComplete,
    resetStreaming,
  };
}

/**
 * Hook for streaming bullet enhancement (ChatGPT-like effect)
 */
export function useStreamingBulletEnhancement() {
  const {
    startStreaming,
    stopStreaming,
    setError,
    trackUsage,
    isStreaming,
    streamingText,
    streamingComplete,
    resetStreaming,
  } = useAIStore();

  const enhanceBulletWithStreaming = useCallback(
    async (bullet: string, jobTitle?: string, options?: AIRequestOptions) => {
      startStreaming('Improving bullet point...');

      try {
        await enhanceBulletStreaming(bullet, jobTitle, {
          onChunk: (_chunk, fullText) => {
            useAIStore.setState({ streamingText: fullText });
          },
          onComplete: (fullText, tokensUsed) => {
            stopStreaming();
            trackUsage('bullets', options?.model || 'x-ai/grok-4.3', tokensUsed);
          },
          onError: (error) => {
            setError(error);
          },
        }, options);
      } catch (error) {
        // Error is already handled in onError callback
      }
    },
    [startStreaming, stopStreaming, setError, trackUsage]
  );

  return {
    enhanceBulletWithStreaming,
    isStreaming,
    streamingText,
    streamingComplete,
    resetStreaming,
  };
}

/**
 * Combined hook for all AI features
 */
export function useAI() {
  const store = useAIStore();
  const summaryMutation = useGenerateSummary();
  const bulletsMutation = useEnhanceBullets();
  const skillsMutation = useSuggestSkills();
  const scoreMutation = useScoreResume();
  const singleBulletMutation = useEnhanceSingleBullet();
  const streamingSummary = useStreamingSummary();
  const streamingBullet = useStreamingBulletEnhancement();

  const isConfigured = isAPIKeyConfigured();

  const isLoading =
    summaryMutation.isLoading ||
    bulletsMutation.isLoading ||
    skillsMutation.isLoading ||
    scoreMutation.isLoading ||
    singleBulletMutation.isLoading;

  const clearAllCache = useCallback(() => {
    store.clearSuggestions();
  }, [store]);

  const getUsageStats = useCallback(() => {
    return store.getUsageStats();
  }, [store]);

  return {
    // Configuration
    isConfigured,

    // State
    isLoading,
    isGenerating: store.isGenerating,
    currentOperation: store.currentOperation,
    error: store.error,
    clearError: store.clearError,

    // Streaming state
    isStreaming: store.isStreaming,
    streamingText: store.streamingText,
    streamingComplete: store.streamingComplete,

    // Summary generation
    generateSummary: summaryMutation.generateSummary,
    generateSummaryAsync: summaryMutation.generateSummaryAsync,
    summaryData: summaryMutation.data,
    summaryLoading: summaryMutation.isLoading,

    // Streaming summary generation (ChatGPT-like)
    generateStreamingSummary: streamingSummary.generateStreamingSummary,
    resetStreamingSummary: streamingSummary.resetStreaming,

    // Bullet enhancement
    enhanceBullets: bulletsMutation.enhanceBullets,
    enhanceBulletsAsync: bulletsMutation.enhanceBulletsAsync,
    bulletsData: bulletsMutation.data,
    bulletsLoading: bulletsMutation.isLoading,

    // Single bullet enhancement
    enhanceSingleBullet: singleBulletMutation.enhanceBullet,
    enhanceSingleBulletAsync: singleBulletMutation.enhanceBulletAsync,
    singleBulletData: singleBulletMutation.data,
    singleBulletLoading: singleBulletMutation.isLoading,

    // Streaming bullet enhancement (ChatGPT-like)
    enhanceBulletWithStreaming: streamingBullet.enhanceBulletWithStreaming,
    resetStreamingBullet: streamingBullet.resetStreaming,

    // Skill suggestions
    suggestSkills: skillsMutation.suggestSkills,
    suggestSkillsAsync: skillsMutation.suggestSkillsAsync,
    skillsData: skillsMutation.data,
    skillsLoading: skillsMutation.isLoading,

    // Resume scoring
    scoreResume: scoreMutation.scoreResume,
    scoreResumeAsync: scoreMutation.scoreResumeAsync,
    scoreData: scoreMutation.data,
    scoreLoading: scoreMutation.isLoading,

    // Utilities
    buildContextFromResume,
    clearAllCache,
    getUsageStats,

    // Reset functions
    resetSummary: summaryMutation.reset,
    resetBullets: bulletsMutation.reset,
    resetSkills: skillsMutation.reset,
    resetScore: scoreMutation.reset,
  };
}

export default useAI;

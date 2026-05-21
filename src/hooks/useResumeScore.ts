/**
 * Resume Score Hook
 * Manages AI resume scoring with caching
 */

import { useState, useCallback } from 'react';
import { scoreResume, getQuickScore, type ResumeScore } from '@/services/ai/resumeScorer';
import { useGamification } from '@/hooks/useGamification';
import { reviewSignals } from '@/services/review/reviewManager';
import type { Resume } from '@/types/resume';

interface UseResumeScoreReturn {
  score: ResumeScore | null;
  quickScore: number;
  isLoading: boolean;
  error: string | null;
  analyze: () => Promise<void>;
  reset: () => void;
}

export function useResumeScore(resume: Resume | null): UseResumeScoreReturn {
  const [score, setScore] = useState<ResumeScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trackAIUsed } = useGamification();

  const quickScore = resume ? getQuickScore(resume) : 0;

  const analyze = useCallback(async () => {
    if (!resume) {
      setError('No resume to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await scoreResume(resume);

      if (result.success && result.score) {
        setScore(result.score);
        // Track AI usage for gamification
        trackAIUsed();
        // Record the score for review-eligibility — high scores
        // (>= 80) count as a "moment of value" toward the prompt.
        reviewSignals.scoreAchieved(result.score.overall).catch(() => {});
      } else {
        setError(result.error || 'Failed to analyze resume');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze resume');
    } finally {
      setIsLoading(false);
    }
  }, [resume, trackAIUsed]);

  const reset = useCallback(() => {
    setScore(null);
    setError(null);
  }, []);

  return {
    score,
    quickScore,
    isLoading,
    error,
    analyze,
    reset,
  };
}

export default useResumeScore;

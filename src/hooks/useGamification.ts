/**
 * useGamification Hook
 *
 * Provides easy access to gamification features with
 * automatic streak updates and achievement checking.
 */

import { useEffect, useCallback, useState } from 'react';
import { useGamificationStore, Achievement } from '@/stores/gamificationStore';

export function useGamification() {
  const store = useGamificationStore();
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [currentUnlock, setCurrentUnlock] = useState<Achievement | null>(null);

  // Update streak on mount
  useEffect(() => {
    store.updateStreak();
  }, []);

  // Handle recent unlocks - show modal for each
  useEffect(() => {
    if (store.recentUnlocks.length > 0) {
      setCurrentUnlock(store.recentUnlocks[0]);
      setShowAchievementModal(true);
    }
  }, [store.recentUnlocks]);

  // Close achievement modal and move to next unlock
  const dismissAchievement = useCallback(() => {
    setShowAchievementModal(false);
    setTimeout(() => {
      store.clearRecentUnlocks();
      setCurrentUnlock(null);
    }, 300);
  }, [store]);

  // Track resume creation
  const trackResumeCreated = useCallback(() => {
    store.incrementStat('resumesCreated');
  }, [store]);

  // Track resume export
  const trackResumeExported = useCallback(() => {
    store.incrementStat('resumesExported');
  }, [store]);

  // Track AI usage
  const trackAIUsed = useCallback(() => {
    store.incrementStat('aiSuggestionsUsed');
  }, [store]);

  // Track template view
  const trackTemplateViewed = useCallback(() => {
    store.incrementStat('templatesViewed');
  }, [store]);

  // Track section completed
  const trackSectionCompleted = useCallback(() => {
    store.incrementStat('sectionsCompleted');
  }, [store]);

  // Track share
  const trackShare = useCallback(() => {
    store.incrementStat('shareCount');
  }, [store]);

  // Track perfect score
  const trackPerfectScore = useCallback(() => {
    store.incrementStat('perfectScores');
  }, [store]);

  // Check for special time-based achievements
  const checkTimeBasedAchievements = useCallback(() => {
    const hour = new Date().getHours();

    if (hour >= 0 && hour < 6) {
      // Night owl or early bird
      const achievements = store.achievements;
      const nightOwl = achievements.find(a => a.id === 'night_owl');
      const earlyBird = achievements.find(a => a.id === 'early_bird');

      if (hour >= 0 && hour < 5 && nightOwl && !nightOwl.unlockedAt) {
        store.incrementStat('totalEdits'); // Triggers achievement check
      }
      if (hour >= 5 && hour < 6 && earlyBird && !earlyBird.unlockedAt) {
        store.incrementStat('totalEdits');
      }
    }
  }, [store]);

  return {
    // State
    totalXP: store.totalXP,
    currentLevel: store.currentLevel,
    achievements: store.achievements,
    streak: store.streak,
    stats: store.stats,
    dailyBonusClaimed: store.dailyBonusClaimed,
    progressToNextLevel: store.getProgressToNextLevel(),

    // Achievement modal
    showAchievementModal,
    currentUnlock,
    dismissAchievement,

    // Actions
    claimDailyBonus: store.claimDailyBonus,
    getAchievementsByCategory: store.getAchievementsByCategory,

    // Tracking functions
    trackResumeCreated,
    trackResumeExported,
    trackAIUsed,
    trackTemplateViewed,
    trackSectionCompleted,
    trackShare,
    trackPerfectScore,
    checkTimeBasedAchievements,
  };
}

export default useGamification;

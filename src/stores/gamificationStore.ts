/**
 * Gamification Store
 *
 * Manages achievements, XP, levels, streaks, and engagement mechanics.
 * Persists progress to AsyncStorage for retention across sessions.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Achievement definitions
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'milestone' | 'skill' | 'social' | 'streak' | 'special';
  xpReward: number;
  requirement: number;
  progress: number;
  unlockedAt?: string;
  isSecret?: boolean;
}

// Level definitions
export interface Level {
  level: number;
  name: string;
  minXP: number;
  maxXP: number;
  icon: string;
  color: string;
}

// Streak info
export interface StreakInfo {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}

// Stats tracking
export interface UserStats {
  resumesCreated: number;
  resumesExported: number;
  aiSuggestionsUsed: number;
  templatesViewed: number;
  sectionsCompleted: number;
  totalEdits: number;
  shareCount: number;
  referralCount: number;
  perfectScores: number;
  loginDays: number;
}

interface GamificationState {
  // XP and Level
  totalXP: number;
  currentLevel: Level;

  // Achievements
  achievements: Achievement[];
  recentUnlocks: Achievement[];

  // Streaks
  streak: StreakInfo;

  // Stats
  stats: UserStats;

  // Daily bonus
  dailyBonusClaimed: boolean;
  lastDailyBonusDate: string | null;

  // Referral
  referralCode: string | null;
  usedReferralCode: string | null;

  // Actions
  addXP: (amount: number, source: string) => void;
  checkAndUnlockAchievements: () => Achievement[];
  updateStreak: () => void;
  incrementStat: (stat: keyof UserStats, amount?: number) => void;
  claimDailyBonus: () => number;
  clearRecentUnlocks: () => void;
  getProgressToNextLevel: () => number;
  getAchievementsByCategory: (category: Achievement['category']) => Achievement[];
  setReferralCode: (code: string) => void;
  setUsedReferralCode: (code: string) => void;
}

// Level definitions
const LEVELS: Level[] = [
  { level: 1, name: 'Beginner', minXP: 0, maxXP: 100, icon: '🌱', color: '#94a3b8' },
  { level: 2, name: 'Learner', minXP: 100, maxXP: 300, icon: '📝', color: '#22c55e' },
  { level: 3, name: 'Builder', minXP: 300, maxXP: 600, icon: '🔨', color: '#3b82f6' },
  { level: 4, name: 'Creator', minXP: 600, maxXP: 1000, icon: '✨', color: '#8b5cf6' },
  { level: 5, name: 'Expert', minXP: 1000, maxXP: 1500, icon: '🎯', color: '#f59e0b' },
  { level: 6, name: 'Master', minXP: 1500, maxXP: 2200, icon: '🏆', color: '#ef4444' },
  { level: 7, name: 'Champion', minXP: 2200, maxXP: 3000, icon: '👑', color: '#ec4899' },
  { level: 8, name: 'Legend', minXP: 3000, maxXP: 4000, icon: '🌟', color: '#14b8a6' },
  { level: 9, name: 'Guru', minXP: 4000, maxXP: 5500, icon: '🔮', color: '#6366f1' },
  { level: 10, name: 'Grandmaster', minXP: 5500, maxXP: Infinity, icon: '💎', color: '#f97316' },
];

// Achievement definitions
const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'progress' | 'unlockedAt'>[] = [
  // Milestone achievements
  { id: 'first_resume', name: 'First Steps', description: 'Create your first resume', icon: '🎉', category: 'milestone', xpReward: 50, requirement: 1 },
  { id: 'resume_trio', name: 'Triple Threat', description: 'Create 3 resumes', icon: '🎯', category: 'milestone', xpReward: 100, requirement: 3 },
  { id: 'resume_master', name: 'Resume Master', description: 'Create 10 resumes', icon: '🏅', category: 'milestone', xpReward: 250, requirement: 10 },
  { id: 'first_export', name: 'Ready to Apply', description: 'Export your first PDF', icon: '📄', category: 'milestone', xpReward: 50, requirement: 1 },
  { id: 'export_pro', name: 'Export Pro', description: 'Export 10 PDFs', icon: '📚', category: 'milestone', xpReward: 150, requirement: 10 },

  // Skill achievements
  { id: 'ai_explorer', name: 'AI Explorer', description: 'Use AI suggestions 5 times', icon: '🤖', category: 'skill', xpReward: 75, requirement: 5 },
  { id: 'ai_master', name: 'AI Master', description: 'Use AI suggestions 25 times', icon: '🧠', category: 'skill', xpReward: 200, requirement: 25 },
  { id: 'template_hunter', name: 'Template Hunter', description: 'View 10 different templates', icon: '🎨', category: 'skill', xpReward: 50, requirement: 10 },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Get a perfect 100 AI score', icon: '💯', category: 'skill', xpReward: 300, requirement: 1 },
  { id: 'high_achiever', name: 'High Achiever', description: 'Get 5 scores above 90', icon: '⭐', category: 'skill', xpReward: 200, requirement: 5 },

  // Streak achievements
  { id: 'streak_3', name: 'Getting Consistent', description: '3-day streak', icon: '🔥', category: 'streak', xpReward: 50, requirement: 3 },
  { id: 'streak_7', name: 'Week Warrior', description: '7-day streak', icon: '💪', category: 'streak', xpReward: 150, requirement: 7 },
  { id: 'streak_14', name: 'Fortnight Fighter', description: '14-day streak', icon: '🚀', category: 'streak', xpReward: 300, requirement: 14 },
  { id: 'streak_30', name: 'Monthly Master', description: '30-day streak', icon: '👑', category: 'streak', xpReward: 500, requirement: 30 },

  // Social achievements
  { id: 'first_share', name: 'Sharing is Caring', description: 'Share your resume', icon: '🔗', category: 'social', xpReward: 50, requirement: 1 },
  { id: 'social_butterfly', name: 'Social Butterfly', description: 'Share 5 times', icon: '🦋', category: 'social', xpReward: 100, requirement: 5 },
  { id: 'influencer', name: 'Influencer', description: 'Refer a friend', icon: '📣', category: 'social', xpReward: 200, requirement: 1 },

  // Special achievements
  { id: 'speed_demon', name: 'Speed Demon', description: 'Complete a resume in under 5 minutes', icon: '⚡', category: 'special', xpReward: 100, requirement: 1, isSecret: true },
  { id: 'night_owl', name: 'Night Owl', description: 'Edit a resume after midnight', icon: '🦉', category: 'special', xpReward: 50, requirement: 1, isSecret: true },
  { id: 'early_bird', name: 'Early Bird', description: 'Edit a resume before 6 AM', icon: '🐦', category: 'special', xpReward: 50, requirement: 1, isSecret: true },
  { id: 'completionist', name: 'Completionist', description: 'Fill all sections of a resume', icon: '✅', category: 'special', xpReward: 150, requirement: 1 },
];

// Initialize achievements with progress
const initializeAchievements = (): Achievement[] => {
  return ACHIEVEMENT_DEFINITIONS.map(def => ({
    ...def,
    progress: 0,
    unlockedAt: undefined,
  }));
};

// Calculate level from XP
const calculateLevel = (xp: number): Level => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
};

// Initial state
const initialStats: UserStats = {
  resumesCreated: 0,
  resumesExported: 0,
  aiSuggestionsUsed: 0,
  templatesViewed: 0,
  sectionsCompleted: 0,
  totalEdits: 0,
  shareCount: 0,
  referralCount: 0,
  perfectScores: 0,
  loginDays: 0,
};

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      totalXP: 0,
      currentLevel: LEVELS[0],
      achievements: initializeAchievements(),
      recentUnlocks: [],
      streak: {
        current: 0,
        longest: 0,
        lastActiveDate: null,
      },
      stats: initialStats,
      dailyBonusClaimed: false,
      lastDailyBonusDate: null,
      referralCode: null,
      usedReferralCode: null,

      // Set referral code
      setReferralCode: (code: string) => {
        set({ referralCode: code });
      },

      // Set used referral code
      setUsedReferralCode: (code: string) => {
        set({ usedReferralCode: code });
      },

      // Add XP and update level
      addXP: (amount: number, source: string) => {
        set((state) => {
          const newXP = state.totalXP + amount;
          const newLevel = calculateLevel(newXP);

          console.log(`[Gamification] +${amount} XP from ${source}. Total: ${newXP}`);

          return {
            totalXP: newXP,
            currentLevel: newLevel,
          };
        });
      },

      // Check and unlock achievements
      checkAndUnlockAchievements: () => {
        const state = get();
        const { stats, streak, achievements } = state;
        const newUnlocks: Achievement[] = [];

        const updatedAchievements = achievements.map(achievement => {
          // Skip already unlocked
          if (achievement.unlockedAt) return achievement;

          let progress = achievement.progress;

          // Calculate progress based on achievement type
          switch (achievement.id) {
            // Milestone
            case 'first_resume':
            case 'resume_trio':
            case 'resume_master':
              progress = stats.resumesCreated;
              break;
            case 'first_export':
            case 'export_pro':
              progress = stats.resumesExported;
              break;

            // Skill
            case 'ai_explorer':
            case 'ai_master':
              progress = stats.aiSuggestionsUsed;
              break;
            case 'template_hunter':
              progress = stats.templatesViewed;
              break;
            case 'perfectionist':
            case 'high_achiever':
              progress = stats.perfectScores;
              break;

            // Streak
            case 'streak_3':
            case 'streak_7':
            case 'streak_14':
            case 'streak_30':
              progress = streak.longest;
              break;

            // Social
            case 'first_share':
            case 'social_butterfly':
              progress = stats.shareCount;
              break;
            case 'influencer':
              progress = stats.referralCount;
              break;

            default:
              break;
          }

          // Check if unlocked
          if (progress >= achievement.requirement && !achievement.unlockedAt) {
            const unlockedAchievement = {
              ...achievement,
              progress,
              unlockedAt: new Date().toISOString(),
            };
            newUnlocks.push(unlockedAchievement);

            // Add XP reward
            state.addXP(achievement.xpReward, `Achievement: ${achievement.name}`);

            return unlockedAchievement;
          }

          return { ...achievement, progress };
        });

        if (newUnlocks.length > 0) {
          set({
            achievements: updatedAchievements,
            recentUnlocks: [...state.recentUnlocks, ...newUnlocks],
          });
        } else {
          set({ achievements: updatedAchievements });
        }

        return newUnlocks;
      },

      // Update streak
      updateStreak: () => {
        const today = new Date().toISOString().split('T')[0];

        set((state) => {
          const { streak } = state;
          const lastDate = streak.lastActiveDate;

          if (lastDate === today) {
            // Already active today
            return state;
          }

          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          let newCurrent = 1;
          if (lastDate === yesterdayStr) {
            // Consecutive day
            newCurrent = streak.current + 1;
          }

          const newLongest = Math.max(newCurrent, streak.longest);

          // Award XP for maintaining streak
          if (newCurrent > 1) {
            const streakBonus = Math.min(newCurrent * 5, 50); // Max 50 XP
            state.addXP(streakBonus, `${newCurrent}-day streak bonus`);
          }

          return {
            streak: {
              current: newCurrent,
              longest: newLongest,
              lastActiveDate: today,
            },
            stats: {
              ...state.stats,
              loginDays: state.stats.loginDays + 1,
            },
          };
        });

        // Check for streak achievements
        get().checkAndUnlockAchievements();
      },

      // Increment a stat
      incrementStat: (stat: keyof UserStats, amount = 1) => {
        set((state) => ({
          stats: {
            ...state.stats,
            [stat]: state.stats[stat] + amount,
          },
        }));

        // Award XP for certain actions
        const xpRewards: Partial<Record<keyof UserStats, number>> = {
          resumesCreated: 25,
          resumesExported: 15,
          aiSuggestionsUsed: 5,
          sectionsCompleted: 10,
          shareCount: 20,
        };

        if (xpRewards[stat]) {
          get().addXP(xpRewards[stat]! * amount, stat);
        }

        // Check achievements after stat update
        get().checkAndUnlockAchievements();
      },

      // Claim daily bonus
      claimDailyBonus: () => {
        const today = new Date().toISOString().split('T')[0];
        const state = get();

        if (state.lastDailyBonusDate === today) {
          return 0; // Already claimed
        }

        // Calculate bonus based on streak (10-50 XP)
        const bonus = Math.min(10 + state.streak.current * 5, 50);

        set({
          dailyBonusClaimed: true,
          lastDailyBonusDate: today,
        });

        state.addXP(bonus, 'Daily bonus');

        return bonus;
      },

      // Clear recent unlocks (after showing notification)
      clearRecentUnlocks: () => {
        set({ recentUnlocks: [] });
      },

      // Get progress to next level (0-100%)
      getProgressToNextLevel: () => {
        const { totalXP, currentLevel } = get();
        const xpInLevel = totalXP - currentLevel.minXP;
        const levelRange = currentLevel.maxXP - currentLevel.minXP;

        if (levelRange === Infinity) return 100;

        return Math.min((xpInLevel / levelRange) * 100, 100);
      },

      // Get achievements by category
      getAchievementsByCategory: (category) => {
        return get().achievements.filter(a => a.category === category);
      },
    }),
    {
      name: 'gamification-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Export level definitions for UI
export const LEVEL_DEFINITIONS = LEVELS;

export default useGamificationStore;

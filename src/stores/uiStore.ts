import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * What we learn about the user during onboarding. Captured once on the
 * Personalize screen and then ACTUALLY USED downstream: it pre-fills the
 * resume header, seeds the AI wizard so the user never faces a blank page,
 * and picks a sensible default template for their industry.
 *
 * Before v1.9.7 these answers were collected and silently thrown away —
 * the single biggest reason onboarding felt like pointless theater.
 */
export interface OnboardingProfile {
  firstName?: string;
  /** Why they're here — drives copy + which path we recommend. */
  goal?: 'new-job' | 'first-job' | 'career-switch' | 'promotion' | 'exploring';
  /** The role they're targeting, e.g. "Product Manager". Pre-fills header.jobTitle. */
  targetRole?: string;
  /** Industry id from ONBOARDING_INDUSTRIES — picks the default template. */
  industry?: string;
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  /** Set when the user finishes onboarding (epoch ms). */
  completedAt?: number;
}

interface UIState {
  theme: ThemeMode;
  hapticEnabled: boolean;
  onboardingCompleted: boolean;
  onboardingProfile: OnboardingProfile;
  savePromptDismissed: boolean;
  savePromptLastShown: number | null;
  setTheme: (theme: ThemeMode) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  /** Shallow-merges a patch into the onboarding profile. */
  setOnboardingProfile: (patch: Partial<OnboardingProfile>) => void;
  dismissSavePrompt: () => void;
  resetSavePrompt: () => void;
  shouldShowSavePrompt: () => boolean;
}

// Cooldown period before showing save prompt again (24 hours)
const SAVE_PROMPT_COOLDOWN = 24 * 60 * 60 * 1000;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      hapticEnabled: true,
      onboardingCompleted: false,
      onboardingProfile: {},
      savePromptDismissed: false,
      savePromptLastShown: null,
      setTheme: (theme) => set({ theme }),
      setHapticEnabled: (hapticEnabled) => set({ hapticEnabled }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
      setOnboardingProfile: (patch) =>
        set((state) => ({ onboardingProfile: { ...state.onboardingProfile, ...patch } })),
      dismissSavePrompt: () => set({
        savePromptDismissed: true,
        savePromptLastShown: Date.now(),
      }),
      resetSavePrompt: () => set({
        savePromptDismissed: false,
        savePromptLastShown: null,
      }),
      shouldShowSavePrompt: () => {
        const { savePromptDismissed, savePromptLastShown } = get();
        if (!savePromptDismissed) return true;
        if (!savePromptLastShown) return true;
        // Show again after cooldown period
        return Date.now() - savePromptLastShown > SAVE_PROMPT_COOLDOWN;
      },
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

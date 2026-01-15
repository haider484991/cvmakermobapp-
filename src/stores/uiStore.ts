import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

interface UIState {
  theme: ThemeMode;
  hapticEnabled: boolean;
  onboardingCompleted: boolean;
  savePromptDismissed: boolean;
  savePromptLastShown: number | null;
  setTheme: (theme: ThemeMode) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
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
      savePromptDismissed: false,
      savePromptLastShown: null,
      setTheme: (theme) => set({ theme }),
      setHapticEnabled: (hapticEnabled) => set({ hapticEnabled }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
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

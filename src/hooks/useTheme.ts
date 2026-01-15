import { useColorScheme } from 'react-native';
import { useUIStore, ThemeMode } from '@/stores/uiStore';
import { colors } from '@/constants/theme';

export const useTheme = () => {
  const systemScheme = useColorScheme();
  const { theme, setTheme } = useUIStore();

  const activeTheme: 'light' | 'dark' =
    theme === 'system'
      ? (systemScheme || 'light')
      : theme;

  const themeColors = colors[activeTheme];
  const isDark = activeTheme === 'dark';

  return {
    theme,
    activeTheme,
    setTheme,
    colors: themeColors,
    isDark,
  };
};

import { View, Text, Pressable, ScrollView, Switch, Alert, Linking, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { useNotifications } from '@/hooks/useNotifications';
import { gradientColors } from '@/constants/theme';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguagePicker } from '@/components/features/settings/LanguagePicker';
import { SUPPORTED_LOCALES } from '@/i18n';
import { Globe } from 'lucide-react-native';
import {
  User,
  Moon,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Crown,
  Vibrate,
  Settings,
  Mail,
  Star,
  ExternalLink,
  Trash2,
  Award,
  Share2,
  Users,
  BellRing,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGamification } from '@/hooks/useGamification';
import { usePremium } from '@/hooks/usePremium';
import { PaywallModal } from '@/components/features/paywall/PaywallModal';
import { restorePurchases } from '@/services/purchases/purchases';
import {
  XPProgressBar,
  StreakCounter,
  StatsCard,
  AchievementBadge,
  LevelBadge,
} from '@/components/gamification';
import { ShareCard } from '@/components/features/social';

const PRIVACY_POLICY_URL = 'https://haider484991.github.io/cvmakermobapp-/privacy';
const HELP_FAQ_URL = 'https://haider484991.github.io/cvmakermobapp-/help';
const SUPPORT_EMAIL = 'haider484991@gmail.com';

export default function Profile() {
  const router = useRouter();
  const { colors, setTheme, isDark } = useTheme();
  const { hapticEnabled, setHapticEnabled } = useUIStore();
  const {
    isAuthenticated,
    isLoading,
    displayName,
    email,
    initials,
    subscriptionTier,
    signOut,
    deleteAccount,
  } = useAuth();

  const { t, i18n } = useTranslation();
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const currentLocale = SUPPORTED_LOCALES.find(
    (l) => l.code === (i18n.resolvedLanguage || i18n.language),
  );

  const { achievements, currentLevel, totalXP } = useGamification();
  const unlockedAchievements = achievements.filter(a => a.unlockedAt);
  const {
    isPermissionGranted,
    preferences: notificationPrefs,
    requestNotificationPermission,
    updatePreferences,
  } = useNotifications();

  const handleToggleDarkMode = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTheme(isDark ? 'light' : 'dark');
  };

  const handleToggleHaptics = () => {
    if (hapticEnabled) {
      setHapticEnabled(false);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setHapticEnabled(true);
    }
  };

  const handleSignOut = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and will delete:\n\n• Your profile information\n• All your saved resumes\n• Your account credentials',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation for safety
            Alert.alert(
              'Final Confirmation',
              'This is your last chance to cancel. Your account and all data will be permanently deleted.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    const { error } = await deleteAccount();
                    if (error) {
                      Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
                    } else {
                      Alert.alert(
                        'Account Deleted',
                        'Your account has been successfully deleted.',
                        [
                          {
                            text: 'OK',
                            onPress: () => router.replace('/(auth)/login'),
                          },
                        ]
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleSignIn = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/(auth)/login');
  };

  const handleUpgradePremium = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPaywallVisible(true);
  };

  const handleRestorePurchases = async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const { found } = await restorePurchases();
    Alert.alert(
      found > 0 ? 'Purchases restored' : 'No purchase found',
      found > 0
        ? 'Your FreeResume Pro access has been restored on this device.'
        : 'We didn\'t find an active subscription on this Google account. If you believe this is a mistake, make sure you\'re signed into the same Google account you used to purchase.',
      [{ text: 'OK' }],
    );
  };

  const handleManageSubscription = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Deep-link into Play Store's subscription management for our app.
    // Compliance requirement under Play's billing policy.
    Linking.openURL(
      `https://play.google.com/store/account/subscriptions?package=com.freeresumeai.app`,
    ).catch(() => {});
  };

  const handleOpenPrivacyPolicy = async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  };

  const handleOpenHelpFAQ = async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await WebBrowser.openBrowserAsync(HELP_FAQ_URL);
  };

  const handleToggleNotifications = async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (!isPermissionGranted) {
      const granted = await requestNotificationPermission();
      if (granted) {
        await updatePreferences({ enabled: true });
      }
    } else {
      await updatePreferences({ enabled: !notificationPrefs.enabled });
    }
  };

  const handleToggleStreakReminders = async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updatePreferences({ streakReminders: !notificationPrefs.streakReminders });
  };

  const handleOpenNotificationSettings = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleContactSupport = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=FreeResume AI Support`);
  };

  const SettingItem = ({
    icon: Icon,
    label,
    value,
    onPress,
    isToggle,
    toggleValue,
    onToggle,
    showChevron = true,
    iconColor,
    destructive = false,
  }: {
    icon: any;
    label: string;
    value?: string;
    onPress?: () => void;
    isToggle?: boolean;
    toggleValue?: boolean;
    onToggle?: () => void;
    showChevron?: boolean;
    iconColor?: string;
    destructive?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-4 px-4 rounded-xl mb-2"
      style={{ backgroundColor: colors.surface }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: (iconColor || colors.primary) + '15' }}
      >
        <Icon size={20} color={iconColor || colors.primary} />
      </View>
      <View className="flex-1">
        <Text
          className="text-base"
          style={{ color: destructive ? colors.error : colors.text }}
        >
          {label}
        </Text>
        {value && (
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {value}
          </Text>
        )}
      </View>
      {isToggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="white"
        />
      ) : showChevron ? (
        <ChevronRight size={20} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );

  // Premium is authoritative from the IAP store (Google Play Billing).
  // Supabase subscriptionTier is a legacy field we no longer trust.
  const { isPremium, activeTier } = usePremium();
  const [paywallVisible, setPaywallVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Gradient Header */}
      <LinearGradient
        colors={gradientColors.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingBottom: 60, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
      >
        <SafeAreaView edges={['top']}>
          <View className="px-6 pt-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Settings size={24} color="white" />
              <Text className="text-2xl font-bold text-white ml-3">
                Profile
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} style={{ marginTop: -40 }}>
        {/* User Card */}
        <Animated.View entering={FadeInUp.delay(100)} className="px-6 mb-6">
          <Pressable
            onPress={isAuthenticated ? undefined : handleSignIn}
            className="rounded-2xl p-5 flex-row items-center"
            style={{
              backgroundColor: colors.surface,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }}
          >
            <LinearGradient
              colors={gradientColors.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}
            >
              {isAuthenticated && initials ? (
                <Text className="text-2xl font-bold text-white">{initials}</Text>
              ) : (
                <User size={28} color="white" />
              )}
            </LinearGradient>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text
                  className="text-xl font-semibold"
                  style={{ color: colors.text }}
                  numberOfLines={1}
                >
                  {isAuthenticated ? displayName || 'User' : 'Guest User'}
                </Text>
                {isPremium && (
                  <View
                    className="ml-2 px-2 py-0.5 rounded-full flex-row items-center"
                    style={{ backgroundColor: colors.warning }}
                  >
                    <Star size={10} color="white" />
                    <Text className="text-xs font-medium text-white ml-1">PRO</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: colors.textSecondary }} numberOfLines={1}>
                {isAuthenticated ? email : 'Tap to sign in and sync your resumes'}
              </Text>
            </View>
            {!isAuthenticated && (
              <ChevronRight size={20} color={colors.textMuted} />
            )}
          </Pressable>
        </Animated.View>

        {/* Premium Banner - Only show for non-premium users */}
        {!isPremium && (
          <Animated.View entering={FadeInUp.delay(200)} className="px-6 mb-6">
            <Pressable
              onPress={handleUpgradePremium}
              className="rounded-2xl p-5 flex-row items-center"
              style={{
                backgroundColor: colors.warning + '15',
                borderWidth: 1,
                borderColor: colors.warning,
              }}
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: colors.warning }}
              >
                <Crown size={24} color="white" />
              </View>
              <View className="flex-1">
                <Text
                  className="text-lg font-semibold"
                  style={{ color: colors.warning }}
                >
                  Upgrade to Premium
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  Unlimited resumes, AI & templates
                </Text>
              </View>
              <ChevronRight size={20} color={colors.warning} />
            </Pressable>
          </Animated.View>
        )}

        {/* Gamification Section */}
        <View className="px-6 mb-6">
          {/* XP Progress */}
          <Animated.View entering={FadeInUp.delay(250)}>
            <XPProgressBar />
          </Animated.View>

          {/* Streak Counter */}
          <Animated.View entering={FadeInUp.delay(300)} style={{ marginTop: 12 }}>
            <StreakCounter />
          </Animated.View>

          {/* Achievements */}
          <Animated.View entering={FadeInUp.delay(350)} style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                Achievements
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {unlockedAchievements.length}/{achievements.length} unlocked
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              {achievements.slice(0, 8).map((achievement, index) => (
                <View key={achievement.id} style={{ marginRight: 16 }}>
                  <AchievementBadge achievement={achievement} size="medium" />
                </View>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Stats Card */}
          <Animated.View entering={FadeInUp.delay(400)} style={{ marginTop: 16 }}>
            <StatsCard />
          </Animated.View>
        </View>

        {/* Settings */}
        <View className="px-6">
          <Animated.View entering={FadeInUp.delay(450)}>
            <Text
              className="text-sm font-medium mb-3 uppercase"
              style={{ color: colors.textMuted }}
            >
              Preferences
            </Text>

            {/* Language picker — opens a modal sheet with all 12 supported
                locales. Placed at the top of Preferences for discoverability. */}
            <SettingItem
              icon={Globe}
              label={t('profile.language')}
              value={currentLocale?.nativeName || 'English'}
              onPress={() => setLanguagePickerOpen(true)}
            />

            <SettingItem
              icon={Moon}
              label="Dark Mode"
              isToggle
              toggleValue={isDark}
              onToggle={handleToggleDarkMode}
              showChevron={false}
            />

            <SettingItem
              icon={Vibrate}
              label="Haptic Feedback"
              isToggle
              toggleValue={hapticEnabled}
              onToggle={handleToggleHaptics}
              showChevron={false}
            />

            <SettingItem
              icon={BellRing}
              label="Push Notifications"
              isToggle
              toggleValue={notificationPrefs.enabled && isPermissionGranted}
              onToggle={handleToggleNotifications}
              showChevron={false}
            />

            {notificationPrefs.enabled && isPermissionGranted && (
              <SettingItem
                icon={Bell}
                label="Streak Reminders"
                value="Get reminded to maintain your streak"
                isToggle
                toggleValue={notificationPrefs.streakReminders}
                onToggle={handleToggleStreakReminders}
                showChevron={false}
              />
            )}
          </Animated.View>

          {/* Social Section */}
          <Animated.View entering={FadeInUp.delay(475)} className="mt-6">
            <Text
              className="text-sm font-medium mb-3 uppercase"
              style={{ color: colors.textMuted }}
            >
              Social
            </Text>

            <ShareCard variant="referral" />

            <View style={{ height: 12 }} />

            <ShareCard variant="share" />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500)} className="mt-6">
            <Text
              className="text-sm font-medium mb-3 uppercase"
              style={{ color: colors.textMuted }}
            >
              Support
            </Text>

            <SettingItem
              icon={HelpCircle}
              label="Help & FAQ"
              onPress={handleOpenHelpFAQ}
            />

            <SettingItem
              icon={Mail}
              label="Contact Support"
              value={SUPPORT_EMAIL}
              onPress={handleContactSupport}
            />

            <SettingItem
              icon={Shield}
              label="Privacy Policy"
              onPress={handleOpenPrivacyPolicy}
            />
          </Animated.View>

          {/* Sign Out and Delete Account - Only show if authenticated */}
          {isAuthenticated && (
            <Animated.View entering={FadeInUp.delay(550)} className="mt-6">
              <SettingItem
                icon={LogOut}
                label="Sign Out"
                onPress={handleSignOut}
                showChevron={false}
                iconColor={colors.error}
                destructive
              />
            </Animated.View>
          )}

          {/* Delete Account - Separate section for destructive action */}
          {isAuthenticated && (
            <Animated.View entering={FadeInUp.delay(600)} className="mt-4 mb-8">
              <Text
                className="text-sm font-medium mb-3 uppercase"
                style={{ color: colors.error }}
              >
                Danger Zone
              </Text>
              <SettingItem
                icon={Trash2}
                label="Delete Account"
                value="Permanently delete your account and data"
                onPress={handleDeleteAccount}
                showChevron={false}
                iconColor={colors.error}
                destructive
              />
            </Animated.View>
          )}
        </View>

        {/* Version */}
        <Animated.View
          entering={FadeInUp.delay(600)}
          className="items-center pb-8"
        >
          <Text style={{ color: colors.textMuted }} className="text-sm">
            FreeResume AI v1.0.0
          </Text>
          {__DEV__ && (
            <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
              Development Build
            </Text>
          )}
        </Animated.View>
      </ScrollView>

      <LanguagePicker
        visible={languagePickerOpen}
        onClose={() => setLanguagePickerOpen(false)}
      />

      {/* Paywall — opens from Upgrade banner. Auto-closes if user becomes premium. */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        trigger="profile"
      />
    </View>
  );
}

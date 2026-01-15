import { View, Text, Pressable, ScrollView, Switch, Alert, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { gradientColors } from '@/constants/theme';
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
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

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
  } = useAuth();

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
    // TODO: Navigate to premium/subscription screen
    Alert.alert(
      'Upgrade to Premium',
      'Premium features coming soon! Get unlimited resumes, AI assistance, and premium templates.',
      [{ text: 'OK' }]
    );
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

  const isPremium = subscriptionTier === 'premium' || subscriptionTier === 'pro';

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

        {/* Settings */}
        <View className="px-6">
          <Animated.View entering={FadeInUp.delay(300)}>
            <Text
              className="text-sm font-medium mb-3 uppercase"
              style={{ color: colors.textMuted }}
            >
              Preferences
            </Text>

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
              icon={Bell}
              label="Notifications"
              value="Manage in settings"
              onPress={handleOpenNotificationSettings}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400)} className="mt-6">
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

          {/* Sign Out - Only show if authenticated */}
          {isAuthenticated && (
            <Animated.View entering={FadeInUp.delay(500)} className="mt-6 mb-8">
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
    </View>
  );
}

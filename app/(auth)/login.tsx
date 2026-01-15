import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signIn, isLoading, error, clearError } = useAuth();
  const [showError, setShowError] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    setShowError(false);

    const { error: signInError } = await signIn(data.email, data.password);

    if (signInError) {
      setShowError(true);
      return;
    }

    // Navigate to main dashboard on success
    router.replace('/(main)/dashboard');
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 40,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ marginBottom: 40 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '700',
                color: colors.text,
                marginBottom: 8,
              }}
            >
              Welcome back
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.textSecondary,
                lineHeight: 24,
              }}
            >
              Sign in to continue building your professional resume
            </Text>
          </View>

          {/* Error Message */}
          {showError && error && (
            <View
              style={{
                backgroundColor: `${colors.error}15`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: `${colors.error}30`,
              }}
            >
              <Text style={{ color: colors.error, fontSize: 14 }}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={{ gap: 20 }}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  leftIcon={<Mail size={20} color={colors.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  isPassword
                  autoCapitalize="none"
                  autoComplete="password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  leftIcon={<Lock size={20} color={colors.textMuted} />}
                />
              )}
            />

            <Pressable onPress={handleForgotPassword} style={{ alignSelf: 'flex-end' }}>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 14,
                  fontWeight: '500',
                }}
              >
                Forgot password?
              </Text>
            </Pressable>
          </View>

          {/* Submit Button */}
          <View style={{ marginTop: 32 }}>
            <Button
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              disabled={isLoading}
              fullWidth
              size="lg"
            >
              Sign In
            </Button>
          </View>

          {/* Divider */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginVertical: 32,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text
              style={{
                marginHorizontal: 16,
                color: colors.textMuted,
                fontSize: 14,
              }}
            >
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {/* Register Link */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
              Don't have an account?{' '}
              <Link href="/(auth)/register" asChild>
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: '600',
                  }}
                >
                  Sign up
                </Text>
              </Link>
            </Text>
          </View>

          {/* Terms */}
          <View style={{ marginTop: 'auto', paddingTop: 32 }}>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              By continuing, you agree to our{' '}
              <Text style={{ color: colors.primary }}>Terms of Service</Text> and{' '}
              <Text style={{ color: colors.primary }}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

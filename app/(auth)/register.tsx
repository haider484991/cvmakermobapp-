import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Lock, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(1, 'Full name is required')
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be less than 100 characters'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain uppercase, lowercase, and number'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { signUp, isLoading, error, clearError } = useAuth();
  const [showError, setShowError] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    clearError();
    setShowError(false);

    const { error: signUpError } = await signUp(
      data.email,
      data.password,
      data.fullName
    );

    if (signUpError) {
      setShowError(true);
      return;
    }

    // Navigate to onboarding on successful registration
    router.replace('/(onboarding)/welcome');
  };

  const handleBack = () => {
    router.back();
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
            paddingTop: 16,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <Pressable
            onPress={handleBack}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <ArrowLeft size={24} color={colors.text} />
            <Text
              style={{
                color: colors.text,
                fontSize: 16,
                marginLeft: 8,
              }}
            >
              Back
            </Text>
          </Pressable>

          {/* Header */}
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                fontSize: 32,
                fontWeight: '700',
                color: colors.text,
                marginBottom: 8,
              }}
            >
              Create account
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.textSecondary,
                lineHeight: 24,
              }}
            >
              Start building your professional resume with AI assistance
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
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Full Name"
                  placeholder="Enter your full name"
                  autoCapitalize="words"
                  autoComplete="name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.fullName?.message}
                  leftIcon={<User size={20} color={colors.textMuted} />}
                />
              )}
            />

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
                  placeholder="Create a password"
                  isPassword
                  autoCapitalize="none"
                  autoComplete="new-password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  hint="Must be 8+ characters with uppercase, lowercase, and number"
                  leftIcon={<Lock size={20} color={colors.textMuted} />}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  isPassword
                  autoCapitalize="none"
                  autoComplete="new-password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                  leftIcon={<Lock size={20} color={colors.textMuted} />}
                />
              )}
            />
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
              Create Account
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

          {/* Login Link */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
              Already have an account?{' '}
              <Link href="/(auth)/login" asChild>
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: '600',
                  }}
                >
                  Sign in
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
              By creating an account, you agree to our{' '}
              <Text style={{ color: colors.primary }}>Terms of Service</Text> and{' '}
              <Text style={{ color: colors.primary }}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

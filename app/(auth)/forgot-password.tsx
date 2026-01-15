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
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { resetPassword, isLoading, error, clearError } = useAuth();
  const [showError, setShowError] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    clearError();
    setShowError(false);

    const { error: resetError } = await resetPassword(data.email);

    if (resetError) {
      setShowError(true);
      return;
    }

    setSubmittedEmail(data.email);
    setEmailSent(true);
  };

  const handleBack = () => {
    router.back();
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/login');
  };

  if (emailSent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 16,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Success Icon */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: `${colors.success}15`,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <CheckCircle size={40} color={colors.success} />
          </View>

          {/* Success Message */}
          <Text
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: colors.text,
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            Check your email
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 24,
              marginBottom: 32,
              paddingHorizontal: 16,
            }}
          >
            We've sent a password reset link to{'\n'}
            <Text style={{ fontWeight: '600', color: colors.text }}>
              {submittedEmail}
            </Text>
          </Text>

          {/* Instructions */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 32,
              width: '100%',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                lineHeight: 22,
              }}
            >
              Click the link in the email to reset your password. If you don't see
              the email, check your spam folder.
            </Text>
          </View>

          {/* Back to Login */}
          <Button onPress={handleBackToLogin} fullWidth size="lg">
            Back to Sign In
          </Button>

          {/* Resend Link */}
          <Pressable
            onPress={handleSubmit(onSubmit)}
            style={{ marginTop: 24 }}
            disabled={isLoading}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 15,
                fontWeight: '500',
              }}
            >
              {isLoading ? 'Sending...' : "Didn't receive the email? Resend"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
              Reset password
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.textSecondary,
                lineHeight: 24,
              }}
            >
              Enter your email address and we'll send you a link to reset your
              password
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
              Send Reset Link
            </Button>
          </View>

          {/* Back to Login Link */}
          <Pressable
            onPress={handleBackToLogin}
            style={{
              alignItems: 'center',
              marginTop: 24,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 15,
                fontWeight: '500',
              }}
            >
              Back to Sign In
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

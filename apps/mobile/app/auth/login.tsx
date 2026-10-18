import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { isClerkConfigured } from '../../lib/clerk';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [pending2FA, setPending2FA] = useState(false);
  const [secondFactorStrategy, setSecondFactorStrategy] = useState<string>('totp');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      setErrorMessage('Please provide both email and password');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!isClerkConfigured) {
      setErrorMessage('Clerk publishable key missing in .env (EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY).');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Step 1: set the identifier
      const { error: createErr } = await signIn.create({ identifier: email.trim().toLowerCase() });
      if (createErr) throw createErr;

      // Step 2: submit the password
      const { error: pwErr } = await signIn.password({ password });
      if (pwErr) throw pwErr;

      if (signIn.status === 'complete') {
        const { error: finalErr } = await signIn.finalize();
        if (finalErr) throw finalErr;
        await finalizeLogin();
      } else if (signIn.status === 'needs_second_factor') {
        setPending2FA(true);
      } else {
        setErrorMessage(`Sign in incomplete (${signIn.status}). Please try again.`);
      }
    } catch (err: any) {
      console.warn('[CLERK_SIGNIN_ERR]', err);
      setErrorMessage(err.longMessage || err.message || 'Failed to sign in');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFactorCode) {
      setErrorMessage('Please enter the 2FA verification code');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // ponytail: TOTP only for now; add mfa.verifyPhoneCode/verifyEmailCode paths when users request them
      const { error: verifyErr } = await signIn.mfa.verifyTOTP({ code: twoFactorCode.trim() });
      if (verifyErr) throw verifyErr;

      if (signIn.status === 'complete') {
        const { error: finalErr } = await signIn.finalize();
        if (finalErr) throw finalErr;
        await finalizeLogin();
      } else {
        setErrorMessage('Invalid 2FA code. Please try again.');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      console.warn('[CLERK_2FA_ERR]', err);
      setErrorMessage(err.longMessage || err.message || 'Invalid 2FA code');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const finalizeLogin = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const onboardingCompleted = await SecureStore.getItemAsync('humanaudit_onboarding_completed');
    if (onboardingCompleted === 'true') {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerArea}>
          <View style={styles.badgePill}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>HUMANAUDIT // AUTH</Text>
          </View>
          <Text style={Typography.heroTitle}>
            {pending2FA ? 'Two-Factor Authentication' : 'Athlete Sign In'}
          </Text>
          <Text style={[Typography.caption, { marginTop: 4 }]}>
            {pending2FA
              ? secondFactorStrategy === 'totp'
                ? 'Enter the 6-digit code from your Authenticator app (TOTP).'
                : 'Enter the verification code sent to your device.'
              : 'Access your biometric baseline, daily hydration, & wearable recovery sync.'}
          </Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.warning} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {pending2FA ? (
          <GlassCard style={{ width: '100%', marginBottom: Spacing.lg }}>
            <Text style={Typography.metricLabel}>
              {secondFactorStrategy === 'totp' ? 'AUTHENTICATOR CODE (TOTP)' : 'SECURITY CODE'}
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={18} color={Colors.hydration} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
                placeholder="123456"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.signInButton, { marginTop: Spacing.md }]}
              onPress={handleVerify2FA}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.signInButtonText}>Verify & Authorize Vault →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: Spacing.md, alignItems: 'center' }}
              onPress={() => setPending2FA(false)}
            >
              <Text style={{ color: Colors.textMuted, fontSize: 12 }}>← Back to Email Sign In</Text>
            </TouchableOpacity>
          </GlassCard>
        ) : (
          <>
            <GlassCard style={{ width: '100%', marginBottom: Spacing.lg }}>
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={Typography.metricLabel}>ATHLETE EMAIL</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="athlete@humanaudit.app"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={{ marginBottom: Spacing.sm }}>
                <Text style={Typography.metricLabel}>PASSWORD</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={Colors.hydration}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>

            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In & Sync Vault</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => router.push('/auth/register' as any)}>
            <Text style={styles.linkRegisterText}>Create Athlete ID →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trustBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.hydration} />
          <Text style={styles.trustBadgeText}>Clerk Authentication & Encrypted Telemetry</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    paddingTop: 40,
    paddingBottom: 40,
  },
  headerArea: {
    marginBottom: Spacing.xl,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(103, 232, 249, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.25)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radiusPill,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.hydration,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.hydration,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 6,
    marginTop: 4,
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  signInButton: {
    backgroundColor: Colors.hydration,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radiusButton,
    alignItems: 'center',
    shadowColor: Colors.hydration,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  signInButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  linkRegisterText: {
    color: Colors.hydration,
    fontSize: 12,
    fontWeight: '700',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 40,
    backgroundColor: 'rgba(103, 232, 249, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  trustBadgeText: {
    fontSize: 10,
    color: Colors.hydration,
    fontWeight: '600',
  },
});

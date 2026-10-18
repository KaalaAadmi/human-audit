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
import { useSignUp } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { SyncService } from '../../services/syncService';
import { isClerkConfigured } from '../../lib/clerk';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, fetchStatus } = useSignUp();

  // Profile Schema Fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('1997');
  const [birthMonth, setBirthMonth] = useState('05');
  const [birthDay, setBirthDay] = useState('18');
  const [heightCm, setHeightCm] = useState('178');

  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!displayName || !email || !password || !heightCm) {
      setErrorMessage('Please fill in all athlete profile fields');
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
      const { error: createErr } = await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        password,
        firstName: displayName.trim().split(' ')[0] || displayName.trim(),
        lastName: displayName.trim().split(' ').slice(1).join(' ') || '',
      });
      if (createErr) throw createErr;

      if (signUp.status === 'complete') {
        const { error: finalErr } = await signUp.finalize();
        if (finalErr) throw finalErr;
        await finalizeRegistration();
      } else {
        const { error: sendErr } = await signUp.verifications.sendEmailCode();
        if (sendErr) throw sendErr;
        setPendingVerification(true);
        setInfoMessage(`A 6-digit verification code was sent to ${email.trim()}`);
      }
    } catch (err: any) {
      console.warn('[CLERK_SIGNUP_ERR]', err);
      const msg = err.longMessage || err.message || 'Registration failed';
      setErrorMessage(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const { error: verifyErr } = await signUp.verifications.verifyEmailCode({ code: verificationCode.trim() });
      if (verifyErr) throw verifyErr;

      if (signUp.status === 'complete') {
        const { error: finalErr } = await signUp.finalize();
        if (finalErr) throw finalErr;
        await finalizeRegistration();
      } else {
        setErrorMessage('Verification incomplete. Please check the code.');
      }
    } catch (err: any) {
      const msg = err.longMessage || err.message || 'Invalid verification code';
      setErrorMessage(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) throw error;
      setInfoMessage(`A fresh verification code was sent to ${email.trim()}`);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setErrorMessage(err.longMessage || err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const finalizeRegistration = async () => {
    // Mark onboarding incomplete BEFORE finalize() triggers the auth redirect in _layout.tsx
    await SecureStore.setItemAsync('humanaudit_onboarding_completed', 'false');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const formattedBirthdate = `${birthYear.padStart(4, '0')}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;

    // Provision the profile row through the backend (it takes the user id from the Clerk token)
    try {
      await SyncService.updateUserProfile({
        email: email.trim().toLowerCase(),
        display_name: displayName.trim(),
        chronological_birthdate: formattedBirthdate,
        height_cm: heightCm.trim(),
        water_goal_ml: 3000,
        water_reminder_interval_mins: 90,
        water_reminder_enabled: true,
      });
    } catch (e) {
      console.warn('[PROFILE_PROVISION_ERR]', e);
      // Proceed to onboarding anyway; the profile will be re-attempted there.
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
            <Text style={styles.badgeText}>ATHLETE REGISTRATION</Text>
          </View>
          <Text style={Typography.heroTitle}>
            {pendingVerification ? 'Verify Email' : 'Create Athlete Profile'}
          </Text>
          <Text style={[Typography.caption, { marginTop: 4 }]}>
            {pendingVerification
              ? `Enter the 6-digit code sent to ${email}`
              : 'Enter your biometric identity attributes to initialize your cloud vault.'}
          </Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.warning} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {infoMessage && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={16} color={Colors.bioGreen} />
            <Text style={styles.infoText}>{infoMessage}</Text>
          </View>
        )}

        {pendingVerification ? (
          <GlassCard style={{ width: '100%', marginBottom: Spacing.lg }}>
            <Text style={Typography.metricLabel}>VERIFICATION CODE</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="123456"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.actionButton, { marginTop: Spacing.md }]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.actionButtonText}>Verify & Complete Registration →</Text>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md }}>
              <TouchableOpacity onPress={handleResendCode} disabled={resending}>
                <Text style={{ color: Colors.hydration, fontSize: 12, fontWeight: '700' }}>
                  {resending ? 'Resending...' : 'Resend Code'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPendingVerification(false)}>
                <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Edit Email / Password</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ) : (
          <>
            {/* Account Credentials Card */}
            <GlassCard style={{ width: '100%', marginBottom: Spacing.md }}>
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={Typography.metricLabel}>ATHLETE FULL NAME</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Arnav Bhattacharya"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <View style={{ marginBottom: Spacing.md }}>
                <Text style={Typography.metricLabel}>EMAIL ADDRESS</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="arnav@example.com"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={{ marginBottom: Spacing.xs }}>
                <Text style={Typography.metricLabel}>PASSWORD</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry
                  />
                </View>
              </View>
            </GlassCard>

            {/* Baseline Biometrics Card */}
            <GlassCard style={{ width: '100%', marginBottom: Spacing.lg }}>
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={Typography.metricLabel}>DATE OF BIRTH (YYYY / MM / DD)</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: 4 }}>
                  <TextInput
                    style={[styles.smallInput, { flex: 2 }]}
                    value={birthYear}
                    onChangeText={setBirthYear}
                    placeholder="YYYY (1997)"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                  <TextInput
                    style={[styles.smallInput, { flex: 1.2 }]}
                    value={birthMonth}
                    onChangeText={setBirthMonth}
                    placeholder="MM"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <TextInput
                    style={[styles.smallInput, { flex: 1.2 }]}
                    value={birthDay}
                    onChangeText={setBirthDay}
                    placeholder="DD"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>

              <View>
                <Text style={Typography.metricLabel}>HEIGHT (CM)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="178"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                  />
                  <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700' }}>cm</Text>
                </View>
              </View>
            </GlassCard>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.actionButtonText}>Register Athlete Profile →</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={styles.loginLinkRow}>
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Already registered? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login' as any)}>
            <Text style={{ color: Colors.bioGreen, fontSize: 12, fontWeight: '700' }}>Sign In here</Text>
          </TouchableOpacity>
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
    paddingTop: 50,
    paddingBottom: 40,
  },
  headerArea: {
    marginBottom: Spacing.lg,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
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
    backgroundColor: Colors.bioGreen,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.bioGreen,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoText: {
    color: Colors.bioGreen,
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
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    marginTop: 4,
  },
  smallInput: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radiusButton,
    alignItems: 'center',
    shadowColor: Colors.bioGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  actionButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  loginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
});

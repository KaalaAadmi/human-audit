import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  AppState,
  AppStateStatus,
  Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';

export const BIOMETRICS_ENABLED_KEY = 'humanaudit_biometrics_enabled';
export const BIOMETRICS_PROMPT_SEEN_KEY = 'humanaudit_biometrics_prompt_seen';

interface BiometricPrivacyLockProps {
  children?: React.ReactNode;
  isAuthenticated?: boolean;
}

export function BiometricPrivacyLock({ children, isAuthenticated }: BiometricPrivacyLockProps) {
  const [isPrivacyShieldVisible, setIsPrivacyShieldVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [showFirstTimePrompt, setShowFirstTimePrompt] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    checkBiometricSettings();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isBiometricEnabled, isAuthenticated]);

  const checkBiometricSettings = async () => {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
      const promptSeen = await SecureStore.getItemAsync(BIOMETRICS_PROMPT_SEEN_KEY);
      const isEnabled = enabled === 'true';
      setIsBiometricEnabled(isEnabled);

      // Trigger one-time prompt after first authentication if never seen
      if (isAuthenticated && promptSeen !== 'true' && !isEnabled) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (hasHardware) {
          setShowFirstTimePrompt(true);
        }
      }
    } catch (e) {
      console.warn('[BIOMETRIC_CHECK_ERR]', e);
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // Mask screen in app switcher
      setIsPrivacyShieldVisible(true);
      if (isBiometricEnabled) {
        setIsLocked(true);
      }
    }

    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      if (isBiometricEnabled) {
        setIsLocked(true);
        setIsPrivacyShieldVisible(true);
        await promptBiometricUnlock();
      } else {
        setIsPrivacyShieldVisible(false);
        setIsLocked(false);
      }
    }

    appState.current = nextAppState;
  };

  const promptBiometricUnlock = async () => {
    setAuthError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock HumanAudit Biometric Vault',
        fallbackLabel: 'Use Device Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsLocked(false);
        setIsPrivacyShieldVisible(false);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAuthError(result.error || 'Authentication required');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication error');
    }
  };

  const handleEnableBiometricsFromPrompt = async () => {
    await Haptics.selectionAsync();
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify Face ID / Fingerprint to Enable Lock',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, 'true');
        await SecureStore.setItemAsync(BIOMETRICS_PROMPT_SEEN_KEY, 'true');
        setIsBiometricEnabled(true);
        setShowFirstTimePrompt(false);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      await SecureStore.setItemAsync(BIOMETRICS_PROMPT_SEEN_KEY, 'true');
      setShowFirstTimePrompt(false);
    }
  };

  const handleDismissPrompt = async () => {
    await Haptics.selectionAsync();
    await SecureStore.setItemAsync(BIOMETRICS_PROMPT_SEEN_KEY, 'true');
    setShowFirstTimePrompt(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* App Switcher Privacy Shield Overlay */}
      {isPrivacyShieldVisible && !isLocked && (
        <View style={styles.shieldOverlay}>
          <View style={styles.shieldContent}>
            <View style={styles.shieldIconRing}>
              <Ionicons name="shield-checkmark" size={36} color={Colors.hydration} />
            </View>
            <Text style={Typography.heroTitle}>Privacy Shield Active</Text>
            <Text style={[Typography.caption, { textAlign: 'center', marginTop: 4 }]}>
              Biometric and telemetry records are masked in the app switcher.
            </Text>
          </View>
        </View>
      )}

      {/* Biometric Resume Lock Screen */}
      {isLocked && (
        <View style={styles.lockOverlay}>
          <View style={styles.lockContent}>
            <View style={styles.lockIconCircle}>
              <Ionicons name="finger-print" size={44} color={Colors.hydration} />
            </View>
            <Text style={Typography.statLabel}>VAULT ENCRYPTED</Text>
            <Text style={[Typography.heroTitle, { marginTop: 4, marginBottom: 4 }]}>
              HumanAudit Locked
            </Text>
            <Text style={[Typography.caption, { textAlign: 'center', maxWidth: 260 }]}>
              Authenticate with Face ID, Touch ID, or device passcode to access your biometric records.
            </Text>

            {authError && (
              <Text style={{ color: Colors.warning, fontSize: 12, marginTop: 12, fontWeight: '600' }}>
                {authError}
              </Text>
            )}

            <TouchableOpacity style={styles.unlockBtn} onPress={promptBiometricUnlock}>
              <Ionicons name="scan-outline" size={18} color="#000" />
              <Text style={styles.unlockBtnText}>Unlock Vault</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* First-Time Post-Login Biometric Opt-In Modal */}
      <Modal
        visible={showFirstTimePrompt}
        transparent
        animationType="fade"
        onRequestClose={handleDismissPrompt}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.promptIconCircle}>
              <Ionicons name="lock-closed" size={28} color={Colors.hydration} />
            </View>
            <Text style={Typography.statLabel}>SECURITY & PRIVACY</Text>
            <Text style={[Typography.cardTitle, { fontSize: 18, marginTop: 4, marginBottom: 6 }]}>
              Enable Biometric Lock?
            </Text>
            <Text style={[Typography.caption, { textAlign: 'center', lineHeight: 18, marginBottom: Spacing.lg }]}>
              Secure your recovery telemetry, body age, and water logs with Face ID or Touch ID when opening or switching apps.
            </Text>

            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleEnableBiometricsFromPrompt}>
              <Text style={styles.modalPrimaryBtnText}>Enable Face ID / Biometrics</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalSecondaryBtn} onPress={handleDismissPrompt}>
              <Text style={styles.modalSecondaryBtnText}>Maybe Later (In Settings)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  shieldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0C0D10',
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  shieldContent: {
    alignItems: 'center',
  },
  shieldIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(103, 232, 249, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.canvas,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  lockContent: {
    alignItems: 'center',
    width: '100%',
  },
  lockIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(103, 232, 249, 0.12)',
    borderWidth: 2,
    borderColor: Colors.hydration,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.hydration,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.hydration,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radiusButton,
    marginTop: Spacing.xl,
    width: '100%',
    justifyContent: 'center',
  },
  unlockBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.3)',
    borderRadius: Spacing.radiusCard,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  promptIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(103, 232, 249, 0.15)',
    borderWidth: 1,
    borderColor: Colors.hydration,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalPrimaryBtn: {
    backgroundColor: Colors.hydration,
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radiusButton,
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  modalPrimaryBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 13,
  },
  modalSecondaryBtn: {
    width: '100%',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});

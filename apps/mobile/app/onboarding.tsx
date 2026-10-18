import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from '../components/GlassCard';
import { SyncService } from '../services/syncService';

export default function OnboardingScreen() {
  const router = useRouter();

  // Wizard step state (1, 2, 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Biological Baseline (birthdate + height already collected at registration)
  const [weightKg, setWeightKg] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'prefer_not_to_say' | null>(null);
  const [waistCm, setWaistCm] = useState('');

  // Step 2: Native Health Connectors
  const [appleHealthEnabled, setAppleHealthEnabled] = useState(true);
  const [googleHealthEnabled, setGoogleHealthEnabled] = useState(false);

  // Step 3: Hydration Target
  const [selectedPreset, setSelectedPreset] = useState<'2500' | '3000' | '3500' | 'custom'>('3000');
  const [customMl, setCustomMl] = useState('3250');
  const [pushRemindersEnabled, setPushRemindersEnabled] = useState(true);

  const handleNextStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      await handleCompleteOnboarding();
    }
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Mark completed BEFORE the profile update — if the update fails the user
    // shouldn't be forced through onboarding again on next login.
    await SecureStore.setItemAsync('humanaudit_onboarding_completed', 'true');

    try {
      const targetWaterGoal = selectedPreset === 'custom' ? parseInt(customMl, 10) || 3000 : parseInt(selectedPreset, 10);

      await SyncService.updateUserProfile({
        weight_kg: weightKg ? parseFloat(weightKg) : undefined,
        sex: sex ?? undefined,
        waist_cm: waistCm ? parseFloat(waistCm) : undefined,
        water_goal_ml: targetWaterGoal,
        water_reminder_enabled: pushRemindersEnabled,
        water_reminder_interval_mins: 90,
      });
    } catch (e) {
      console.warn('[ONBOARDING_ERR]', e);
      // Non-fatal: profile can be updated in Settings later.
    } finally {
      setLoading(false);
    }

    router.replace('/(tabs)');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Step Indicator Header */}
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>ONBOARDING // STEP {step} OF 3</Text>
          </View>
          <View style={styles.stepBarsRow}>
            <View style={[styles.stepBar, step >= 1 && styles.stepBarActive]} />
            <View style={[styles.stepBar, step >= 2 && styles.stepBarActive]} />
            <View style={[styles.stepBar, step >= 3 && styles.stepBarActive]} />
          </View>
        </View>

        {/* STEP 1: BIOLOGICAL PROFILE */}
        {step === 1 && (
          <View>
            <Text style={Typography.heroTitle}>Body Metrics</Text>
            <Text style={[Typography.caption, { marginTop: 4, marginBottom: Spacing.xl }]}>
              A few more details to calibrate your biological age curve.
            </Text>

            <GlassCard style={{ gap: Spacing.md, marginBottom: Spacing.xl }}>
              <View>
                <Text style={Typography.metricLabel}>WEIGHT (KG)</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={weightKg}
                    onChangeText={setWeightKg}
                    keyboardType="numeric"
                    placeholder="e.g. 76.4"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Text style={styles.inputSuffix}>kg</Text>
                </View>
              </View>

              <View>
                <Text style={Typography.metricLabel}>BIOLOGICAL SEX</Text>
                <View style={[styles.presetChipsRow, { marginTop: 4 }]}>
                  {(['male', 'female', 'prefer_not_to_say'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.presetChip, sex === opt && styles.presetChipActive]}
                      onPress={() => { Haptics.selectionAsync(); setSex(opt); }}
                    >
                      <Text style={[styles.presetChipText, sex === opt && styles.presetChipTextActive]}>
                        {opt === 'male' ? 'Male' : opt === 'female' ? 'Female' : 'Prefer not to say'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={Typography.metricLabel}>WAIST CIRCUMFERENCE (CM) — OPTIONAL</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    value={waistCm}
                    onChangeText={setWaistCm}
                    keyboardType="numeric"
                    placeholder="e.g. 82"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Text style={styles.inputSuffix}>cm</Text>
                </View>
                <Text style={[Typography.caption, { marginTop: 4, color: Colors.textMuted }]}>
                  Required for VO₂ Max and Fitness Age. You can add this later in Settings.
                </Text>
              </View>
            </GlassCard>

            <View style={styles.infoCallout}>
              <Ionicons name="heart" size={16} color={Colors.bioGreen} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCalloutTitle}>RESTING HEART RATE AUTO-INGESTION</Text>
                <Text style={styles.infoCalloutDesc}>
                  Resting HR is pulled directly from your connected Apple Watch / Fitbit sensors to prevent manual drift.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 2: NATIVE WEARABLE CONNECTORS */}
        {step === 2 && (
          <View>
            <Text style={Typography.heroTitle}>Connect Health</Text>
            <Text style={[Typography.caption, { marginTop: 4, marginBottom: Spacing.xl }]}>
              Grant read access to auto-sync sleep, HR zones 1–5, and workouts.
            </Text>

            <GlassCard style={{ gap: Spacing.md, marginBottom: Spacing.xl }}>
              <View style={styles.connectorRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <View style={styles.connectorIconBg}>
                    <Ionicons name="logo-apple" size={20} color="#FFF" />
                  </View>
                  <View>
                    <Text style={Typography.cardTitle}>Apple HealthKit</Text>
                    <Text style={Typography.caption}>Watch Series / Ultra sync</Text>
                  </View>
                </View>
                <Switch
                  value={appleHealthEnabled}
                  onValueChange={v => {
                    Haptics.selectionAsync();
                    setAppleHealthEnabled(v);
                  }}
                  trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
                />
              </View>

              <View style={[styles.connectorRow, { borderTopWidth: 1, borderTopColor: Colors.borderMachined, paddingTop: Spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <View style={[styles.connectorIconBg, { backgroundColor: '#1E2029' }]}>
                    <Ionicons name="fitness-outline" size={20} color={Colors.readiness} />
                  </View>
                  <View>
                    <Text style={Typography.cardTitle}>Google Health Connect</Text>
                    <Text style={Typography.caption}>Fitbit / Pixel Watch sync</Text>
                  </View>
                </View>
                <Switch
                  value={googleHealthEnabled}
                  onValueChange={v => {
                    Haptics.selectionAsync();
                    setGoogleHealthEnabled(v);
                  }}
                  trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
                />
              </View>
            </GlassCard>

            <View style={styles.infoCallout}>
              <Ionicons name="swap-horizontal" size={16} color={Colors.hydration} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoCalloutTitle, { color: Colors.hydration }]}>SMART WEARABLE DEDUPLICATION</Text>
                <Text style={styles.infoCalloutDesc}>
                  If wearing both Apple Watch and Fitbit simultaneously, exercises with $\ge 50\%$ time overlap are resolved in favor of your top-priority device.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* STEP 3: HYDRATION TARGETS & REMINDERS */}
        {step === 3 && (
          <View>
            <Text style={Typography.heroTitle}>Hydration Target</Text>
            <Text style={[Typography.caption, { marginTop: 4, marginBottom: Spacing.xl }]}>
              Configure your daily water target and smart push reminders.
            </Text>

            <GlassCard style={{ gap: Spacing.md, marginBottom: Spacing.xl }}>
              <Text style={Typography.metricLabel}>PICK DAILY TARGET</Text>
              <View style={styles.presetChipsRow}>
                {(['2500', '3000', '3500', 'custom'] as const).map((opt) => {
                  const isSelected = selectedPreset === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.presetChip, isSelected && styles.presetChipActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedPreset(opt);
                      }}
                    >
                      <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                        {opt === 'custom' ? '+ Custom' : `${parseInt(opt, 10) / 1000}L`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Dynamic custom field (strictly shown only when '+ Custom' is selected) */}
              {selectedPreset === 'custom' && (
                <View style={{ marginTop: Spacing.xs }}>
                  <Text style={Typography.metricLabel}>CUSTOM VOLUME (ML)</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.textInput}
                      value={customMl}
                      onChangeText={setCustomMl}
                      keyboardType="numeric"
                      placeholder="3250"
                      placeholderTextColor={Colors.textMuted}
                    />
                    <Text style={styles.inputSuffix}>ml / day</Text>
                  </View>
                </View>
              )}

              {/* Push reminder toggle */}
              <View style={[styles.connectorRow, { borderTopWidth: 1, borderTopColor: Colors.borderMachined, paddingTop: Spacing.md, marginTop: Spacing.sm }]}>
                <View>
                  <Text style={Typography.cardTitle}>Push Reminders</Text>
                  <Text style={Typography.caption}>Every 90 mins (8:00 AM – 10:00 PM)</Text>
                </View>
                <Switch
                  value={pushRemindersEnabled}
                  onValueChange={v => {
                    Haptics.selectionAsync();
                    setPushRemindersEnabled(v);
                  }}
                  trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
                />
              </View>
            </GlassCard>

            <View style={styles.infoCallout}>
              <Ionicons name="sparkles" size={16} color={Colors.bioAmber} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoCalloutTitle, { color: Colors.bioAmber }]}>CELEBRATION MILESTONE</Text>
                <Text style={styles.infoCalloutDesc}>
                  As soon as you complete 100% of your daily intake, celebratory confetti particles will trigger on your screen!
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleNextStep}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {step === 3 ? 'Complete Setup & Launch OS' : 'Next Step →'}
            </Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radiusPill,
    marginBottom: Spacing.md,
  },
  stepBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Colors.bioGreen,
  },
  stepBarsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceHighlight,
  },
  stepBarActive: {
    backgroundColor: Colors.bioGreen,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginTop: 4,
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  inputSuffix: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: Spacing.radiusCard,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  infoCalloutTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.bioGreen,
    marginBottom: 2,
  },
  infoCalloutDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  connectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectorIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetChipActive: {
    backgroundColor: 'rgba(103, 232, 249, 0.15)',
    borderColor: Colors.hydration,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  presetChipTextActive: {
    color: Colors.hydration,
    fontWeight: '700',
  },
  primaryButton: {
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
  primaryButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
});

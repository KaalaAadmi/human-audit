import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { useToday } from '../../hooks/useToday';
import { syncAll } from '../../services/connectors';
import { SyncBanner } from '../../components/SyncBanner';

const NA = '--';
/** vitals.*_source holds the legacy label written by summaries_recompute. */
const SRC: Record<string, string> = { apple_health: 'Apple Health', google_health: 'Google Health' };
const initials = (name?: string) => (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export default function HomeDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loading, error, profile, goals, foods, waterMl, vitals, workouts, refresh } = useToday();
  const [pulling, setPulling] = useState(false);
  const pull = async () => {
    setPulling(true);
    await syncAll({ force: true }).catch(() => undefined);
    await refresh();
    setPulling(false);
  };

  if (loading && !goals && !profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.readiness} size="large" />
      </View>
    );
  }

  const sum = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') => Math.round(foods.reduce((a, f) => a + f[k], 0));
  const burn = workouts.reduce((a, w) => a + w.active_calories, 0);
  const targetCals = goals?.calories ?? null;
  const left = targetCals !== null ? targetCals - sum('calories') + burn : null;
  const sleepMin = vitals?.sleep_duration_seconds ? Math.round(vitals.sleep_duration_seconds / 60) : null;
  const rawBodyAge = vitals?.fitness_age ?? vitals?.body_age;
  const bodyAge = rawBodyAge !== undefined && rawBodyAge !== null ? Number(rawBodyAge) : null;
  const age = profile?.chronological_birthdate ? (Date.now() - new Date(profile.chronological_birthdate).getTime()) / 31557600000 : null;
  const ageDelta = bodyAge !== null && age !== null ? bodyAge - age : null;

  const rawWeight = vitals?.scale_weight_kg ?? profile?.weight_kg;
  const numWeight = rawWeight !== undefined && rawWeight !== null ? parseFloat(String(rawWeight)) : null;
  const displayWeight = numWeight && !isNaN(numWeight) && numWeight > 0 ? `${numWeight.toFixed(1)} kg` : NA;
  const readinessText = vitals?.readiness_score !== undefined && vitals?.readiness_score !== null
    ? `${vitals.readiness_score}%`
    : vitals?.readiness_tier
    ? vitals.readiness_tier.toUpperCase()
    : NA;

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]} refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={Colors.textMuted} />}>
      <View style={styles.header}>
        <View>
          <Text style={Typography.metricLabel}>
            TODAY • {new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase()}
          </Text>
          <Text style={Typography.heroTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.avatarPill} onPress={() => router.push('/settings')}>
          <Text style={styles.avatarText}>{initials(profile?.display_name)}</Text>
        </TouchableOpacity>
      </View>

      <SyncBanner onDone={refresh} />
      {error && <Text style={[Typography.caption, { color: Colors.strain, marginBottom: Spacing.md }]}>Couldn't reach the server: {error}</Text>}

      <View style={styles.dualGrid}>
        <GlassCard style={styles.metricCard} borderColor="rgba(110, 231, 183, 0.15)">
          <Text style={Typography.metricLabel}>Readiness</Text>
          <Text style={[styles.bigMetric, { color: Colors.readiness }]}>{readinessText}</Text>
          <Text style={Typography.caption}>
            {vitals ? `HRV ${vitals.overnight_hrv_rmssd != null ? Math.round(vitals.overnight_hrv_rmssd) : NA} ms • RHR ${vitals.resting_heart_rate ?? NA}` : 'Connect a wearable to sync'}
          </Text>
        </GlassCard>

        <GlassCard style={styles.metricCard} borderColor="rgba(251, 191, 36, 0.15)">
          <Text style={Typography.metricLabel}>Day Strain</Text>
          <Text style={[styles.bigMetric, { color: Colors.strain }]}>{vitals?.day_strain ? Number(vitals.day_strain).toFixed(1) : NA}</Text>
          <Text style={[Typography.caption, { color: Colors.strain }]}>{vitals ? `${workouts.length} workout(s) today` : 'No data yet'}</Text>
        </GlassCard>
      </View>

      <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/body-age' as any)}>
      <GlassCard style={styles.orbWidget} borderColor="rgba(192, 132, 252, 0.18)">
        <View style={styles.miniOrb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.widgetTitle}>
            {sleepMin !== null
              ? `${Math.floor(sleepMin / 60)}h ${sleepMin % 60}m Asleep${bodyAge !== null ? ` • Body Age ${bodyAge.toFixed(1)}` : ''}`
              : 'No sleep data yet'}
          </Text>
          <Text style={Typography.caption}>
            {ageDelta !== null
              ? `${Math.abs(ageDelta).toFixed(1)} yrs ${ageDelta <= 0 ? 'younger' : 'older'} than your age`
              : sleepMin !== null
              ? `Body age appears once vitals sync`
              : 'Sleep and body age appear once a wearable syncs'}
            {vitals?.sleep_source ? ` • Sleep · ${SRC[vitals.sleep_source] ?? vitals.sleep_source}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </GlassCard>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/diary')}>
        <GlassCard style={styles.nutritionCard}>
          <View style={styles.cardHeader}>
            <Text style={Typography.cardTitle}>Today's Nutrition</Text>
            {loading && !goals ? (
              <ActivityIndicator size="small" color={Colors.readiness} />
            ) : (
              <Text style={{ fontSize: 11, color: Colors.readiness, fontWeight: '700' }}>
                {left !== null ? `${left} kcal Left →` : '-- kcal Left →'}
              </Text>
            )}
          </View>
          {loading && !goals ? (
            <ActivityIndicator size="small" color={Colors.readiness} style={{ marginVertical: Spacing.xs }} />
          ) : (
            <View style={styles.macrosRow}>
              <Text style={Typography.caption}>
                P: <Text style={{ color: Colors.protein, fontWeight: '700' }}>{sum('proteinG')}/{goals?.proteinG ?? '--'}g</Text>
              </Text>
              <Text style={Typography.caption}>
                C: <Text style={{ color: Colors.carbs, fontWeight: '700' }}>{sum('carbsG')}/{goals?.carbsG ?? '--'}g</Text>
              </Text>
              <Text style={Typography.caption}>
                F: <Text style={{ color: Colors.fats, fontWeight: '700' }}>{sum('fatG')}/{goals?.fatG ?? '--'}g</Text>
              </Text>
            </View>
          )}
        </GlassCard>
      </TouchableOpacity>

      <View style={styles.dualGrid}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/water')}>
          <GlassCard style={styles.subCard} borderColor="rgba(103, 232, 249, 0.15)">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="water-outline" size={12} color={Colors.hydration} />
              <Text style={[Typography.metricLabel, { color: Colors.hydration }]}>Water</Text>
            </View>
            <Text style={styles.subMetric}>{waterMl.toLocaleString()} ml</Text>
          </GlassCard>
        </TouchableOpacity>

        <GlassCard style={styles.subCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="scale-outline" size={12} color={Colors.textMuted} />
            <Text style={Typography.metricLabel}>Weight</Text>
          </View>
          <Text style={styles.subMetric}>{displayWeight}</Text>
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
  },
  avatarPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  dualGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.md,
  },
  bigMetric: {
    fontSize: 26,
    fontWeight: '800',
    marginVertical: 2,
    letterSpacing: -0.5,
  },
  orbWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  miniOrb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.sleep,
    shadowColor: Colors.sleep,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  nutritionCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subCard: {
    padding: Spacing.md,
  },
  subMetric: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
  },
});
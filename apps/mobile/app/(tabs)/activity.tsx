import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { useToday } from '../../hooks/useToday';
import { syncAll } from '../../services/connectors';

// ponytail: zone percentage ranges are placeholders until the zone boundaries are decided (see docs/PRD.md).
const ZONES = [
  { n: 5, label: 'ZONE 5 (90-100%)', desc: 'VO2 Max / Anaerobic Peak', color: Colors.bioRose },
  { n: 4, label: 'ZONE 4 (80-90%)', desc: 'Lactate Threshold', color: Colors.bioAmber },
  { n: 3, label: 'ZONE 3 (70-80%)', desc: 'Aerobic Tempo', color: Colors.bioGreen },
  { n: 2, label: 'ZONE 2 (60-70%)', desc: 'Fat Oxidation / Base', color: Colors.skyBlue },
  { n: 1, label: 'ZONE 1 (50-60%)', desc: 'Active Recovery', color: Colors.textMuted },
] as const;

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  fitbit: { label: 'FITBIT', color: Colors.bioGreen },
  apple_health: { label: 'APPLE HEALTH', color: Colors.skyBlue },
  google_health: { label: 'GOOGLE HEALTH', color: Colors.bioAmber },
};

const prettyType = (t: string) => String(t).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function WorkoutCard({ w, active, onPress }: { w: any; active: boolean; onPress: () => void }) {
  const badge = SOURCE_BADGE[w.source] ?? { label: String(w.source).toUpperCase(), color: Colors.textMuted };
  return (
    <Pressable onPress={onPress}>
      <GlassCard style={[styles.workoutCard, active && { borderColor: Colors.bioGreen, backgroundColor: 'rgba(52, 211, 153, 0.05)' }]}>
        <View style={styles.badgeRow}>
          <View style={[styles.sourceBadge, { borderColor: badge.color }]}>
            <Text style={[Typography.caption, { color: badge.color, fontSize: 10, fontWeight: '700' }]}>{badge.label}</Text>
          </View>
          {w.start_time && (
            <Text style={[Typography.caption, { fontSize: 10, color: Colors.textMuted }]}>
              {new Date(w.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              {' • '}
              {new Date(w.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
        <Text style={[Typography.cardTitle, { marginTop: 4 }]}>{prettyType(w.workout_type)}</Text>
        <Text style={[Typography.caption, { marginTop: 2 }]}>
          {Math.round(w.duration_seconds / 60)} min • {w.active_calories} kcal
        </Text>
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryItem}>
            <Text style={Typography.caption}>AVG HR</Text>
            <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>{w.avg_heart_rate ?? '--'} bpm</Text>
          </View>
          <View style={styles.telemetryItem}>
            <Text style={Typography.caption}>MAX HR</Text>
            <Text style={[Typography.bodyMono, { color: Colors.bioRose }]}>{w.max_heart_rate ?? '--'} bpm</Text>
          </View>
          <View style={styles.telemetryItem}>
            <Text style={Typography.caption}>ACTIVE BURN</Text>
            <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>{w.active_calories} kcal</Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

export default function ActivityScreen() {
  const { loading, error, workouts, recentWorkouts, vitals, refresh } = useToday();
  const [pulling, setPulling] = useState(false);
  const pull = async () => {
    setPulling(true);
    await syncAll({ force: true }).catch(() => undefined);
    await refresh();
    setPulling(false);
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={Colors.bioGreen} /></View>;

  const active = workouts.find(w => w.id === selectedId) ?? workouts[0];
  const mins = (sec: number) => `${Math.round(sec / 60)}m`;
  const zoneSec = (w: any, n: number): number => w[`zone${n}_seconds`];
  const zoneTotal = active ? [1, 2, 3, 4, 5].reduce((a, n) => a + zoneSec(active, n), 0) : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={Colors.textMuted} />}>
        <View style={styles.header}>
          <Text style={Typography.heroTitle}>Activity & Strain</Text>
          {(vitals || workouts.length > 0) && (
            <View style={styles.syncBadge}>
              <View style={styles.syncDot} />
              <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700' }]}>WEARABLE SYNCED</Text>
            </View>
          )}
        </View>

        {error && <Text style={[Typography.caption, { color: Colors.bioRose, marginBottom: Spacing.md }]}>Couldn't load activity: {error}</Text>}

        <GlassCard style={styles.strainCard}>
          <Text style={Typography.statLabel}>DAY STRAIN WORKLOAD</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
            <Text style={[Typography.displayLarge, { color: Colors.bioAmber }]}>{vitals ? Number(vitals.day_strain).toFixed(1) : '--'}</Text>
            <Text style={[Typography.bodyMono, { color: Colors.textMuted, fontSize: 18 }]}> / 21.0</Text>
          </View>
          {!vitals && <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 4 }]}>Connect a wearable to see your strain.</Text>}
        </GlassCard>

        {!active && (
          <GlassCard style={styles.zonesCard}>
            <Text style={Typography.cardTitle}>No workouts today</Text>
            <Text style={[Typography.caption, { marginTop: 4 }]}>Workouts from your wearable will appear here once synced.</Text>
          </GlassCard>
        )}

        {active && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={Typography.cardTitle}>Karvonen HR Reserve Zones (1–5)</Text>
              <Text style={Typography.caption}>Heart rate reserve bucketing</Text>
            </View>

            <GlassCard style={styles.zonesCard}>
              <Text style={[Typography.statLabel, { marginBottom: Spacing.sm }]}>
                {String(active.workout_type).toUpperCase()} — INTENSITY DISTRIBUTION
              </Text>
              {ZONES.map((z, i) => (
                <View key={z.n}>
                  <View style={[styles.zoneRow, i > 0 && { marginTop: Spacing.sm }]}>
                    <View style={styles.zoneMeta}>
                      <Text style={[Typography.caption, { color: z.color, fontWeight: '700' }]}>{z.label}</Text>
                      <Text style={Typography.caption}>{z.desc}</Text>
                    </View>
                    <Text style={[Typography.bodyMono, { color: z.color }]}>{mins(zoneSec(active, z.n))}</Text>
                  </View>
                  <View style={styles.zoneBarTrack}>
                    <View style={[styles.zoneBarFill, { width: `${zoneTotal ? (zoneSec(active, z.n) / zoneTotal) * 100 : 0}%`, backgroundColor: z.color }]} />
                  </View>
                </View>
              ))}
            </GlassCard>

            <View style={styles.sectionHeader}>
              <Text style={Typography.cardTitle}>Today's Workouts</Text>
              <Text style={Typography.caption}>Fitbit prioritized over Apple / Google</Text>
            </View>

            {workouts.map(w => <WorkoutCard key={w.id} w={w} active={w.id === active.id} onPress={() => { Haptics.selectionAsync(); setSelectedId(w.id); }} />)}
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Previous Workouts</Text>
          <Text style={Typography.caption}>Synced from your wearable • most recent first</Text>
        </View>
        {recentWorkouts.length > 0
          ? recentWorkouts.map(w => <WorkoutCard key={w.id} w={w} active={false} onPress={() => {}} />)
          : <Text style={[Typography.caption, { marginBottom: Spacing.md }]}>No previous workouts yet.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingTop: 54,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    gap: 6,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.bioGreen,
  },
  strainCard: {
    marginBottom: Spacing.xl,
  },
  strainTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  strainTargetPill: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  zonesCard: {
    marginBottom: Spacing.xl,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  zoneMeta: {
    flexDirection: 'column',
  },
  zoneBarTrack: {
    height: 8,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  zoneBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  workoutCard: {
    marginBottom: Spacing.md,
  },
  workoutTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderMachined,
  },
  telemetryItem: {
    alignItems: 'center',
  },
});

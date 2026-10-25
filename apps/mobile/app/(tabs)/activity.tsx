import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { useToday } from '../../hooks/useToday';
import { syncAll } from '../../services/connectors';
import { SyncBanner } from '../../components/SyncBanner';
import { WorkoutCard } from '../../components/WorkoutCard';

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { loading, error, workouts, recentWorkouts, vitals, refresh } = useToday();
  const [pulling, setPulling] = useState(false);
  const pull = async () => {
    setPulling(true);
    await syncAll({ force: true }).catch(() => undefined);
    await refresh();
    setPulling(false);
  };
  const router = useRouter();
  const open = (w: any) => { Haptics.selectionAsync(); router.push({ pathname: '/workout/[id]', params: { id: w.id, w: JSON.stringify(w) } } as any); };

  if (loading) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={Colors.bioGreen} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: Spacing.lg }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={Colors.textPure} />}>
        <View style={styles.header}>
          <Text style={[Typography.heroTitle, { flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit>Activity & Strain</Text>
          {(vitals || workouts.length > 0) && (
            <View style={styles.syncBadge}>
              <View style={styles.syncDot} />
              <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700', fontSize: 9 }]}>WEARABLE SYNCED</Text>
            </View>
          )}
        </View>

        <SyncBanner onDone={refresh} />
        {error && <Text style={[Typography.caption, { color: Colors.bioRose, marginBottom: Spacing.md }]}>Couldn't load activity: {error}</Text>}

        <GlassCard style={styles.strainCard}>
          <Text style={Typography.statLabel}>DAY STRAIN WORKLOAD</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
            <Text style={[Typography.displayLarge, { color: Colors.bioAmber }]}>{vitals ? Number(vitals.day_strain).toFixed(1) : '--'}</Text>
            <Text style={[Typography.bodyMono, { color: Colors.textMuted, fontSize: 18 }]}> / 21.0</Text>
          </View>
          {!vitals && <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 4 }]}>Connect a wearable to see your strain.</Text>}
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Today's Workouts</Text>
          <Text style={Typography.caption}>Tap a workout for heart rate zones and details</Text>
        </View>
        {workouts.length > 0
          ? workouts.map((w) => <WorkoutCard key={w.id} w={w} onPress={() => open(w)} />)
          : <Text style={[Typography.caption, { marginBottom: Spacing.md }]}>No workouts today. Workouts from your wearable will appear here once synced.</Text>}

        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Previous Workouts</Text>
          <Text style={Typography.caption}>Synced from your wearable • most recent first</Text>
        </View>
        {recentWorkouts.length > 0
          ? recentWorkouts.map(w => <WorkoutCard key={w.id} w={w} onPress={() => open(w)} />)
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
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    gap: 4,
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

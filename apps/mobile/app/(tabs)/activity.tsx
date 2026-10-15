import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { WorkoutRecord } from '../../services/wearableEngine';

export default function ActivityScreen() {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>('w_1');

  // Sample deduplicated workouts synced from Fitbit/Apple Watch
  const workouts: WorkoutRecord[] = [
    {
      id: 'w_1',
      source: 'fitbit',
      activityName: 'Outdoor Tempo Run',
      startTime: '2025-05-18T07:15:00Z',
      endTime: '2025-05-18T08:05:00Z',
      durationMinutes: 50,
      caloriesBurned: 520,
      avgHeartRate: 154,
      maxHeartRate: 178,
      strainScore: 14.8,
      zones: {
        zone1Sec: 180,  // 3m
        zone2Sec: 720,  // 12m
        zone3Sec: 1200, // 20m
        zone4Sec: 660,  // 11m
        zone5Sec: 240,  // 4m
        totalSec: 3000,
      },
    },
    {
      id: 'w_2',
      source: 'apple_health',
      activityName: 'Hypertrophy Upper Body',
      startTime: '2025-05-18T17:30:00Z',
      endTime: '2025-05-18T18:30:00Z',
      durationMinutes: 60,
      caloriesBurned: 380,
      avgHeartRate: 128,
      maxHeartRate: 158,
      strainScore: 10.4,
      zones: {
        zone1Sec: 900,  // 15m
        zone2Sec: 1500, // 25m
        zone3Sec: 900,  // 15m
        zone4Sec: 300,  // 5m
        zone5Sec: 0,
        totalSec: 3600,
      },
    },
  ];

  const totalDayStrain = 15.6; // Aggregate day strain
  const activeWorkout = workouts.find(w => w.id === selectedWorkoutId) || workouts[0];

  const formatMinutes = (sec: number) => {
    const mins = Math.round(sec / 60);
    return `${mins}m`;
  };

  const getSourceBadge = (source: 'fitbit' | 'apple_health' | 'health_connect') => {
    switch (source) {
      case 'fitbit':
        return { label: 'FITBIT (PRIORITY 1)', color: Colors.bioGreen };
      case 'apple_health':
        return { label: 'APPLE HEALTH', color: Colors.skyBlue };
      case 'health_connect':
        return { label: 'GOOGLE HEALTH', color: Colors.bioAmber };
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={Typography.heroTitle}>Activity & Strain</Text>
          <View style={styles.syncBadge}>
            <View style={styles.syncDot} />
            <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700' }]}>WEARABLE LIVE</Text>
          </View>
        </View>

        {/* Day Strain Hero Dial Card */}
        <GlassCard style={styles.strainCard}>
          <View style={styles.strainTopRow}>
            <View>
              <Text style={Typography.statLabel}>DAY STRAIN WORKLOAD</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                <Text style={[Typography.displayLarge, { color: Colors.bioAmber }]}>{totalDayStrain}</Text>
                <Text style={[Typography.bodyMono, { color: Colors.textMuted, fontSize: 18 }]}> / 21.0</Text>
              </View>
              <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 4 }]}>
                Optimal Training Stimulus Reached
              </Text>
            </View>
            <View style={styles.strainTargetPill}>
              <Text style={[Typography.caption, { color: Colors.bioAmber, fontWeight: '700' }]}>TARGET: 14.0–17.5</Text>
            </View>
          </View>
        </GlassCard>

        {/* Karvonen HRR Zone 1-5 Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Karvonen HR Reserve Zones (1–5)</Text>
          <Text style={Typography.caption}>Heart rate reserve bucketing</Text>
        </View>

        <GlassCard style={styles.zonesCard}>
          <Text style={[Typography.statLabel, { marginBottom: Spacing.sm }]}>
            {activeWorkout.activityName.toUpperCase()} — INTENSITY DISTRIBUTION
          </Text>

          {/* Zone 5 */}
          <View style={styles.zoneRow}>
            <View style={styles.zoneMeta}>
              <Text style={[Typography.caption, { color: Colors.bioRose, fontWeight: '700' }]}>ZONE 5 (90-100%)</Text>
              <Text style={Typography.caption}>VO2 Max / Anaerobic Peak</Text>
            </View>
            <Text style={[Typography.bodyMono, { color: Colors.bioRose }]}>{formatMinutes(activeWorkout.zones.zone5Sec)}</Text>
          </View>
          <View style={styles.zoneBarTrack}>
            <View
              style={[
                styles.zoneBarFill,
                {
                  width: `${(activeWorkout.zones.zone5Sec / activeWorkout.zones.totalSec) * 100}%`,
                  backgroundColor: Colors.bioRose,
                },
              ]}
            />
          </View>

          {/* Zone 4 */}
          <View style={[styles.zoneRow, { marginTop: Spacing.sm }]}>
            <View style={styles.zoneMeta}>
              <Text style={[Typography.caption, { color: Colors.bioAmber, fontWeight: '700' }]}>ZONE 4 (80-90%)</Text>
              <Text style={Typography.caption}>Lactate Threshold</Text>
            </View>
            <Text style={[Typography.bodyMono, { color: Colors.bioAmber }]}>{formatMinutes(activeWorkout.zones.zone4Sec)}</Text>
          </View>
          <View style={styles.zoneBarTrack}>
            <View
              style={[
                styles.zoneBarFill,
                {
                  width: `${(activeWorkout.zones.zone4Sec / activeWorkout.zones.totalSec) * 100}%`,
                  backgroundColor: Colors.bioAmber,
                },
              ]}
            />
          </View>

          {/* Zone 3 */}
          <View style={[styles.zoneRow, { marginTop: Spacing.sm }]}>
            <View style={styles.zoneMeta}>
              <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700' }]}>ZONE 3 (70-80%)</Text>
              <Text style={Typography.caption}>Aerobic Tempo</Text>
            </View>
            <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>{formatMinutes(activeWorkout.zones.zone3Sec)}</Text>
          </View>
          <View style={styles.zoneBarTrack}>
            <View
              style={[
                styles.zoneBarFill,
                {
                  width: `${(activeWorkout.zones.zone3Sec / activeWorkout.zones.totalSec) * 100}%`,
                  backgroundColor: Colors.bioGreen,
                },
              ]}
            />
          </View>

          {/* Zone 2 */}
          <View style={[styles.zoneRow, { marginTop: Spacing.sm }]}>
            <View style={styles.zoneMeta}>
              <Text style={[Typography.caption, { color: Colors.skyBlue, fontWeight: '700' }]}>ZONE 2 (60-70%)</Text>
              <Text style={Typography.caption}>Fat Oxidation / Base</Text>
            </View>
            <Text style={[Typography.bodyMono, { color: Colors.skyBlue }]}>{formatMinutes(activeWorkout.zones.zone2Sec)}</Text>
          </View>
          <View style={styles.zoneBarTrack}>
            <View
              style={[
                styles.zoneBarFill,
                {
                  width: `${(activeWorkout.zones.zone2Sec / activeWorkout.zones.totalSec) * 100}%`,
                  backgroundColor: Colors.skyBlue,
                },
              ]}
            />
          </View>

          {/* Zone 1 */}
          <View style={[styles.zoneRow, { marginTop: Spacing.sm }]}>
            <View style={styles.zoneMeta}>
              <Text style={[Typography.caption, { color: Colors.textMuted, fontWeight: '700' }]}>ZONE 1 (50-60%)</Text>
              <Text style={Typography.caption}>Active Recovery</Text>
            </View>
            <Text style={[Typography.bodyMono, { color: Colors.textMuted }]}>{formatMinutes(activeWorkout.zones.zone1Sec)}</Text>
          </View>
          <View style={styles.zoneBarTrack}>
            <View
              style={[
                styles.zoneBarFill,
                {
                  width: `${(activeWorkout.zones.zone1Sec / activeWorkout.zones.totalSec) * 100}%`,
                  backgroundColor: Colors.textMuted,
                },
              ]}
            />
          </View>
        </GlassCard>

        {/* Deduplicated Workouts List */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Deduplicated Workouts</Text>
          <Text style={Typography.caption}>Fitbit prioritized over Apple / Google</Text>
        </View>

        {workouts.map(w => {
          const badge = getSourceBadge(w.source);
          const isSelected = selectedWorkoutId === w.id;

          return (
            <Pressable
              key={w.id}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedWorkoutId(w.id);
              }}
            >
              <GlassCard
                style={[
                  styles.workoutCard,
                  isSelected && { borderColor: Colors.bioGreen, backgroundColor: 'rgba(52, 211, 153, 0.05)' },
                ]}
              >
                <View style={styles.workoutTopRow}>
                  <View>
                    <View style={styles.badgeRow}>
                      <View style={[styles.sourceBadge, { borderColor: badge.color }]}>
                        <Text style={[Typography.caption, { color: badge.color, fontSize: 10, fontWeight: '700' }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={[Typography.cardTitle, { marginTop: 4 }]}>{w.activityName}</Text>
                    <Text style={[Typography.caption, { marginTop: 2 }]}>
                      {w.durationMinutes} min • {w.caloriesBurned} kcal
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[Typography.statLabel, { color: Colors.bioAmber }]}>STRAIN</Text>
                    <Text style={[Typography.bodyMono, { color: Colors.bioAmber, fontSize: 20, fontWeight: '700' }]}>
                      {w.strainScore}
                    </Text>
                  </View>
                </View>

                <View style={styles.telemetryRow}>
                  <View style={styles.telemetryItem}>
                    <Text style={Typography.caption}>AVG HR</Text>
                    <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>{w.avgHeartRate} bpm</Text>
                  </View>
                  <View style={styles.telemetryItem}>
                    <Text style={Typography.caption}>MAX HR</Text>
                    <Text style={[Typography.bodyMono, { color: Colors.bioRose }]}>{w.maxHeartRate} bpm</Text>
                  </View>
                  <View style={styles.telemetryItem}>
                    <Text style={Typography.caption}>ACTIVE BURN</Text>
                    <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>{w.caloriesBurned} kcal</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
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

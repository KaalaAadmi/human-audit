import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from './GlassCard';

export const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  fitbit: { label: 'FITBIT', color: Colors.bioGreen },
  apple_health: { label: 'APPLE HEALTH', color: Colors.skyBlue },
  google_health: { label: 'GOOGLE HEALTH', color: Colors.bioAmber },
};

export const prettyType = (t: string) => String(t).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function WorkoutCard({ w, onPress }: { w: any; onPress: () => void }) {
  const badge = SOURCE_BADGE[w.source] ?? { label: String(w.source).toUpperCase(), color: Colors.textMuted };
  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.card}>
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
        <Text style={[Typography.caption, { marginTop: 2 }]}>{Math.round(w.duration_seconds / 60)} min • {w.active_calories} kcal</Text>
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryItem}>
            <Text style={Typography.caption}>AVG HR</Text>
            <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>{w.avg_heart_rate ?? '--'} bpm</Text>
          </View>
          {w.max_heart_rate != null && ( // Google Health exercises carry no max HR
            <View style={styles.telemetryItem}>
              <Text style={Typography.caption}>MAX HR</Text>
              <Text style={[Typography.bodyMono, { color: Colors.bioRose }]}>{w.max_heart_rate} bpm</Text>
            </View>
          )}
          <View style={styles.telemetryItem}>
            <Text style={Typography.caption}>ACTIVE BURN</Text>
            <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>{w.active_calories} kcal</Text>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md },
  badgeRow: { flexDirection: 'row', gap: 4 },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  telemetryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderMachined },
  telemetryItem: { alignItems: 'center' },
});

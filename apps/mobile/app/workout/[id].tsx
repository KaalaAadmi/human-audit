import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { SOURCE_BADGE, prettyType } from '../../components/WorkoutCard';

// ponytail: zone percentage ranges are placeholders until the zone boundaries are decided (see docs/PRD.md).
const ZONES = [
  { n: 5, label: 'ZONE 5 (90-100%)', desc: 'VO2 Max / Anaerobic Peak', color: Colors.bioRose },
  { n: 4, label: 'ZONE 4 (80-90%)', desc: 'Lactate Threshold', color: Colors.bioAmber },
  { n: 3, label: 'ZONE 3 (70-80%)', desc: 'Aerobic Tempo', color: Colors.bioGreen },
  { n: 2, label: 'ZONE 2 (60-70%)', desc: 'Fat Oxidation / Base', color: Colors.skyBlue },
  { n: 1, label: 'ZONE 1 (50-60%)', desc: 'Active Recovery', color: Colors.textMuted },
] as const;

const hm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--');
const mins = (sec: number) => `${Math.round(sec / 60)}m`;

/** Receives the whole workout row as a JSON param (the list already has it; no extra endpoint). */
export default function WorkoutDetail() {
  const { w: raw } = useLocalSearchParams<{ w: string }>();
  const router = useRouter();
  const w = JSON.parse(raw ?? 'null');
  if (!w) return null;
  const badge = SOURCE_BADGE[w.source] ?? { label: String(w.source).toUpperCase(), color: Colors.textMuted };
  const zoneSec = (n: number): number => w[`zone${n}_seconds`] ?? 0;
  const total = [1, 2, 3, 4, 5].reduce((a, n) => a + zoneSec(n), 0);
  const stat = (k: string, v: string, color: string = Colors.textPure) => (
    <View style={styles.stat}><Text style={Typography.caption}>{k}</Text><Text style={[Typography.bodyMono, { color }]}>{v}</Text></View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>{prettyType(w.workout_type)}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
        <Text style={[Typography.caption, { color: badge.color, fontWeight: '700' }]}>
          {badge.label} • {new Date(w.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        <GlassCard>
          <View style={styles.statRow}>
            {stat('START', hm(w.start_time))}
            {stat('END', hm(w.end_time))}
            {stat('DURATION', `${Math.floor(w.duration_seconds / 60)}m ${w.duration_seconds % 60}s`)}
          </View>
          <View style={[styles.statRow, styles.divider]}>
            {stat('AVG HR', `${w.avg_heart_rate ?? '--'} bpm`)}
            {w.max_heart_rate != null && stat('MAX HR', `${w.max_heart_rate} bpm`, Colors.bioRose)}
            {stat('ACTIVE BURN', `${w.active_calories} kcal`, Colors.bioGreen)}
          </View>
        </GlassCard>

        <Text style={Typography.cardTitle}>Heart rate zones</Text>
        <GlassCard>
          {ZONES.map((z, i) => (
            <View key={z.n} style={i > 0 && { marginTop: Spacing.sm }}>
              <View style={styles.zoneRow}>
                <View>
                  <Text style={[Typography.caption, { color: z.color, fontWeight: '700' }]}>{z.label}</Text>
                  <Text style={Typography.caption}>{z.desc}</Text>
                </View>
                <Text style={[Typography.bodyMono, { color: z.color }]}>{mins(zoneSec(z.n))}</Text>
              </View>
              <View style={styles.track}>
                <View style={{ height: '100%', borderRadius: 4, backgroundColor: z.color, width: `${total ? (zoneSec(z.n) / total) * 100 : 0}%` }} />
              </View>
            </View>
          ))}
          {w.source === 'apple_health' && (
            <Text style={[Typography.caption, { marginTop: Spacing.sm, color: Colors.textMuted }]}>Apple Health does not report zone times yet; the whole session is shown as Zone 3.</Text>
          )}
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  divider: { marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderMachined },
  stat: { alignItems: 'center', flex: 1 },
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  track: { height: 8, backgroundColor: Colors.surfaceHighlight, borderRadius: 4, overflow: 'hidden' },
});

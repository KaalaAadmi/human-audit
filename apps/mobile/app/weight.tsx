import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from '../components/GlassCard';
import { SyncService } from '../services/syncService';

type Point = { date: string; kg: number };
const CHART_H = 180;
const PAD = 14;
const fmtDate = (d: string, withYear = false) =>
  new Date(`${d}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });

/** Line chart drawn with plain Views (no chart/SVG dependency): dots joined by rotated 2px bars. */
function Chart({ points, width }: { points: Point[]; width: number }) {
  const kgs = points.map((p) => p.kg);
  const lo = Math.min(...kgs), hi = Math.max(...kgs);
  const span = hi - lo || 1; // single value / flat line sits mid-chart
  const t0 = new Date(points[0].date).getTime();
  const tSpan = new Date(points[points.length - 1].date).getTime() - t0 || 1;
  const xy = points.map((p) => ({
    x: points.length === 1 ? width / 2 : PAD + ((new Date(p.date).getTime() - t0) / tSpan) * (width - 2 * PAD),
    y: hi === lo ? CHART_H / 2 : PAD + (1 - (p.kg - lo) / span) * (CHART_H - 2 * PAD),
  }));
  return (
    <View style={{ height: CHART_H, width }}>
      {xy.slice(1).map((b, i) => {
        const a = xy[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        return (
          <View
            key={i}
            style={{
              position: 'absolute', height: 2, width: len, backgroundColor: Colors.bioGreen, opacity: 0.7,
              left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - 1,
              transform: [{ rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }],
            }}
          />
        );
      })}
      {xy.map((p, i) => (
        <View key={i} style={[styles.dot, { left: p.x - 4, top: p.y - 4 }]} />
      ))}
    </View>
  );
}

export default function WeightScreen() {
  const router = useRouter();
  const [points, setPoints] = useState<Point[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setPoints(await SyncService.fetchWeightHistory());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load weight history');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latest = points?.length ? points[points.length - 1] : null;
  const first = points?.length ? points[0] : null;
  const change = latest && first && points!.length > 1 ? latest.kg - first.kg : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>Weight</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={Colors.textPure} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {error && <Text style={[Typography.caption, { color: Colors.bioRose }]}>{error}</Text>}
        <GlassCard>
          <Text style={Typography.statLabel}>LATEST</Text>
          <View style={styles.heroRow}>
            <Text style={styles.hero}>{latest ? latest.kg.toFixed(1) : '--'}</Text>
            <Text style={[Typography.sectionHeader, { color: Colors.textMuted }]}>kg</Text>
          </View>
          <Text style={Typography.caption}>
            {latest ? fmtDate(latest.date, true) : points === null ? 'Loading…' : 'No synced weight yet. Weigh in on a connected scale or add it in Apple/Google Health.'}
            {change !== null ? ` • ${change > 0 ? '+' : ''}${change.toFixed(1)} kg since ${fmtDate(first!.date)}` : ''}
          </Text>
        </GlassCard>

        {points && points.length > 0 && (
          <GlassCard>
            <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
              {width > 0 && <Chart points={points} width={width} />}
            </View>
            <View style={styles.axis}>
              <Text style={Typography.caption}>{fmtDate(points[0].date)}</Text>
              {points.length > 1 && <Text style={Typography.caption}>{fmtDate(points[points.length - 1].date)}</Text>}
            </View>
          </GlassCard>
        )}

        {points && points.length > 0 && (
          <GlassCard>
            <Text style={[Typography.cardTitle, { marginBottom: Spacing.sm }]}>History</Text>
            {[...points].reverse().map((p) => (
              <View key={p.date} style={styles.row}>
                <Text style={Typography.caption}>{fmtDate(p.date, true)}</Text>
                <Text style={Typography.bodyMono}>{p.kg.toFixed(1)} kg</Text>
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginVertical: 2 },
  hero: { fontSize: 56, fontWeight: '800', letterSpacing: -2, color: Colors.textPure },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.bioGreen },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
});

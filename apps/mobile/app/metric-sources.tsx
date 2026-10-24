import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from '../components/GlassCard';
import { getPreferences, listConnections, putPreference } from '../services/connectors/api';
import { DEFAULT_METRICS, METRIC_LABEL, SOURCE_LABEL, type Connection, type Metric } from '../services/connectors/model';

/** Same rule as the server (resolve.ts effectiveOrder): saved order first, then any other source that has the metric. */
function orderFor(metric: Metric, pref: string[] | undefined, conns: Connection[]) {
  const ok = conns.filter((c) => c.status !== 'not_connected' && c.grantedMetrics.includes(metric));
  const first = (pref ?? []).flatMap((id) => ok.filter((c) => c.id === id));
  return [...first, ...ok.filter((c) => !first.includes(c))];
}

export default function MetricSources() {
  const router = useRouter();
  const [conns, setConns] = useState<Connection[]>([]);
  const [prefs, setPrefs] = useState<Partial<Record<Metric, string[]>>>({});
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    Promise.all([listConnections(), getPreferences()]).then(([c, p]) => { setConns(c); setPrefs(p); setError(null); }).catch((e) => setError(e.message));
  }, []));

  const move = (metric: Metric, index: number) => {
    const order = orderFor(metric, prefs[metric], conns).map((c) => c.id);
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    const prev = prefs;
    setPrefs({ ...prefs, [metric]: order });
    putPreference(metric, order).catch((e) => { setPrefs(prev); Alert.alert('Could not save', e.message); });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>Source per metric</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
        <Text style={Typography.caption}>The first source with data for a day is used. The others are fallbacks.</Text>
        {error && <Text style={[Typography.caption, { color: Colors.bioRose }]}>{error}</Text>}
        {DEFAULT_METRICS.map((metric) => {
          const order = orderFor(metric, prefs[metric], conns);
          // Apple Health reports SDNN, Google Health and Health Connect report RMSSD: the numbers are not comparable.
          const mixed = metric === 'hrv' && new Set(order.map((c) => c.source === 'healthkit')).size > 1;
          return (
            <GlassCard key={metric}>
              <Text style={Typography.cardTitle}>{METRIC_LABEL[metric]}</Text>
              {order.length === 0 && <Text style={Typography.caption}>No connected source provides this yet.</Text>}
              {order.map((c, i) => (
                <View key={c.id} style={styles.row}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <Text style={[Typography.bodyText, { flex: 1, color: Colors.textPrimary }]}>{SOURCE_LABEL[c.source]}</Text>
                  {i > 0 && <Pressable hitSlop={10} onPress={() => move(metric, i)}><Ionicons name="arrow-up" size={18} color={Colors.link} /></Pressable>}
                </View>
              ))}
              {mixed && (
                <Text style={[Typography.caption, { color: Colors.warning, marginTop: Spacing.sm }]}>
                  Apple Health measures HRV as SDNN; Google Health uses RMSSD. Your readiness baseline restarts.
                </Text>
              )}
            </GlassCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  rank: { width: 22, textAlign: 'center', color: Colors.bioGreen, fontWeight: '700' },
});

import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { getPreferences, listConnections, putPreference } from '../services/connectors/api';
import { SOURCE_LABEL, type Connection, type Metric } from '../services/connectors/model';

/** Same rule as the server (resolve.ts effectiveOrder): saved order first, then any other source that has the metric. */
export function orderFor(metric: Metric, pref: string[] | undefined, conns: Connection[]) {
  const ok = conns.filter((c) => c.status !== 'not_connected' && c.grantedMetrics.includes(metric));
  const first = (pref ?? []).flatMap((id) => ok.filter((c) => c.id === id));
  return [...first, ...ok.filter((c) => !first.includes(c))];
}

/** Connections and saved per-metric source order, reloaded whenever the screen regains focus. */
export function useSourcePrefs() {
  const [conns, setConns] = useState<Connection[]>([]);
  const [prefs, setPrefs] = useState<Partial<Record<Metric, string[]>>>({});
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    Promise.all([listConnections(), getPreferences()]).then(([c, p]) => { setConns(c); setPrefs(p); setError(null); }).catch((e) => setError(e.message));
  }, []));

  /** Swap the source at `index` with the one above it. */
  const move = (metric: Metric, index: number) => {
    const order = orderFor(metric, prefs[metric], conns).map((c) => c.id);
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    const prev = prefs;
    setPrefs({ ...prefs, [metric]: order });
    putPreference(metric, order).catch((e) => { setPrefs(prev); Alert.alert('Could not save', e.message); });
  };

  return { conns, prefs, error, move };
}

export function SourceOrder({ metric, state }: { metric: Metric; state: ReturnType<typeof useSourcePrefs> }) {
  const order = orderFor(metric, state.prefs[metric], state.conns);
  return (
    <>
      {order.length === 0 && <Text style={Typography.caption}>No connected source provides this yet.</Text>}
      {order.map((c, i) => (
        <View key={c.id} style={styles.row}>
          <Text style={styles.rank}>{i + 1}</Text>
          <Text style={[Typography.bodyText, { flex: 1, color: Colors.textPrimary }]}>{SOURCE_LABEL[c.source]}</Text>
          {i > 0 && <Pressable hitSlop={10} onPress={() => state.move(metric, i)}><Ionicons name="arrow-up" size={18} color={Colors.link} /></Pressable>}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  rank: { width: 22, textAlign: 'center', color: Colors.bioGreen, fontWeight: '700' },
});

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from '../components/GlassCard';
import { SourceOrder, orderFor, useSourcePrefs } from '../components/SourceOrder';
import { DEFAULT_METRICS, METRIC_LABEL } from '../services/connectors/model';

export default function MetricSources() {
  const router = useRouter();
  const state = useSourcePrefs();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>Source per metric</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
        <Text style={Typography.caption}>The first source with data for a day is used. The others are fallbacks. For workouts, the top source wins when two sources record the same session.</Text>
        {state.error && <Text style={[Typography.caption, { color: Colors.bioRose }]}>{state.error}</Text>}
        {DEFAULT_METRICS.map((metric) => {
          const order = orderFor(metric, state.prefs[metric], state.conns);
          // Apple Health reports SDNN, Google Health and Health Connect report RMSSD: the numbers are not comparable.
          const mixed = metric === 'hrv' && new Set(order.map((c) => c.source === 'healthkit')).size > 1;
          return (
            <GlassCard key={metric}>
              <Text style={Typography.cardTitle}>{METRIC_LABEL[metric]}</Text>
              <SourceOrder metric={metric} state={state} />
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
});

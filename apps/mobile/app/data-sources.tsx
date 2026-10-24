import React, { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from '../components/GlassCard';
import { useConnections } from '../hooks/useConnections';
import { connectDevice } from '../services/connectors';
import { connectGoogleHealth } from '../services/connectors/googleHealth';
import { registerDevice } from '../services/connectors/api';
import { ACTION_LABEL, SOURCES, SOURCE_LABEL, describeCard, type SourceId } from '../services/connectors/model';

const ICON: Record<SourceId, keyof typeof Ionicons.glyphMap> = { healthkit: 'heart-circle-outline', health_connect: 'phone-portrait-outline', google_health: 'pulse-outline' };

export default function DataSourcesScreen() {
  const router = useRouter();
  const { connections, deviceId, loading, error, reload, platform } = useConnections();
  const [explainer, setExplainer] = useState(false);
  const [busy, setBusy] = useState<SourceId | null>(null);

  const run = async (source: SourceId, fn: () => Promise<unknown>) => {
    setBusy(source);
    try {
      await fn();
    } catch (e) {
      Alert.alert(`${SOURCE_LABEL[source]}`, (e as Error).message);
    } finally {
      setBusy(null);
      reload(false);
    }
  };

  const act = (source: SourceId, move: boolean) => {
    if (source === 'google_health') return setExplainer(true);
    const connectionId = connections.find((c) => c.source === source)?.id;
    return run(source, () => connectDevice(source, { move, connectionId }));
  };

  const continueGoogle = () => {
    setExplainer(false);
    run('google_health', async () => {
      const result = await connectGoogleHealth(await registerDevice());
      if (result === 'not_linked') Alert.alert('Google Health', 'This Google account has no Google Health profile yet. Open the Google Health app, sign in, then try again.');
      else if (result === 'partial') Alert.alert('Google Health', 'Some permissions were not granted, so some metrics will be missing. Tap Reconnect to grant them.');
      else if (result === 'error') Alert.alert('Google Health', 'Could not connect. Please try again.');
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>Data sources</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => reload(true)} tintColor={Colors.textMuted} />}>
        {error && <Text style={[Typography.caption, { color: Colors.bioRose }]}>{error}</Text>}
        {SOURCES.map((source) => {
          const c = connections.find((x) => x.source === source);
          const { subtitle, action } = describeCard(source, c, platform, deviceId);
          const live = c && c.status !== 'not_connected';
          return (
            <GlassCard key={source}>
              <Pressable style={styles.row} disabled={!live} onPress={() => router.push(`/source/${source}` as any)}>
                <Ionicons name={ICON[source]} size={26} color={live ? Colors.bioGreen : Colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={Typography.cardTitle}>{SOURCE_LABEL[source]}</Text>
                  <Text style={Typography.caption}>{subtitle}</Text>
                </View>
                {action && (
                  <Pressable style={styles.btn} disabled={busy !== null} onPress={() => act(source, action === 'move')}>
                    <Text style={styles.btnText}>{busy === source ? '…' : ACTION_LABEL[action]}</Text>
                  </Pressable>
                )}
                {live && !action && <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
              </Pressable>
            </GlassCard>
          );
        })}

        <Pressable onPress={() => router.push('/metric-sources' as any)}>
          <GlassCard style={styles.row}>
            <Ionicons name="swap-vertical-outline" size={22} color={Colors.link} />
            <View style={{ flex: 1 }}>
              <Text style={Typography.cardTitle}>Source per metric</Text>
              <Text style={Typography.caption}>Choose which source wins for sleep, HRV, steps and more</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </GlassCard>
        </Pressable>
        <Text style={[Typography.caption, { textAlign: 'center' }]}>Pull down to sync now.</Text>
      </ScrollView>

      <Modal visible={explainer} transparent animationType="fade" onRequestClose={() => setExplainer(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={Typography.sectionHeader}>Connect Google Health</Text>
            <Text style={[Typography.bodyText, { marginVertical: Spacing.md }]}>
              First sign in to the Google Health app with the same Google account. Then tap Continue.
            </Text>
            <Text style={Typography.bodyText}>• Sleep: your nightly sleep sessions and stages.</Text>
            <Text style={Typography.bodyText}>• Health metrics: HRV, resting heart rate and weight, for your readiness score.</Text>
            <Text style={Typography.bodyText}>• Activity: steps, active energy and workouts.</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => setExplainer(false)} style={styles.cancel}><Text style={{ color: Colors.textMuted, fontWeight: '600' }}>Cancel</Text></Pressable>
              <Pressable onPress={continueGoogle} style={styles.btn}><Text style={styles.btnText}>Continue</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  btn: { backgroundColor: Colors.bioGreen, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Spacing.radiusButton },
  btnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: Spacing.xl },
  sheet: { backgroundColor: Colors.card, borderRadius: Spacing.radiusCard, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.borderMachined },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xl },
  cancel: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});

import React, { useState } from 'react';
import { Alert, ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { useConnections } from '../../hooks/useConnections';
import { forgetDeviceConnection, syncAll } from '../../services/connectors';
import { disconnectConnection } from '../../services/connectors/api';
import { METRIC_LABEL, SOURCE_LABEL, ago, describeCard, missingMetrics, type SourceId } from '../../services/connectors/model';

const HC_HINT = 'In the Google Health app, turn on Health Connect sync, then come back.';

export default function SourceDetail() {
  const { source } = useLocalSearchParams<{ source: SourceId }>();
  const router = useRouter();
  const { connections, deviceId, reload, platform } = useConnections();
  const [busy, setBusy] = useState(false);
  const c = connections.find((x) => x.source === source && x.status !== 'not_connected');
  if (!SOURCE_LABEL[source]) return null;
  const { subtitle } = describeCard(source, c, platform, deviceId);
  const mine = source === 'google_health' || c?.collectorDeviceId === deviceId;

  const guard = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } catch (e) { Alert.alert(SOURCE_LABEL[source], (e as Error).message); } finally { setBusy(false); reload(false); }
  };

  const disconnect = (deleteData: boolean) => guard(async () => {
    if (!c) return;
    await disconnectConnection(c.id, deleteData);
    if (mine) await forgetDeviceConnection(source);
    router.back();
  });

  const askDisconnect = () => Alert.alert(`Disconnect ${SOURCE_LABEL[source]}?`, 'Keep the data already synced, or delete it from HumanAudit.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Keep data', onPress: () => disconnect(false) },
    { text: 'Delete data', style: 'destructive', onPress: () => disconnect(true) },
  ]);

  const missing = c ? missingMetrics(c) : [];
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>{SOURCE_LABEL[source]}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
        {!c ? <Text style={Typography.bodyText}>Not connected.</Text> : (
          <>
            <GlassCard style={{ gap: Spacing.sm }}>
              <Row k="Status" v={subtitle} />
              {source !== 'google_health' && <Row k="Collector device" v={`${c.collectorDeviceName ?? 'unknown'}${mine ? ' (this phone)' : ''}`} />}
              <Row k="Last sync" v={ago(c.lastSyncAt)} />
              <Row k="Connected" v={ago(c.connectedAt)} />
              <Row k="Granted" v={c.grantedMetrics.map((m) => METRIC_LABEL[m]).join(', ') || 'none'} />
              {!!missing.length && <Row k="Missing" v={missing.map((m) => METRIC_LABEL[m]).join(', ')} />}
              {c.status === 'stale' && source === 'google_health' && <Text style={Typography.caption}>{HC_HINT}</Text>}
            </GlassCard>

            {mine && source !== 'google_health' && (
              <Pressable style={styles.btn} disabled={busy} onPress={() => guard(() => syncAll({ force: true }))}>
                <Text style={styles.btnText}>{busy ? 'Syncing…' : 'Sync now'}</Text>
              </Pressable>
            )}
            <Pressable style={[styles.btn, styles.danger]} disabled={busy} onPress={askDisconnect}>
              <Text style={[styles.btnText, { color: Colors.bioRose }]}>Disconnect</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={styles.kv}><Text style={Typography.caption}>{k}</Text><Text style={[Typography.bodyText, { flex: 1, textAlign: 'right', color: Colors.textPrimary }]}>{v}</Text></View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.lg },
  btn: { backgroundColor: Colors.bioGreen, padding: Spacing.md, borderRadius: Spacing.radiusButton, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: '700' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.bioRose },
});

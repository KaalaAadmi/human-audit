import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { listConnections } from '../services/connectors/api';

/** Shown while a Google Health first import is running (server-side backfill_completed_at is still null). Polls every 8 s, then disappears. */
export function SyncBanner({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true, was = false;
    const tick = async () => {
      const gh = (await listConnections().catch(() => [])).find((c) => c.source === 'google_health' && (c.status === 'connected' || c.status === 'partial'));
      const now = !!gh && !gh.backfillCompletedAt;
      if (!alive) return;
      setBusy(now);
      if (was && !now) onDone?.();
      was = now;
    };
    tick();
    const t = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [onDone]);
  if (!busy) return null;
  return (
    <View style={styles.row}>
      <ActivityIndicator size="small" color={Colors.bioAmber} />
      <Text style={[Typography.caption, { color: Colors.bioAmber }]}>Importing your Google Health data… this can take a few minutes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md } });

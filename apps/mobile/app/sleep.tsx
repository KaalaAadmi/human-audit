import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from '../components/GlassCard';
import { SyncService } from '../services/syncService';
import { syncAll } from '../services/connectors';
import { SOURCE_BADGE } from '../components/WorkoutCard';

type Stage = 'awake' | 'rem' | 'light' | 'deep';
type Segment = { stage: Stage; start: string; end: string };

// Top to bottom, like the Google Health hypnogram.
const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: 'awake', label: 'Awake', color: Colors.bioRose },
  { key: 'rem', label: 'REM', color: Colors.skyBlue },
  { key: 'light', label: 'Light', color: Colors.bioLavender },
  { key: 'deep', label: 'Deep', color: Colors.link },
];
const COLOR = Object.fromEntries(STAGES.map((s) => [s.key, s.color])) as Record<Stage, string>;
const LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<Stage, string>;

const hm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dur = (sec: number) => `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** Adjacent segments of the same stage read as one block. */
const merge = (segs: Segment[]) =>
  segs.reduce<Segment[]>((out, s) => {
    const last = out.at(-1);
    if (last && last.stage === s.stage && last.end === s.start) last.end = s.end;
    else out.push({ ...s });
    return out;
  }, []);

const scoreLabel = (s: number) => (s >= 85 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Fair' : 'Poor');

const ROW_H = 44;
const mins = (g: Segment) => Math.max(1, Math.round((Date.parse(g.end) - Date.parse(g.start)) / 60000));

function Hypnogram({ segs, start, end, selected, onSelect }: { segs: Segment[]; start: number; end: number; selected: number | null; onSelect: (i: number | null) => void }) {
  const span = Math.max(1, end - start);
  const [w, setW] = useState(0);
  // Tap anywhere on the chart: pick the block covering that moment (blocks are sequential), so thin blocks stay tappable.
  const pick = (x: number) => {
    const t = start + (x / Math.max(1, w)) * span;
    const i = segs.findIndex((g) => t >= Date.parse(g.start) && t < Date.parse(g.end));
    onSelect(i < 0 || i === selected ? null : i);
  };
  return (
    <View>
      <Pressable style={{ height: ROW_H * STAGES.length }} onLayout={(e) => setW(e.nativeEvent.layout.width)} onPress={(e) => pick(e.nativeEvent.locationX)}>
        {STAGES.map((s, i) => <View key={s.key} style={[styles.lane, { top: i * ROW_H, height: ROW_H }]} />)}
        {segs.map((g, i) => {
          const row = STAGES.findIndex((s) => s.key === g.stage);
          const left = ((Date.parse(g.start) - start) / span) * 100;
          const width = Math.max(0.4, ((Date.parse(g.end) - Date.parse(g.start)) / span) * 100);
          return <View key={i} pointerEvents="none" style={{ position: 'absolute', top: row * ROW_H + 6, height: ROW_H - 12, left: `${left}%`, width: `${width}%`, borderRadius: 3, backgroundColor: COLOR[g.stage], opacity: selected === null || selected === i ? 1 : 0.35 }} />;
        })}
      </Pressable>
      <View style={styles.axis}>
        <Text style={Typography.caption}>{hm(new Date(start).toISOString())}</Text>
        <Text style={Typography.caption}>{hm(new Date(end).toISOString())}</Text>
      </View>
    </View>
  );
}

export default function Sleep() {
  const router = useRouter();
  const [data, setData] = useState<any>(undefined); // undefined = loading, null = no sleep yet
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  const load = useCallback(() => SyncService.fetchSleep().then((d) => { setData(d); setError(null); }).catch((e) => { setError(e.message); setData((p: any) => p ?? null); }), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const [pulling, setPulling] = useState(false);
  const pull = async () => { setPulling(true); await syncAll({ force: true }).catch(() => undefined); await load(); setPulling(false); };

  const v = data?.vitals ?? {};
  const asleep = Number(v.sleep_duration_seconds) || 0;
  const secs: Record<Stage, number> = { awake: Number(v.awake_seconds) || 0, rem: Number(v.rem_sleep_seconds) || 0, light: Number(v.light_sleep_seconds) || 0, deep: Number(v.deep_sleep_seconds) || 0 };
  const inBed = Number(v.time_in_bed_seconds) || 0;
  const segs: Segment[] = data?.segments ?? [];
  const blocks = merge(segs);
  const badge = v.sleep_source ? SOURCE_BADGE[v.sleep_source] ?? { label: String(v.sleep_source).toUpperCase(), color: Colors.textMuted } : null;
  const stat = (k: string, val: string, color: string = Colors.textPure) => (
    <View style={styles.stat}><Text style={Typography.caption}>{k}</Text><Text style={[Typography.bodyMono, { color }]}>{val}</Text></View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>Sleep</Text>
      </View>

      {data === undefined ? <ActivityIndicator color={Colors.bioLavender} style={{ marginTop: Spacing.xl }} /> : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }} alwaysBounceVertical refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={Colors.textMuted} />}>
          {error && <Text style={[Typography.caption, { color: Colors.bioRose }]}>Couldn't load sleep: {error}</Text>}
          {data === null ? (
            !error && <Text style={Typography.caption}>No sleep yet. Connect Apple Health or Google Health in System → Data sources.</Text>
          ) : (
            <>
              <Text style={[Typography.caption, { color: badge?.color ?? Colors.textMuted, fontWeight: '700' }]}>
                {badge ? `${badge.label} • ` : ''}{new Date(data.date + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>

              <GlassCard borderColor="rgba(192, 132, 252, 0.18)">
                <View style={styles.scoreRow}>
                  <View>
                    <Text style={Typography.statLabel}>SLEEP SCORE</Text>
                    <Text style={[Typography.displayLarge, { color: Colors.bioLavender }]}>{v.sleep_score ?? '--'}</Text>
                    {v.sleep_score != null && <Text style={Typography.caption}>{scoreLabel(v.sleep_score)}</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={Typography.statLabel}>TIME ASLEEP</Text>
                    <Text style={[Typography.sectionHeader, { color: Colors.textPure }]}>{asleep ? dur(asleep) : '--'}</Text>
                    {data.start && <Text style={Typography.caption}>{hm(data.start)} – {hm(data.end)}</Text>}
                  </View>
                </View>
              </GlassCard>

              <Text style={Typography.cardTitle}>Sleep stages</Text>
              <GlassCard>
                {segs.length > 0 ? (
                  <>
                    <View style={styles.hypRow}>
                      <View style={styles.hypLabels}>
                        {STAGES.map((s) => <Text key={s.key} style={[Typography.caption, { height: ROW_H, lineHeight: ROW_H, color: s.color }]}>{s.label}</Text>)}
                      </View>
                      <View style={{ flex: 1 }}><Hypnogram segs={blocks} selected={sel} onSelect={setSel} start={Date.parse(data.start)} end={Date.parse(data.end)} /></View>
                    </View>
                    {sel !== null && blocks[sel] ? (
                      <Text style={[Typography.bodyMono, { color: COLOR[blocks[sel].stage], marginTop: Spacing.sm }]}>
                        {LABEL[blocks[sel].stage]} • {hm(blocks[sel].start)} – {hm(blocks[sel].end)} • {mins(blocks[sel])} min
                      </Text>
                    ) : <Text style={[Typography.caption, { marginTop: Spacing.sm }]}>Tap the chart to see when each stage started and ended.</Text>}
                  </>
                ) : <Text style={Typography.caption}>This source only reports stage totals, not a timeline.</Text>}
              </GlassCard>

              <GlassCard>
                {[...STAGES].reverse().map((s, i) => (
                  <View key={s.key} style={i > 0 && { marginTop: Spacing.sm }}>
                    <View style={styles.zoneRow}>
                      <Text style={[Typography.caption, { color: s.color, fontWeight: '700' }]}>{s.label.toUpperCase()}</Text>
                      <Text style={[Typography.bodyMono, { color: s.color }]}>{dur(secs[s.key])} • {pct(secs[s.key], asleep + secs.awake)}%</Text>
                    </View>
                    <View style={styles.track}><View style={{ height: '100%', borderRadius: 4, backgroundColor: s.color, width: `${pct(secs[s.key], asleep + secs.awake)}%` }} /></View>
                  </View>
                ))}
              </GlassCard>

              <Text style={Typography.cardTitle}>Details</Text>
              <GlassCard>
                <View style={styles.statRow}>
                  {stat('IN BED', inBed ? dur(inBed) : '--')}
                  {stat('EFFICIENCY', v.sleep_efficiency_pct != null ? `${v.sleep_efficiency_pct}%` : '--')}
                  {stat('AWAKE', secs.awake ? dur(secs.awake) : '--')}
                </View>
                <View style={[styles.statRow, styles.divider]}>
                  {stat('SLEEP NEED', v.sleep_need_seconds ? dur(v.sleep_need_seconds) : '--')}
                  {stat('SLEEP DEBT', v.sleep_debt_seconds != null ? dur(v.sleep_debt_seconds) : '--', v.sleep_debt_seconds > 3600 ? Colors.bioAmber : Colors.textPure)}
                  {stat('RESTORATIVE', asleep ? `${pct(secs.deep + secs.rem, asleep)}%` : '--', Colors.bioGreen)}
                </View>
                <View style={[styles.statRow, styles.divider]}>
                  {stat('HRV', v.overnight_hrv_rmssd != null ? `${Math.round(v.overnight_hrv_rmssd)} ms` : '--')}
                  {stat('RESTING HR', v.resting_heart_rate != null ? `${v.resting_heart_rate} bpm` : '--')}
                </View>
                {v.sleep_efficiency_label === 'SME' && (
                  <Text style={[Typography.caption, { marginTop: Spacing.sm }]}>This source does not report time in bed, so efficiency is asleep ÷ (asleep + awake).</Text>
                )}
              </GlassCard>

              {blocks.length > 0 && (
                <>
                  <Text style={Typography.cardTitle}>Night timeline</Text>
                  <GlassCard>
                    {blocks.map((b, i) => (
                      <View key={i} style={styles.tl}>
                        <View style={[styles.dot, { backgroundColor: COLOR[b.stage] }]} />
                        <Text style={[Typography.bodyText, { flex: 1, color: Colors.textPrimary }]}>{LABEL[b.stage]}</Text>
                        <Text style={Typography.caption}>{hm(b.start)} • {mins(b)} min</Text>
                      </View>
                    ))}
                  </GlassCard>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hypRow: { flexDirection: 'row', gap: Spacing.sm },
  hypLabels: { width: 40 },
  lane: { position: 'absolute', left: 0, right: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  track: { height: 8, backgroundColor: Colors.surfaceHighlight, borderRadius: 4, overflow: 'hidden' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  divider: { marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderMachined },
  stat: { alignItems: 'center', flex: 1 },
  tl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from '../components/GlassCard';
import { useToday } from '../hooks/useToday';
import { bodyAgeFor, type Band, type Tone } from '../services/bodyAge';

const TONE: Record<Tone, string> = { good: Colors.bioGreen, ok: Colors.bioAmber, bad: Colors.bioRose };
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

/** One driver of body age: value, status pill, a fill bar and a plain-language line. */
function Driver({ icon, title, value, band, fill, note }: { icon: keyof typeof Ionicons.glyphMap; title: string; value: string; band: Band | null; fill: number; note: string }) {
  const color = band ? TONE[band.tone] : Colors.textMuted;
  return (
    <GlassCard>
      <View style={styles.dHead}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[Typography.cardTitle, { flex: 1 }]}>{title}</Text>
        {band && <View style={[styles.pill, { borderColor: color }]}><Text style={[styles.pillText, { color }]}>{band.label.toUpperCase()}</Text></View>}
      </View>
      <Text style={[Typography.sectionHeader, { color: Colors.textPure, marginTop: Spacing.sm }]}>{value}</Text>
      <View style={styles.track}><View style={{ height: '100%', borderRadius: 3, backgroundColor: color, width: `${Math.round(fill * 100)}%` }} /></View>
      <Text style={[Typography.caption, { marginTop: Spacing.sm }]}>{note}</Text>
    </GlassCard>
  );
}

export default function BodyAge() {
  const router = useRouter();
  const { vitals, profile } = useToday();
  const { age, b } = bodyAgeFor(profile, vitals);
  const rhr = num(vitals?.resting_heart_rate);
  const waist = num(profile?.waist_cm);
  const sleepMin = vitals?.sleep_duration_seconds ? Math.round(vitals.sleep_duration_seconds / 60) : null;
  const younger = b !== null && b.delta <= 0;
  const accent = b === null ? Colors.textMuted : younger ? Colors.bioGreen : Colors.bioAmber;
  // Bar: your age is the marker, body age the fill, on a window of +-10 years around your age.
  const span = (v: number) => Math.max(0, Math.min(1, (v - (age! - 10)) / 20));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>Body age</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
        <GlassCard borderColor={younger ? 'rgba(52, 211, 153, 0.25)' : 'rgba(251, 191, 36, 0.25)'}>
          <Text style={Typography.statLabel}>YOUR BODY AGE</Text>
          <View style={styles.heroRow}>
            <Text style={[styles.hero, { color: accent }]}>{b ? b.bodyAge.toFixed(1) : '--'}</Text>
            {b && <Text style={[Typography.sectionHeader, { color: accent }]}>{signed(b.delta)} yrs</Text>}
          </View>
          {b && age !== null ? (
            <>
              <Text style={Typography.bodyText}>
                {Math.abs(b.delta) < 0.05 ? 'Right on your age' : `${Math.abs(b.delta).toFixed(1)} years ${younger ? 'younger' : 'older'} than your age`} ({age.toFixed(1)})
              </Text>
              <View style={styles.scale}>
                <View style={styles.scaleLine} />
                <View style={[styles.scaleDot, { left: `${span(age) * 100}%`, backgroundColor: Colors.textMuted }]} />
                <View style={[styles.scaleDot, styles.scaleDotBig, { left: `${span(b.bodyAge) * 100}%`, backgroundColor: accent }]} />
              </View>
              <View style={styles.legend}>
                <Text style={Typography.caption}>● <Text style={{ color: Colors.textMuted }}>Your age</Text></Text>
                <Text style={Typography.caption}>● <Text style={{ color: accent }}>Body age</Text></Text>
              </View>
            </>
          ) : (
            <Text style={[Typography.bodyText, { marginTop: Spacing.sm }]}>
              {age === null ? 'Add your birthdate in System → Profile.'
                : waist === null ? 'Add your waist in System → Profile to see your body age.'
                : 'Needs a resting heart rate from your wearable.'}
            </Text>
          )}
        </GlassCard>

        {b && (
          <>
            <Text style={Typography.cardTitle}>What shapes it</Text>
            <Driver icon="fitness-outline" title="Cardio fitness (VO₂max)" value={`${b.vo2.value.toFixed(1)} ml/kg/min`} band={b.vo2.band} fill={b.vo2.fill}
              note={`${Math.abs(b.vo2.diff).toFixed(1)} ${b.vo2.diff >= 0 ? 'above' : 'below'} the ${b.vo2.avg.toFixed(1)} average for your age. Estimated from your age, waist and resting heart rate, not measured.`} />
            <Driver icon="heart-outline" title="Resting heart rate" value={`${b.rhr.value} bpm`} band={b.rhr.band} fill={b.rhr.fill}
              note={`Every 5 bpm lower takes about ${b.rhr.years5.toFixed(1)} years off your body age.`} />
            <Driver icon="body-outline" title="Waist" value={`${b.waist.value} cm`} band={b.waist.band} fill={b.waist.fill}
              note={`${b.waist.whtr !== null ? `Waist-to-height ${b.waist.whtr.toFixed(2)} (under 0.50 is healthy). ` : ''}Every 5 cm smaller takes about ${b.waist.years5.toFixed(1)} years off.`} />
          </>
        )}

        <Text style={Typography.cardTitle}>Recovery</Text>
        <Pressable onPress={() => router.push('/sleep' as any)}>
          <GlassCard style={styles.sleepRow} borderColor="rgba(192, 132, 252, 0.18)">
            <Ionicons name="moon-outline" size={22} color={Colors.bioLavender} />
            <View style={{ flex: 1 }}>
              <Text style={Typography.cardTitle}>Most recent sleep</Text>
              <Text style={Typography.caption}>
                {sleepMin !== null ? `${Math.floor(sleepMin / 60)}h ${sleepMin % 60}m${vitals?.sleep_score != null ? ` • Score ${vitals.sleep_score}` : ''}` : 'Stages, score and timeline'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </GlassCard>
        </Pressable>

        <Text style={Typography.caption}>
          Body age is your fitness age: the age whose average VO₂max (HUNT study norms) matches yours. Activity level is assumed, so treat it as a trend to improve, not a medical result.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.md, marginVertical: 2 },
  hero: { fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  scale: { height: 22, justifyContent: 'center', marginTop: Spacing.lg },
  scaleLine: { height: 4, borderRadius: 2, backgroundColor: Colors.surfaceHighlight },
  scaleDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6 },
  scaleDotBig: { width: 18, height: 18, borderRadius: 9, marginLeft: -9 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  dHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  track: { height: 6, backgroundColor: Colors.surfaceHighlight, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.sm },
  sleepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});

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

const NA = '--';
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

export default function BodyAge() {
  const router = useRouter();
  const { vitals, profile } = useToday();
  const bodyAge = num(vitals?.fitness_age ?? vitals?.body_age);
  const age = profile?.chronological_birthdate ? (Date.now() - new Date(profile.chronological_birthdate).getTime()) / 31557600000 : null;
  const delta = bodyAge !== null && age !== null ? bodyAge - age : null;
  const sleepMin = vitals?.sleep_duration_seconds ? Math.round(vitals.sleep_duration_seconds / 60) : null;
  const vo2 = num(vitals?.vo2max_ml_kg_min);
  const row = (k: string, v: string) => (
    <View style={styles.row}><Text style={Typography.bodyText}>{k}</Text><Text style={[Typography.bodyMono, { color: Colors.textPure }]}>{v}</Text></View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></Pressable>
        <Text style={Typography.sectionHeader}>Body age</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
        <GlassCard borderColor="rgba(192, 132, 252, 0.18)">
          <Text style={Typography.statLabel}>BODY AGE</Text>
          <Text style={[Typography.displayLarge, { color: Colors.bioLavender, marginTop: 4 }]}>{bodyAge !== null ? bodyAge.toFixed(1) : NA}</Text>
          <Text style={Typography.caption}>
            {delta !== null
              ? `${Math.abs(delta).toFixed(1)} yrs ${delta <= 0 ? 'younger' : 'older'} than your age`
              : bodyAge === null ? 'Needs resting heart rate and waist circumference' : 'Add your birthdate to compare with your age'}
          </Text>
        </GlassCard>

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

        <Text style={Typography.cardTitle}>What goes into it</Text>
        <GlassCard>
          {row('Your age', age !== null ? age.toFixed(1) : NA)}
          {row('Fitness age', bodyAge !== null ? bodyAge.toFixed(1) : NA)}
          {row('Estimated VO₂max', vo2 !== null ? `${vo2.toFixed(1)} ml/kg/min` : NA)}
          {row('Resting heart rate', vitals?.resting_heart_rate != null ? `${vitals.resting_heart_rate} bpm` : NA)}
          {row('Waist', profile?.waist_cm ? `${Number(profile.waist_cm)} cm` : NA)}
        </GlassCard>
        <Text style={Typography.caption}>
          Body age is your fitness age: the age whose average VO₂max (HUNT norms) matches yours. VO₂max is estimated from your age, waist, resting heart rate and activity (Nes 2011), not measured.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  sleepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});

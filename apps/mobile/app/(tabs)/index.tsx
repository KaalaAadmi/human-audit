import React from 'react';
  import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
  import { useRouter } from 'expo-router';
  import { Colors } from '../../theme/colors';
  import { Typography } from '../../theme/typography';
  import { Spacing } from '../../theme/spacing';
  import { GlassCard } from '../../components/GlassCard';

  export default function HomeDashboard() {
    const router = useRouter();

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={Typography.metricLabel}>TODAY • APR 14</Text>
            <Text style={Typography.heroTitle}>Dashboard</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarPill}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.avatarText}>AB</Text>
          </TouchableOpacity>
        </View>

        {/* Whoop Dual Metrics Grid: Readiness & Strain */}
        <View style={styles.dualGrid}>
          <GlassCard style={styles.metricCard} borderColor="rgba(110, 231, 183, 0.15)">
            <Text style={Typography.metricLabel}>Readiness</Text>
            <Text style={[styles.bigMetric, { color: Colors.readiness }]}>88%</Text>
            <Text style={Typography.caption}>HRV: 64ms • RHR: 51</Text>
          </GlassCard>

          <GlassCard style={styles.metricCard} borderColor="rgba(251, 191, 36, 0.15)">
            <Text style={Typography.metricLabel}>Day Strain</Text>
            <Text style={[styles.bigMetric, { color: Colors.strain }]}>14.2</Text>
            <Text style={[Typography.caption, { color: Colors.strain }]}>Target: 12.0 – 15.5</Text>
          </GlassCard>
        </View>

        {/* Sleep & Glowing Bio-Orb Summary Widget */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/activity')}>
          <GlassCard style={styles.orbWidget} borderColor="rgba(192, 132, 252, 0.18)">
            <View style={styles.miniOrb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.widgetTitle}>7h 42m Asleep • Body Age 24.2</Text>
              <Text style={Typography.caption}>-3.8 yrs younger • Tap for deep dive →</Text>
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* Today's Nutrition Progress */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/diary')}>
          <GlassCard style={styles.nutritionCard}>
            <View style={styles.cardHeader}>
              <Text style={Typography.cardTitle}>Today's Nutrition</Text>
              <Text style={{ fontSize: 11, color: Colors.readiness, fontWeight: '700' }}>680 kcal Left →</Text>
            </View>
            <View style={styles.macrosRow}>
              <Text style={Typography.caption}>
                P: <Text style={{ color: Colors.protein, fontWeight: '700' }}>142/180g</Text>
              </Text>
              <Text style={Typography.caption}>
                C: <Text style={{ color: Colors.carbs, fontWeight: '700' }}>160/220g</Text>
              </Text>
              <Text style={Typography.caption}>
                F: <Text style={{ color: Colors.fats, fontWeight: '700' }}>45/65g</Text>
              </Text>
            </View>
          </GlassCard>
        </TouchableOpacity>

        {/* Hydration & Scale Weight Snapshots */}
        <View style={styles.dualGrid}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/water')}>
            <GlassCard style={styles.subCard} borderColor="rgba(103, 232, 249, 0.15)">
              <Text style={[Typography.metricLabel, { color: Colors.hydration }]}>💧 Water</Text>
              <Text style={styles.subMetric}>2,250 ml</Text>
            </GlassCard>
          </TouchableOpacity>

          <GlassCard style={styles.subCard}>
            <Text style={Typography.metricLabel}>⚖️ Hume Weight</Text>
            <Text style={styles.subMetric}>74.8 kg</Text>
          </GlassCard>
        </View>
      </ScrollView>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.canvas,
    },
    content: {
      padding: Spacing.xl,
      paddingTop: 50,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: Spacing.lg,
    },
    avatarPill: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: Colors.card,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: Colors.textPrimary,
      fontWeight: '700',
      fontSize: 13,
    },
    dualGrid: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    metricCard: {
      flex: 1,
      padding: Spacing.md,
    },
    bigMetric: {
      fontSize: 26,
      fontWeight: '800',
      marginVertical: 2,
      letterSpacing: -0.5,
    },
    orbWidget: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
      padding: Spacing.md,
    },
    miniOrb: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Colors.sleep,
      shadowColor: Colors.sleep,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
    },
    widgetTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: Colors.textPrimary,
    },
    nutritionCard: {
      marginBottom: Spacing.md,
      padding: Spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.xs,
    },
    macrosRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    subCard: {
      padding: Spacing.md,
    },
    subMetric: {
      fontSize: 14,
      fontWeight: '800',
      color: Colors.textPrimary,
      marginTop: 2,
    },
  });
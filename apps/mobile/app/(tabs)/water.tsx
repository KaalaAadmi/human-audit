import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Colors } from "../../theme/colors";
import { Typography } from "../../theme/typography";
import { Spacing } from "../../theme/spacing";
import { GlassCard } from "../../components/GlassCard";

export default function WaterScreen() {
  const [waterMl, setWaterMl] = useState(2250);
  const goalMl = 3000;
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [intervalMins, setIntervalMins] = useState(90);

  const percentage = Math.min(100, Math.round((waterMl / goalMl) * 100));

  const addWater = async (amount: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaterMl((prev) => prev + amount);
  };

  const resetWater = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setWaterMl(0);
  };

  const scheduleReminder = async () => {
    await Haptics.selectionAsync();
    const newStatus = !remindersEnabled;
    setRemindersEnabled(newStatus);

    if (newStatus) {
      await Notifications.requestPermissionsAsync();
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💧 HumanAudit Hydration Reminder",
          body: "Time to drink some water! Your biological age will thank you.",
        },
        trigger: {
          seconds: intervalMins * 60,
          repeats: true,
        } as any,
      });
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={Typography.metricLabel}>HYDRATION HUB</Text>
        <Text style={Typography.heroTitle}>Waterlogged</Text>
      </View>

      {/* Liquid Reservoir Card */}
      <GlassCard
        style={styles.reservoirCard}
        borderColor="rgba(103, 232, 249, 0.18)"
      >
        <Text style={{ fontSize: 36, textAlign: "center" }}>💧</Text>
        <Text style={styles.currentWaterText}>
          {waterMl.toLocaleString()} <Text style={styles.unitText}>ml</Text>
        </Text>
        <Text style={styles.goalText}>
          Daily Goal: {goalMl.toLocaleString()} ml • {percentage}%
        </Text>

        {/* Liquid Fill Gauge */}
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeFill, { width: `${percentage}%` }]} />
        </View>
      </GlassCard>

      {/* Quick Add Presets */}
      <Text style={[Typography.metricLabel, { marginBottom: Spacing.sm }]}>
        Quick Log Presets
      </Text>
      <View style={styles.presetGrid}>
        <TouchableOpacity
          style={styles.presetButton}
          onPress={() => addWater(250)}
        >
          <Text style={styles.presetAmount}>+250 ml</Text>
          <Text style={styles.presetLabel}>Glass</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.presetButton}
          onPress={() => addWater(500)}
        >
          <Text style={styles.presetAmount}>+500 ml</Text>
          <Text style={styles.presetLabel}>Bottle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.presetButton}
          onPress={() => addWater(750)}
        >
          <Text style={styles.presetAmount}>+750 ml</Text>
          <Text style={styles.presetLabel}>Shaker</Text>
        </TouchableOpacity>
      </View>

      {/* Reminder Config Card */}
      <GlassCard style={{ marginTop: Spacing.lg }}>
        <View style={styles.reminderHeader}>
          <Text style={Typography.cardTitle}>⏰ Push Reminders</Text>
          <TouchableOpacity
            style={[
              styles.statusPill,
              {
                backgroundColor: remindersEnabled
                  ? "rgba(110, 231, 183, 0.15)"
                  : "rgba(255, 255, 255, 0.05)",
              },
            ]}
            onPress={scheduleReminder}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                color: remindersEnabled ? Colors.readiness : Colors.textMuted,
              }}
            >
              {remindersEnabled ? "ACTIVE" : "OFF"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[Typography.caption, { marginTop: Spacing.xs }]}>
          Every{" "}
          <Text style={{ color: Colors.textPrimary, fontWeight: "700" }}>
            {intervalMins} mins
          </Text>{" "}
          (8:00 AM – 10:00 PM)
        </Text>
      </GlassCard>

      {/* Reset Button */}
      <TouchableOpacity style={styles.resetButton} onPress={resetWater}>
        <Text style={styles.resetText}>Reset Today's Log</Text>
      </TouchableOpacity>
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
    marginBottom: Spacing.lg,
  },
  reservoirCard: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  currentWaterText: {
    fontSize: 36,
    fontWeight: "800",
    color: Colors.hydration,
    letterSpacing: -1,
    marginVertical: Spacing.xs,
  },
  unitText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.textMuted,
  },
  goalText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  gaugeTrack: {
    width: "100%",
    height: 10,
    backgroundColor: Colors.canvas,
    borderRadius: 5,
    marginTop: Spacing.lg,
    overflow: "hidden",
  },
  gaugeFill: {
    height: "100%",
    backgroundColor: Colors.hydration,
    borderRadius: 5,
  },
  presetGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  presetButton: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Spacing.radiusButton,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  presetLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  reminderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radiusPill,
  },
  resetButton: {
    marginTop: Spacing.xxl,
    alignItems: "center",
  },
  resetText: {
    fontSize: 11,
    color: Colors.textTertiary,
    textDecorationLine: "underline",
  },
});

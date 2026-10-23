import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";
import { Typography } from "../../theme/typography";
import { Spacing } from "../../theme/spacing";
import { GlassCard } from "../../components/GlassCard";
import { SyncService } from "../../services/syncService";
import { localDate } from "../../lib/api";
import {
  DEFAULT_REMINDER_START_MIN,
  DEFAULT_REMINDER_END_MIN,
  scheduleWaterReminders,
} from "../../services/waterReminders";

const warn = (e: unknown) => console.warn("[SYNC_ERR]", e);

/** Minutes from midnight -> "8:00 AM". */
const fmtMin = (m: number) => {
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
/** Minutes from midnight -> a Date today at that local time (what the picker wants). */
const minToDate = (m: number) => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};
import { ConfettiCelebration } from "../../components/ConfettiCelebration";

export default function WaterScreen() {
  const [waterMl, setWaterMl] = useState(0);
  const [goalMl, setGoalMl] = useState(3000);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [intervalMins, setIntervalMins] = useState(90);
  const [startMin, setStartMin] = useState(DEFAULT_REMINDER_START_MIN);
  const [endMin, setEndMin] = useState(DEFAULT_REMINDER_END_MIN);
  const [editingTime, setEditingTime] = useState<"start" | "end" | null>(null); // iOS picker modal
  const [draftMin, setDraftMin] = useState(0); // iOS picker value, applied on Done
  const [isLoading, setIsLoading] = useState(true);

  // Celebration state
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasCelebratedToday, setHasCelebratedToday] = useState(false);

  // Goal customization modal
  const [isGoalModalVisible, setIsGoalModalVisible] = useState(false);
  const [tempGoalInput, setTempGoalInput] = useState("3000");

  // Custom log modal
  const [isCustomLogModalVisible, setIsCustomLogModalVisible] = useState(false);
  const [customMlInput, setCustomMlInput] = useState("");

  const prevWaterRef = useRef(0);

  // Fetch initial state & goals on mount
  useEffect(() => {
    loadHydrationTelemetry();
  }, []);

  const loadHydrationTelemetry = async () => {
    setIsLoading(true);
    try {
      const today = localDate();

      // Fetch user profile settings & today's water log concurrently
      const [profileData, waterData] = await Promise.all([
        SyncService.fetchUserProfile(),
        SyncService.fetchWaterLog(today),
      ]);

      const targetGoal = profileData?.water_goal_ml || 3000;
      const loggedAmount = Number(waterData?.amount_ml) || 0;
      const reminderActive = profileData?.water_reminder_enabled ?? true;
      const reminderInterval = profileData?.water_reminder_interval_mins || 90;
      setStartMin(profileData?.water_reminder_start_min ?? DEFAULT_REMINDER_START_MIN);
      setEndMin(profileData?.water_reminder_end_min ?? DEFAULT_REMINDER_END_MIN);

      setGoalMl(targetGoal);
      setTempGoalInput(String(targetGoal));
      setWaterMl(loggedAmount);
      prevWaterRef.current = loggedAmount;
      setRemindersEnabled(reminderActive);
      setIntervalMins(reminderInterval);

      // If user already achieved goal prior to this session launch, avoid auto-popping confetti on open
      if (loggedAmount >= targetGoal && targetGoal > 0) {
        setHasCelebratedToday(true);
      } else {
        setHasCelebratedToday(false);
      }
    } catch (err) {
      console.warn("[HYDRATION_LOAD_ERR]", err);
    } finally {
      setIsLoading(false);
    }
  };

  const percentage = goalMl > 0 ? Math.min(100, Math.round((waterMl / goalMl) * 100)) : 0;

  const triggerCelebration = async () => {
    setShowConfetti(true);
    setHasCelebratedToday(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 400);
  };

  const addWater = async (amount: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevVol = waterMl;
    const newVol = prevVol + amount;
    setWaterMl(newVol);

    // Check if crossing target goal for the first time
    if (prevVol < goalMl && newVol >= goalMl && !hasCelebratedToday) {
      triggerCelebration();
    }

    const today = localDate();
    SyncService.syncWaterLog(today, newVol).catch(warn);
  };

  const resetWater = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setWaterMl(0);
    setHasCelebratedToday(false);
    setShowConfetti(false);
    const today = localDate();
    SyncService.syncWaterLog(today, 0).catch(warn);
  };

  const handleSaveGoal = async (newGoalValue: number) => {
    if (newGoalValue <= 0) return;
    await Haptics.selectionAsync();
    setGoalMl(newGoalValue);
    setIsGoalModalVisible(false);

    // Check if new goal changes completed state
    if (waterMl >= newGoalValue && !hasCelebratedToday && waterMl > 0) {
      triggerCelebration();
    } else if (waterMl < newGoalValue) {
      setHasCelebratedToday(false);
    }

    SyncService.updateUserProfile({ water_goal_ml: newGoalValue }).catch(warn);
  };

  const scheduleReminder = async () => {
    await Haptics.selectionAsync();
    const newStatus = !remindersEnabled;
    setRemindersEnabled(newStatus);

    SyncService.updateUserProfile({
      water_reminder_enabled: newStatus,
      water_reminder_interval_mins: intervalMins,
    }).catch(warn);

    scheduleWaterReminders(newStatus, startMin, endMin, intervalMins).catch(warn);
  };

  /** Validates, saves and (if reminders are on) reschedules a new reminder window. */
  const saveWindow = (start: number, end: number) => {
    if (end <= start) {
      Alert.alert("Invalid window", "The end time must be after the start time.");
      return;
    }
    Haptics.selectionAsync();
    setStartMin(start);
    setEndMin(end);
    SyncService.updateUserProfile({
      water_reminder_start_min: start,
      water_reminder_end_min: end,
    }).catch(warn);
    scheduleWaterReminders(remindersEnabled, start, end, intervalMins).catch(warn);
  };

  const editTime = (which: "start" | "end") => {
    Haptics.selectionAsync();
    const current = which === "start" ? startMin : endMin;
    const apply = (m: number) => (which === "start" ? saveWindow(m, endMin) : saveWindow(startMin, m));
    if (Platform.OS === "ios") {
      setDraftMin(current);
      setEditingTime(which);
      return;
    }
    DateTimePickerAndroid.open({
      value: minToDate(current),
      mode: "time",
      is24Hour: false,
      onValueChange: (_e, date) => apply(date.getHours() * 60 + date.getMinutes()),
    });
  };

  const confirmIosTime = () => {
    if (editingTime === "start") saveWindow(draftMin, endMin);
    else if (editingTime === "end") saveWindow(startMin, draftMin);
    setEditingTime(null);
  };

  const handleCustomLogSubmit = () => {
    const val = parseInt(customMlInput, 10);
    if (!isNaN(val) && val > 0) {
      addWater(val);
      setCustomMlInput("");
      setIsCustomLogModalVisible(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text style={Typography.metricLabel}>HYDRATION HUB</Text>
              <Text style={Typography.heroTitle}>Waterlogged</Text>
            </View>
            <TouchableOpacity
              style={styles.editGoalHeaderPill}
              onPress={() => {
                Haptics.selectionAsync();
                setTempGoalInput(String(goalMl));
                setIsGoalModalVisible(true);
              }}
            >
              <Ionicons name="options-outline" size={14} color={Colors.hydration} />
              <Text style={styles.editGoalHeaderText}>Goal: {goalMl}ml</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Liquid Reservoir Card */}
        <GlassCard
          style={styles.reservoirCard}
          borderColor={percentage >= 100 ? "rgba(52, 211, 153, 0.35)" : "rgba(103, 232, 249, 0.18)"}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.hydration} style={{ marginVertical: 30 }} />
          ) : (
            <>
              <View style={{ alignItems: "center", marginBottom: 4 }}>
                <Ionicons
                  name={percentage >= 100 ? "checkmark-circle" : "water"}
                  size={36}
                  color={percentage >= 100 ? Colors.bioGreen : Colors.hydration}
                />
              </View>
              <Text
                style={[
                  styles.currentWaterText,
                  percentage >= 100 && { color: Colors.bioGreen },
                ]}
              >
                {waterMl.toLocaleString()} <Text style={styles.unitText}>ml</Text>
              </Text>
              <Text style={styles.goalText}>
                Daily Goal: {goalMl.toLocaleString()} ml • {percentage}%
              </Text>

              {/* Liquid Fill Gauge */}
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: percentage >= 100 ? Colors.bioGreen : Colors.hydration,
                    },
                  ]}
                />
              </View>

              {percentage >= 100 && (
                <View style={styles.goalAchievedBadge}>
                  <Ionicons name="sparkles" size={12} color={Colors.bioGreen} />
                  <Text style={styles.goalAchievedText}>Daily Target Reached!</Text>
                </View>
              )}
            </>
          )}
        </GlassCard>

        {/* Quick Add Presets */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm }}>
          <Text style={Typography.metricLabel}>Quick Log Presets</Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setIsCustomLogModalVisible(true);
            }}
          >
            <Text style={{ fontSize: 11, color: Colors.hydration, fontWeight: "600" }}>+ Custom Amount</Text>
          </TouchableOpacity>
        </View>

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
          <TouchableOpacity
            style={styles.presetButton}
            onPress={() => addWater(1000)}
          >
            <Text style={styles.presetAmount}>+1000 ml</Text>
            <Text style={styles.presetLabel}>Jug</Text>
          </TouchableOpacity>
        </View>

        {/* Reminder Config Card */}
        <GlassCard style={{ marginTop: Spacing.lg }}>
          <View style={styles.reminderHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="alarm-outline" size={16} color={Colors.bioAmber} />
              <Text style={Typography.cardTitle}>Push Reminders</Text>
            </View>
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
            between
          </Text>
          <View style={styles.timeRow}>
            <TouchableOpacity style={styles.timeChip} onPress={() => editTime("start")}>
              <Text style={styles.timeChipLabel}>FROM</Text>
              <Text style={styles.timeChipValue}>{fmtMin(startMin)}</Text>
            </TouchableOpacity>
            <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
            <TouchableOpacity style={styles.timeChip} onPress={() => editTime("end")}>
              <Text style={styles.timeChipLabel}>TO</Text>
              <Text style={styles.timeChipValue}>{fmtMin(endMin)}</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={resetWater}>
          <Text style={styles.resetText}>Reset Today's Log</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Confetti Celebration Overlay */}
      <ConfettiCelebration
        visible={showConfetti}
        onDismiss={() => setShowConfetti(false)}
        title="HYDRATION TARGET CRUSHED! 💧"
        subtitle={`${waterMl.toLocaleString()} ml / ${goalMl.toLocaleString()} ml achieved today`}
      />

      {/* iOS reminder time picker (Android uses the native dialog via DateTimePickerAndroid) */}
      <Modal
        visible={editingTime !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingTime(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={Typography.cardTitle}>
              {editingTime === "start" ? "Reminders start at" : "Reminders end at"}
            </Text>
            {/* White background forces UIKit to render the picker in light mode so the text stays visible. */}
            <View style={{ backgroundColor: "#ffffff", borderRadius: 12, marginVertical: Spacing.md }}>
              {editingTime && (
                <DateTimePicker
                  value={minToDate(draftMin)}
                  mode="time"
                  display="spinner"
                  onValueChange={(_e, date) => setDraftMin(date.getHours() * 60 + date.getMinutes())}
                />
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingTime(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={confirmIosTime}>
                <Text style={styles.saveBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Goal Customization Modal */}
      <Modal
        visible={isGoalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGoalModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="water-outline" size={20} color={Colors.hydration} />
                <Text style={Typography.cardTitle}>Set Daily Water Target</Text>
              </View>
              <TouchableOpacity onPress={() => setIsGoalModalVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[Typography.caption, { marginTop: Spacing.xs, marginBottom: Spacing.md }]}>
              Customize your target volume. This will automatically sync to your athlete profile.
            </Text>

            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={tempGoalInput}
              onChangeText={setTempGoalInput}
              placeholder="e.g. 3000"
              placeholderTextColor={Colors.textMuted}
            />

            {/* Quick preset chips */}
            <View style={styles.goalChipsRow}>
              {[2000, 2500, 3000, 3500, 4000].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.goalChip,
                    Number(tempGoalInput) === preset && styles.goalChipActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTempGoalInput(String(preset));
                  }}
                >
                  <Text
                    style={[
                      styles.goalChipText,
                      Number(tempGoalInput) === preset && styles.goalChipTextActive,
                    ]}
                  >
                    {preset / 1000}L
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsGoalModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => {
                  const val = parseInt(tempGoalInput, 10);
                  if (!isNaN(val) && val > 0) {
                    handleSaveGoal(val);
                  }
                }}
              >
                <Text style={styles.saveBtnText}>Save Target</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Log Input Modal */}
      <Modal
        visible={isCustomLogModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomLogModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={Typography.cardTitle}>Custom Water Amount</Text>
              <TouchableOpacity onPress={() => setIsCustomLogModalVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[Typography.caption, { marginTop: Spacing.xs, marginBottom: Spacing.md }]}>
              Enter the exact amount of water you drank in milliliters (ml).
            </Text>

            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={customMlInput}
              onChangeText={setCustomMlInput}
              placeholder="e.g. 330"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsCustomLogModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCustomLogSubmit}
              >
                <Text style={styles.saveBtnText}>Add Water</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: 54,
    paddingBottom: 110,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  editGoalHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(103, 232, 249, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(103, 232, 249, 0.25)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Spacing.radiusPill,
  },
  editGoalHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.hydration,
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
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 5,
    marginTop: Spacing.lg,
    overflow: "hidden",
  },
  gaugeFill: {
    height: "100%",
    backgroundColor: Colors.hydration,
    borderRadius: 5,
  },
  goalAchievedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.3)",
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Spacing.radiusPill,
    marginTop: Spacing.md,
  },
  goalAchievedText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.bioGreen,
  },
  presetGrid: {
    flexDirection: "row",
    gap: Spacing.xs,
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
    fontSize: 12,
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
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  timeChip: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  timeChipLabel: {
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.textMuted,
  },
  timeChipValue: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 2,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    borderRadius: Spacing.radiusCard,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  goalChipsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  goalChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: 8,
    alignItems: "center",
  },
  goalChipActive: {
    backgroundColor: "rgba(103, 232, 249, 0.15)",
    borderColor: Colors.hydration,
  },
  goalChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  goalChipTextActive: {
    color: Colors.hydration,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "flex-end",
  },
  cancelBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radiusButton,
  },
  cancelBtnText: {
    color: Colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: Colors.hydration,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radiusButton,
  },
  saveBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },
});

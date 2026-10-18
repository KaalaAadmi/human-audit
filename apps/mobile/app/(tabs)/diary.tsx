import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { ScrollView, Swipeable } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { NutritionService, FoodLogItem, SearchFoodResult } from '../../services/nutritionService';
import { SyncService } from '../../services/syncService';
import { useToday } from '../../hooks/useToday';
import { localDate } from '../../lib/api';
import { BarcodeScannerModal } from '../../components/BarcodeScannerModal';
import { VoiceLogModal } from '../../components/VoiceLogModal';
import { PhotoMealModal } from '../../components/PhotoMealModal';
import { CustomFoodModal } from '../../components/CustomFoodModal';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type IoniconName = keyof typeof Ionicons.glyphMap;

// Shift a YYYY-MM-DD string by `days` days
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Biomechanical step-burn: kcal = (STEP_COUNT / steps_per_km) × C_WALK × weight_kg
 *   steps_per_km = 1000 / (0.414 × height_m)   (stride ≈ 0.414 × height)
 *   C_WALK = 0.5 kcal / kg / km  (net, above resting — correct when the caller already
 *            accounts for BMR elsewhere; won't double-count the resting burn)
 * Falls back to 400 kcal when weight_kg is missing.
 * ponytail: C_WALK is a module constant; expose as a user-calibration field when per-user
 *           tuning is built (the owner noted their inclined-treadmill walking pushes it to ~0.75)
 */
const C_WALK = 0.5; // net kcal / kg / km; ponytail: per-user calibration field when that feature lands
const STEP_TARGET = 10_000;

function stepBurnKcal(profile: any): number {
  const w = profile?.weight_kg ? parseFloat(profile.weight_kg) : null;
  if (!w) return 400; // ponytail: fallback — remove once weight_kg is always set at onboarding
  const h = profile?.height_cm ? parseFloat(profile.height_cm) : 175;
  const strideM = 0.414 * (h / 100);          // metres per step
  const stepsPerKm = 1000 / strideM;
  return Math.round((STEP_TARGET / stepsPerKm) * C_WALK * w);
}

export default function DiaryScreen() {
  const [diaryDate, setDiaryDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const isToday = diaryDate === (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const { loading, goals, foods: foodLogs, setFoods: setFoodLogs, workouts, profile, error: loadError } = useToday(diaryDate);
  const [prevDayFoods, setPrevDayFoods] = useState<FoodLogItem[]>([]);

  useEffect(() => {
    const prevDate = shiftDate(diaryDate, -1);
    SyncService.fetchFoodLogs(prevDate)
      .then(items => setPrevDayFoods(items))
      .catch(() => setPrevDayFoods([]));
  }, [diaryDate]);

  const targetCalories = loading || !goals ? 0 : goals.calories;
  const targetProteinG = loading || !goals ? 0 : goals.proteinG;
  const targetCarbsG = loading || !goals ? 0 : goals.carbsG;
  const targetFatG = loading || !goals ? 0 : goals.fatG;

  // Only count burn ABOVE the 10K-step baseline — so baseline daily activity doesn't inflate the budget
  const stepBaseline = useMemo(() => stepBurnKcal(profile), [profile]);
  const totalWorkoutBurn = workouts.reduce((acc, w) => acc + w.active_calories, 0);
  const exerciseBurn = Math.max(0, totalWorkoutBurn - stepBaseline);

  // Date picker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Modals & Sheets
  const [activeMealType, setActiveMealType] = useState<MealType>('breakfast');
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchFoodResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  // Serving quantity picker: holds the selected food until the user confirms a quantity
  const [pendingFood, setPendingFood] = useState<SearchFoodResult | null>(null);
  const [pendingServings, setPendingServings] = useState('1');

  // Computed Totals
  const totalFoodCalories = foodLogs.reduce((acc, item) => acc + item.calories, 0);
  const remainingCalories = loading ? 0 : targetCalories - totalFoodCalories + exerciseBurn;
  const totalProteinG = Math.round(foodLogs.reduce((acc, item) => acc + item.proteinG, 0));
  const totalCarbsG = Math.round(foodLogs.reduce((acc, item) => acc + item.carbsG, 0));
  const totalFatG = Math.round(foodLogs.reduce((acc, item) => acc + item.fatG, 0));

  // Date navigation — forward is always allowed (MFP allows logging future meals)
  const stepBack = useCallback(() => setDiaryDate(d => shiftDate(d, -1)), []);
  const stepForward = useCallback(() => setDiaryDate(d => shiftDate(d, 1)), []);

  const handlePickerChange = useCallback((_: unknown, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // keep open on iOS until dismissed
    if (date) {
      setDiaryDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }
    if (Platform.OS !== 'ios') setShowDatePicker(false);
  }, []);

  // Helpers for display
  const dateLabel = isToday
    ? 'TODAY'
    : new Date(diaryDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

  // Handlers
  const handleOpenAddModal = (meal: MealType) => {
    setActiveMealType(meal);
    setShowLogSheet(true);
    Haptics.selectionAsync();
  };

  const handleAddFoodItem = (food: SearchFoodResult, meal: MealType = activeMealType, servings = 1) => {
    const s = Math.max(0.25, servings);
    const newLog: FoodLogItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: food.name,
      brand: food.brand,
      mealType: meal,
      servingSize: s === 1 ? food.servingSize : `${s} × ${food.servingSize}`,
      servingGrams: food.servingGrams * s,
      servingsCount: s,
      calories: Math.round(food.calories * s),
      proteinG: Math.round(food.proteinG * s * 10) / 10,
      carbsG: Math.round(food.carbsG * s * 10) / 10,
      fatG: Math.round(food.fatG * s * 10) / 10,
      source: food.source as any,
      loggedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Optimistic row; swapped for the server row (real id) on success, removed on failure.
    setFoodLogs(prev => [newLog, ...prev]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    SyncService.syncFoodLog(newLog, diaryDate)
      .then(saved => setFoodLogs(prev => prev.map(f => (f.id === newLog.id ? saved : f))))
      .catch(e => {
        setFoodLogs(prev => prev.filter(f => f.id !== newLog.id));
        Alert.alert('Could not save food', (e as Error).message);
      });
  };

  // Called from the serving-quantity confirmation step in the search modal
  const confirmPendingFood = () => {
    if (!pendingFood) return;
    const s = parseFloat(pendingServings) || 1;
    handleAddFoodItem(pendingFood, activeMealType, s);
    setPendingFood(null);
    setPendingServings('1');
    setShowSearchModal(false);
  };

  const handleAddMultipleFoods = (items: SearchFoodResult[]) => {
    items.forEach(item => handleAddFoodItem(item));
  };

  const handleDeleteFood = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const removed = foodLogs.find(item => item.id === id);
    setFoodLogs(prev => prev.filter(item => item.id !== id));
    SyncService.deleteFoodLog(id).catch(e => {
      if (removed) setFoodLogs(prev => [removed, ...prev]);
      Alert.alert('Could not delete', (e as Error).message);
    });
  };

  // Edit Food Modal State
  const [editingFood, setEditingFood] = useState<FoodLogItem | null>(null);
  const [editServings, setEditServings] = useState('1');
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editMealType, setEditMealType] = useState<MealType>('breakfast');

  const handleOpenEditModal = (item: FoodLogItem) => {
    setEditingFood(item);
    setEditServings(String(item.servingsCount || 1));
    setEditCalories(String(item.calories));
    setEditProtein(String(item.proteinG));
    setEditCarbs(String(item.carbsG));
    setEditFat(String(item.fatG));
    setEditMealType(item.mealType);
    Haptics.selectionAsync();
  };

  const handleSaveEditFood = () => {
    if (!editingFood) return;
    const s = parseFloat(editServings) || 1;
    const updated: FoodLogItem = {
      ...editingFood,
      servingsCount: s,
      mealType: editMealType,
      calories: parseInt(editCalories, 10) || 0,
      proteinG: parseFloat(editProtein) || 0,
      carbsG: parseFloat(editCarbs) || 0,
      fatG: parseFloat(editFat) || 0,
    };
    setFoodLogs(prev => prev.map(f => (f.id === updated.id ? updated : f)));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    SyncService.updateFoodLog(updated).catch(e => Alert.alert('Could not update food', (e as Error).message));
    setEditingFood(null);
  };

  const handleLogPreviousFood = (item: FoodLogItem, meal: MealType = activeMealType) => {
    handleAddFoodItem({
      id: `prev_${item.id}`,
      name: item.name,
      brand: item.brand,
      servingSize: item.servingSize,
      servingGrams: item.servingGrams,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      source: (item.source === 'usda' || item.source === 'openfoodfacts' ? item.source : 'custom'),
    }, meal, item.servingsCount || 1);
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchNote(null);
    try {
      const { results, fallback } = await NutritionService.searchFoods(text);
      setSearchResults(results);
      if (fallback) setSearchNote('Open Food Facts had no match - showing USDA results.');
    } catch (e) {
      setSearchResults([]);
      setSearchNote(`Search failed: ${(e as Error).message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const meals: { key: MealType; label: string; icon: IoniconName }[] = [
    { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { key: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
    { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { key: 'snack', label: 'Snacks', icon: 'cafe-outline' },
  ];

  // Weekly day strip: Mon–Sun centred on diaryDate
  const weekStrip = useMemo(() => {
    const base = new Date(diaryDate + 'T12:00:00');
    // Monday of that week
    const dayOfWeek = base.getDay(); // 0 = Sun
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((dayOfWeek + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // isFuture = after today's local date (regardless of which week is showing)
      const today = localDate();
      return {
        iso,
        label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
        isSelected: iso === diaryDate,
        isFuture: iso > today,
      };
    });
  }, [diaryDate]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={Typography.heroTitle}>Food Diary</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable onPress={stepBack} hitSlop={8}>
              <Ionicons name="chevron-back" size={20} color={Colors.bioGreen} />
            </Pressable>
            <Pressable style={styles.todayPill} onPress={() => setShowDatePicker(true)} hitSlop={4}>
              <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700' }]}>{dateLabel}</Text>
              <Ionicons name="calendar-outline" size={11} color={Colors.bioGreen} style={{ marginLeft: 3 }} />
            </Pressable>
            <Pressable onPress={stepForward} hitSlop={8}>
              <Ionicons name="chevron-forward" size={20} color={Colors.bioGreen} />
            </Pressable>
          </View>
        </View>

        {/* Weekly day strip */}
        <View style={styles.weekStrip}>
          {weekStrip.map((day) => (
            <Pressable
              key={day.iso}
              style={[styles.dayDot, day.isSelected && styles.dayDotSelected]}
              onPress={() => setDiaryDate(day.iso)}
              hitSlop={4}
            >
              <Text style={[styles.dayDotLabel, day.isSelected && styles.dayDotLabelSelected, day.isFuture && { opacity: 0.45 }]}>
                {day.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Date picker (iOS: inline calendar modal; Android: native spinner) */}
        {showDatePicker && (
          Platform.OS === 'ios' ? (
            <Modal transparent animationType="fade" visible onRequestClose={() => setShowDatePicker(false)}>
              <Pressable style={styles.pickerOverlay} onPress={() => setShowDatePicker(false)}>
                <View style={styles.pickerCard}>
                  {/* White background forces UIKit to render the inline calendar in light mode (black text).
                      Passing Colors.canvas (dark) causes the month/day text to be invisible. */}
                  <View style={{ backgroundColor: '#ffffff' }}>
                    <DateTimePicker
                      value={new Date(diaryDate + 'T12:00:00')}
                      mode="date"
                      display="inline"
                      onChange={handlePickerChange}
                      accentColor={Colors.bioGreen}
                    />
                  </View>
                </View>
              </Pressable>
            </Modal>
          ) : (
            <DateTimePicker
              value={new Date(diaryDate + 'T12:00:00')}
              mode="date"
              display="default"
              onValueChange={handlePickerChange}
            />
          )
        )}

        {loadError && <Text style={[Typography.caption, { color: Colors.bioRose, marginBottom: Spacing.md }]}>Couldn't load log: {loadError}</Text>}

        {/* Calorie Summary Card — MFP-style */}
        <GlassCard style={styles.calorieCard}>
          {/* 3-column summary row */}
          <View style={styles.calSummaryRow}>
            <View style={styles.calSummaryCol}>
              <Text style={styles.calSummaryValue}>{totalFoodCalories}</Text>
              <Text style={styles.calSummaryLabel}>Eaten</Text>
            </View>
            <View style={styles.calSummaryMid}>
                <Text style={styles.calSummaryFire}>🔥</Text>
                <Text style={styles.calSummaryGoal}>{loading ? '--' : targetCalories}</Text>
                <Text style={styles.calSummaryLabel}>Goal</Text>
              </View>
            <View style={styles.calSummaryCol}>
              <Text style={[styles.calSummaryValue, !loading && remainingCalories < 0 && { color: Colors.bioRose }]}>
                {loading ? '--' : remainingCalories}
              </Text>
              <Text style={styles.calSummaryLabel}>Remaining</Text>
            </View>
          </View>

          {exerciseBurn > 0 && (
            <Text style={styles.exerciseBurnNote}>+ {exerciseBurn} kcal exercise (above baseline)</Text>
          )}

          {/* Macro numbers row */}
          <View style={styles.macroNumRow}>
            <View style={styles.macroNumCol}>
              <Text style={[styles.macroNumValue, { color: Colors.bioAmber }]}>{totalCarbsG}g</Text>
              <Text style={styles.macroNumSub}>Carbs</Text>
              <Text style={styles.macroNumSub}>{loading ? '--' : `${targetCarbsG}g`}</Text>
            </View>
            <View style={styles.macroNumDivider} />
            <View style={styles.macroNumCol}>
              <Text style={[styles.macroNumValue, { color: Colors.bioRose }]}>{totalFatG}g</Text>
              <Text style={styles.macroNumSub}>Fat</Text>
              <Text style={styles.macroNumSub}>{loading ? '--' : `${targetFatG}g`}</Text>
            </View>
            <View style={styles.macroNumDivider} />
            <View style={styles.macroNumCol}>
              <Text style={[styles.macroNumValue, { color: Colors.bioGreen }]}>{totalProteinG}g</Text>
              <Text style={styles.macroNumSub}>Protein</Text>
              <Text style={styles.macroNumSub}>{loading ? '--' : `${targetProteinG}g`}</Text>
            </View>
          </View>

          {/* Macro Progress Bars */}
          <View style={styles.macroBarsContainer}>
            {/* Protein */}
            <View style={styles.macroBarCol}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${Math.min(100, Math.round((totalProteinG / targetProteinG) * 100))}%`, backgroundColor: Colors.bioGreen }]}
                />
              </View>
            </View>

            {/* Carbs */}
            <View style={styles.macroBarCol}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${Math.min(100, Math.round((totalCarbsG / targetCarbsG) * 100))}%`, backgroundColor: Colors.bioAmber }]}
                />
              </View>
            </View>

            {/* Fat */}
            <View style={styles.macroBarCol}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${Math.min(100, Math.round((totalFatG / targetFatG) * 100))}%`, backgroundColor: Colors.bioRose }]}
                />
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Meal Group Sections */}
        {meals.map(meal => {
          const mealLogs = foodLogs.filter(f => f.mealType === meal.key);
          const mealCalories = mealLogs.reduce((acc, f) => acc + f.calories, 0);
          const mealProtein = Math.round(mealLogs.reduce((acc, f) => acc + f.proteinG, 0));
          const prevMealLogs = prevDayFoods.filter(f =>
            f.mealType === meal.key &&
            !mealLogs.some(todayItem => todayItem.name.trim().toLowerCase() === f.name.trim().toLowerCase())
          );

          return (
            <View key={meal.key} style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                  <Ionicons name={meal.icon} size={16} color={Colors.bioGreen} />
                  <Text style={Typography.cardTitle}>{meal.label}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <Text style={[Typography.caption, { color: Colors.textMuted }]}>
                    {mealCalories} kcal • {mealProtein}g P
                  </Text>
                  <Pressable style={styles.addBtn} onPress={() => handleOpenAddModal(meal.key)}>
                    <Text style={styles.addBtnText}>+ Log</Text>
                  </Pressable>
                </View>
              </View>

              {mealLogs.length === 0 && prevMealLogs.length === 0 ? (
                <Pressable style={styles.emptyMealBox} onPress={() => handleOpenAddModal(meal.key)}>
                  <Text style={[Typography.caption, { color: Colors.textMuted }]}>
                    No food logged for {meal.label.toLowerCase()} yet. Tap to add.
                  </Text>
                </Pressable>
              ) : (
                <>
                  {/* Today's Logged Foods: swipe right-to-left to reveal delete, tap to edit */}
                  {mealLogs.map(item => (
                    <Swipeable
                      key={item.id}
                      renderRightActions={(_progress, _dragX) => (
                        <Pressable
                          style={styles.swipeDeleteBtn}
                          onPress={() => handleDeleteFood(item.id)}
                        >
                          <Ionicons name="trash-outline" size={22} color="#fff" />
                          <Text style={styles.swipeActionText}>Delete</Text>
                        </Pressable>
                      )}
                      overshootRight={false}
                    >
                      <Pressable onPress={() => handleOpenEditModal(item)}>
                        <GlassCard style={styles.foodItemCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={[Typography.bodyText, { fontWeight: '700' }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
                              {item.servingSize} • {item.loggedAt}
                            </Text>
                            <View style={styles.itemMacroRow}>
                              <Text style={[Typography.caption, { color: Colors.bioGreen }]}>P: {item.proteinG}g</Text>
                              <Text style={[Typography.caption, { color: Colors.bioAmber }]}>C: {item.carbsG}g</Text>
                              <Text style={[Typography.caption, { color: Colors.bioRose }]}>F: {item.fatG}g</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                            <Text style={[Typography.bodyMono, { color: Colors.textPure, fontWeight: '700' }]}>
                              {item.calories} <Text style={{ fontSize: 11, color: Colors.textMuted }}>kcal</Text>
                            </Text>
                            <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginTop: 4 }} />
                          </View>
                        </GlassCard>
                      </Pressable>
                    </Swipeable>
                  ))}

                  {/* Yesterday's Foods for this meal: only shown if not already logged today */}
                  {prevMealLogs.map(prevItem => (
                    <Swipeable
                      key={`prev_${prevItem.id}`}
                      renderRightActions={(_progress, _dragX) => (
                        <Pressable
                          style={styles.swipeLogBtn}
                          onPress={() => handleLogPreviousFood(prevItem, meal.key)}
                        >
                          <Ionicons name="add-circle-outline" size={22} color="#fff" />
                          <Text style={styles.swipeActionText}>Log</Text>
                        </Pressable>
                      )}
                      overshootRight={false}
                    >
                      <Pressable onPress={() => handleLogPreviousFood(prevItem, meal.key)}>
                        <GlassCard style={[styles.foodItemCard, styles.prevDayFoodCard]}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[Typography.bodyText, { fontWeight: '700', color: Colors.textPure }]} numberOfLines={1}>
                                {prevItem.name}
                              </Text>
                              <View style={styles.yesterdayBadge}>
                                <Text style={styles.yesterdayBadgeText}>Yesterday</Text>
                              </View>
                            </View>
                            <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
                              {prevItem.servingSize} • Tap or slide to log
                            </Text>
                            <View style={styles.itemMacroRow}>
                              <Text style={[Typography.caption, { color: Colors.bioGreen }]}>P: {prevItem.proteinG}g</Text>
                              <Text style={[Typography.caption, { color: Colors.bioAmber }]}>C: {prevItem.carbsG}g</Text>
                              <Text style={[Typography.caption, { color: Colors.bioRose }]}>F: {prevItem.fatG}g</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                            <Text style={[Typography.bodyMono, { color: Colors.textPure, fontWeight: '700' }]}>
                              {prevItem.calories} <Text style={{ fontSize: 11, color: Colors.textMuted }}>kcal</Text>
                            </Text>
                            <View style={styles.quickLogPill}>
                              <Text style={styles.quickLogText}>+ Log</Text>
                            </View>
                          </View>
                        </GlassCard>
                      </Pressable>
                    </Swipeable>
                  ))}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Multi-Modal Logging Bottom Action Sheet */}
      <Modal visible={showLogSheet} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLogSheet(false)}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={[Typography.cardTitle, { marginBottom: 2 }]}>
              Log {meals.find(m => m.key === activeMealType)?.label}
            </Text>
            <Text style={[Typography.caption, { marginBottom: Spacing.md }]}>Select intake telemetry method</Text>

            <View style={styles.sheetGrid}>
              <Pressable
                style={styles.sheetOption}
                onPress={() => {
                  setShowLogSheet(false);
                  setShowSearchModal(true);
                }}
              >
                <Ionicons name="search-outline" size={22} color={Colors.bioGreen} style={{ marginBottom: 6 }} />
                <Text style={styles.sheetLabel}>Search Foods</Text>
                <Text style={styles.sheetSub}>Open Food Facts + USDA</Text>
              </Pressable>

              <Pressable
                style={styles.sheetOption}
                onPress={() => {
                  setShowLogSheet(false);
                  setShowBarcodeModal(true);
                }}
              >
                <Ionicons name="barcode-outline" size={22} color={Colors.bioAmber} style={{ marginBottom: 6 }} />
                <Text style={styles.sheetLabel}>Barcode Scan</Text>
                <Text style={styles.sheetSub}>UPC / EAN Lens</Text>
              </Pressable>

              <Pressable
                style={styles.sheetOption}
                onPress={() => {
                  setShowLogSheet(false);
                  setShowVoiceModal(true);
                }}
              >
                <Ionicons name="mic-outline" size={22} color={Colors.bioLavender} style={{ marginBottom: 6 }} />
                <Text style={styles.sheetLabel}>Voice Log</Text>
                <Text style={styles.sheetSub}>Natural Language</Text>
              </Pressable>

              <Pressable
                style={styles.sheetOption}
                onPress={() => {
                  setShowLogSheet(false);
                  setShowPhotoModal(true);
                }}
              >
                <Ionicons name="camera-outline" size={22} color={Colors.skyBlue} style={{ marginBottom: 6 }} />
                <Text style={styles.sheetLabel}>Photo AI</Text>
                <Text style={styles.sheetSub}>Vision Plate Scan</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.customFoodBtn}
              onPress={() => {
                setShowLogSheet(false);
                setShowCustomModal(true);
              }}
            >
              <Text style={styles.customFoodBtnText}>+ Create Custom Food / Recipe</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Direct Search Modal */}
      <Modal visible={showSearchModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalContainer}>
            <View style={styles.searchHeader}>
              <TextInput
                style={styles.searchBar}
                placeholder="Search chicken breast, oats, avocado..."
                placeholderTextColor={Colors.textMuted}
                autoFocus
                value={searchQuery}
                onChangeText={handleSearch}
              />
              <Pressable onPress={() => { setShowSearchModal(false); setPendingFood(null); setPendingServings('1'); }} style={styles.closeSearchBtn}>
                <Text style={{ color: Colors.textMuted }}>Close</Text>
              </Pressable>
            </View>

            {/* Serving-quantity step: shown after tapping a result */}
            {pendingFood ? (
              <View style={styles.servingPicker}>
                <Text style={[Typography.cardTitle, { marginBottom: 4 }]}>{pendingFood.name}</Text>
                <Text style={[Typography.caption, { color: Colors.textMuted, marginBottom: Spacing.md }]}>
                  1 serving = {pendingFood.servingSize} • {pendingFood.calories} kcal
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
                  <Pressable
                    style={styles.servingBtn}
                    onPress={() => setPendingServings(s => String(Math.max(0.25, (parseFloat(s) || 1) - 0.5)))}
                    hitSlop={8}
                  >
                    <Text style={styles.servingBtnText}>−</Text>
                  </Pressable>
                  <TextInput
                    style={styles.servingInput}
                    value={pendingServings}
                    onChangeText={setPendingServings}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                  <Pressable
                    style={styles.servingBtn}
                    onPress={() => setPendingServings(s => String((parseFloat(s) || 1) + 0.5))}
                    hitSlop={8}
                  >
                    <Text style={styles.servingBtnText}>+</Text>
                  </Pressable>
                  <Text style={[Typography.caption, { color: Colors.textMuted }]}>servings</Text>
                </View>
                {/* Live macro preview */}
                {(() => {
                  const s = Math.max(0.25, parseFloat(pendingServings) || 1);
                  return (
                    <View style={styles.servingPreview}>
                      <Text style={[Typography.bodyMono, { color: Colors.bioGreen, fontWeight: '700' }]}>
                        {Math.round(pendingFood.calories * s)} kcal
                      </Text>
                      <Text style={[Typography.caption, { color: Colors.bioGreen }]}>P: {Math.round(pendingFood.proteinG * s * 10) / 10}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioAmber }]}>C: {Math.round(pendingFood.carbsG * s * 10) / 10}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioRose }]}>F: {Math.round(pendingFood.fatG * s * 10) / 10}g</Text>
                    </View>
                  );
                })()}
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
                  <Pressable style={[styles.servingConfirm, { flex: 1 }]} onPress={confirmPendingFood}>
                    <Text style={styles.servingConfirmText}>Add to {activeMealType}</Text>
                  </Pressable>
                  <Pressable style={styles.servingCancel} onPress={() => { setPendingFood(null); setPendingServings('1'); }}>
                    <Text style={{ color: Colors.textMuted, fontWeight: '600' }}>Back</Text>
                  </Pressable>
                </View>
              </View>
            ) : isSearching ? (
              <ActivityIndicator size="small" color={Colors.bioGreen} style={{ marginTop: Spacing.xl }} />
            ) : (
              <>
              {searchNote && <Text style={[Typography.caption, { marginTop: Spacing.sm }]}>{searchNote}</Text>}
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.searchResultRow}
                    onPress={() => { setPendingFood(item); setPendingServings('1'); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.bodyText, { fontWeight: '700' }]}>{item.name}</Text>
                      <Text style={Typography.caption}>
                        {item.servingSize} • {item.brand || (item.source === 'usda' ? 'USDA' : 'Open Food Facts')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[Typography.bodyMono, { color: Colors.bioGreen, fontWeight: '700' }]}>
                        {item.calories} kcal
                      </Text>
                      <Text style={Typography.caption}>P: {item.proteinG}g</Text>
                    </View>
                  </Pressable>
                )}
                ListEmptyComponent={
                  searchQuery.length > 0 ? (
                    <Text style={[Typography.caption, { textAlign: 'center', marginTop: Spacing.xl }]}>
                      No foods matching "{searchQuery}"
                    </Text>
                  ) : null
                }
              />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Auxiliary Modals */}
      <BarcodeScannerModal
        visible={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
        onFoodScanned={handleAddFoodItem}
      />
      <VoiceLogModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onItemsParsed={handleAddMultipleFoods}
      />
      <PhotoMealModal
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onMealAnalyzed={handleAddMultipleFoods}
      />
      <CustomFoodModal
        visible={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onFoodCreated={food => {
          SyncService.createCustomFood(food).catch(e => Alert.alert('Could not save to your library', (e as Error).message));
          handleAddFoodItem(food);
        }}
      />

      {/* Edit Food Item Modal (MFP style) */}
      <Modal visible={Boolean(editingFood)} animationType="slide" transparent onRequestClose={() => setEditingFood(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditingFood(null)}>
          <Pressable style={styles.editFoodContainer} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={[Typography.cardTitle, { marginBottom: 2 }]} numberOfLines={1}>
              {editingFood?.name}
            </Text>
            <Text style={[Typography.caption, { color: Colors.textMuted, marginBottom: Spacing.md }]}>
              {editingFood?.brand || 'Logged Food'} • {editingFood?.servingSize}
            </Text>

            {/* Meal Type Selector */}
            <Text style={[Typography.statLabel, { marginBottom: 6 }]}>MEAL</Text>
            <View style={styles.editMealRow}>
              {meals.map(m => {
                const isSelected = editMealType === m.key;
                return (
                  <Pressable
                    key={m.key}
                    style={[styles.editMealPill, isSelected && styles.editMealPillActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEditMealType(m.key);
                    }}
                  >
                    <Text style={[styles.editMealPillText, isSelected && { color: '#000', fontWeight: '700' }]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Servings count */}
            <Text style={[Typography.statLabel, { marginTop: Spacing.sm, marginBottom: 4 }]}>NUMBER OF SERVINGS</Text>
            <TextInput
              style={styles.editInput}
              keyboardType="numeric"
              value={editServings}
              onChangeText={setEditServings}
              placeholder="1"
              placeholderTextColor={Colors.textMuted}
            />

            {/* Macros Matrix */}
            <View style={styles.editMacroGrid}>
              <View style={styles.editMacroCol}>
                <Text style={Typography.caption}>Calories</Text>
                <TextInput
                  style={styles.editInput}
                  keyboardType="numeric"
                  value={editCalories}
                  onChangeText={setEditCalories}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={styles.editMacroCol}>
                <Text style={[Typography.caption, { color: Colors.bioGreen }]}>Protein (g)</Text>
                <TextInput
                  style={styles.editInput}
                  keyboardType="numeric"
                  value={editProtein}
                  onChangeText={setEditProtein}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={styles.editMacroCol}>
                <Text style={[Typography.caption, { color: Colors.bioAmber }]}>Carbs (g)</Text>
                <TextInput
                  style={styles.editInput}
                  keyboardType="numeric"
                  value={editCarbs}
                  onChangeText={setEditCarbs}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={styles.editMacroCol}>
                <Text style={[Typography.caption, { color: Colors.bioRose }]}>Fat (g)</Text>
                <TextInput
                  style={styles.editInput}
                  keyboardType="numeric"
                  value={editFat}
                  onChangeText={setEditFat}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ marginTop: Spacing.lg, gap: Spacing.sm }}>
              <Pressable style={styles.saveGoalBtn} onPress={handleSaveEditFood}>
                <Text style={styles.saveGoalBtnText}>Save Changes</Text>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <Pressable
                  style={[styles.editDeleteBtn, { flex: 1 }]}
                  onPress={() => {
                    if (editingFood) {
                      handleDeleteFood(editingFood.id);
                      setEditingFood(null);
                    }
                  }}
                >
                  <Text style={{ color: Colors.bioRose, fontWeight: '700', fontSize: 13 }}>Delete Item</Text>
                </Pressable>
                <Pressable style={[styles.editCancelBtn, { flex: 1 }]} onPress={() => setEditingFood(null)}>
                  <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingTop: 54,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotSelected: {
    backgroundColor: Colors.bioGreen,
  },
  dayDotLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  dayDotLabelSelected: {
    color: Colors.canvas,
  },
  calorieCard: {
    marginBottom: Spacing.xl,
  },
  calSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  calSummaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  calSummaryMid: {
    alignItems: 'center',
    flex: 1.2,
  },
  calSummaryFire: {
    fontSize: 24,
    lineHeight: 28,
  },
  calSummaryGoal: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPure,
    fontVariant: ['tabular-nums'],
  },
  calSummaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPure,
    fontVariant: ['tabular-nums'],
  },
  calSummaryLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseBurnNote: {
    fontSize: 11,
    color: Colors.bioGreen,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  macroNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderMachined,
    marginTop: Spacing.xs,
  },
  macroNumCol: {
    alignItems: 'center',
    flex: 1,
  },
  macroNumValue: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  macroNumSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  macroNumDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.borderMachined,
  },
  macroBarsContainer: {
    marginTop: Spacing.sm,
    gap: 4,
  },
  macroBarCol: {},
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  mealSection: {
    marginBottom: Spacing.lg,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  addBtn: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  addBtnText: {
    color: Colors.bioGreen,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyMealBox: {
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  foodItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
    padding: Spacing.md,
  },
  itemMacroRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.borderMachined,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sheetOption: {
    width: '48%',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  sheetIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  sheetLabel: {
    color: Colors.textPure,
    fontWeight: '700',
    fontSize: 14,
  },
  sheetSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  customFoodBtn: {
    backgroundColor: Colors.surfaceHighlight,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  customFoodBtnText: {
    color: Colors.bioGreen,
    fontWeight: '700',
    fontSize: 13,
  },
  searchModalContainer: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    height: '85%',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    color: Colors.textPure,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  closeSearchBtn: {
    padding: Spacing.sm,
  },
  searchResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderMachined,
  },
  servingPicker: {
    paddingTop: Spacing.sm,
  },
  servingBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingBtnText: {
    color: Colors.textPure,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
  },
  servingInput: {
    width: 64,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.bioGreen,
    color: Colors.textPure,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 6,
  },
  servingPreview: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  servingConfirm: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
  },
  servingConfirmText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  servingCancel: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: Colors.canvas,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    margin: 24,
  },
  swipeDeleteBtn: {
    backgroundColor: Colors.bioRose,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginBottom: Spacing.xs,
    borderRadius: 12,
  },
  swipeLogBtn: {
    backgroundColor: Colors.bioGreen,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    marginBottom: Spacing.xs,
    borderRadius: 12,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  prevDayFoodCard: {
    borderStyle: 'dashed',
    borderColor: 'rgba(52, 211, 153, 0.3)',
    backgroundColor: 'rgba(52, 211, 153, 0.04)',
  },
  yesterdayBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  yesterdayBadgeText: {
    color: Colors.bioGreen,
    fontSize: 10,
    fontWeight: '700',
  },
  quickLogPill: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  quickLogText: {
    color: Colors.bioGreen,
    fontSize: 11,
    fontWeight: '700',
  },
  editFoodContainer: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  editMealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  editMealPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    alignItems: 'center',
  },
  editMealPillActive: {
    backgroundColor: Colors.bioGreen,
    borderColor: Colors.bioGreen,
  },
  editMealPillText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  editInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.sm,
    color: Colors.textPure,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    marginTop: 4,
  },
  editMacroGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  editMacroCol: {
    flex: 1,
  },
  saveGoalBtn: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveGoalBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  editDeleteBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCancelBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React, { useState, useEffect } from 'react';
import { Platform, StyleSheet, Text, View, ScrollView, Pressable, TextInput, Switch, TouchableOpacity, Alert, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { CustomFoodModal } from '../../components/CustomFoodModal';
import { RecipeBuilderModal, CustomRecipe } from '../../components/RecipeBuilderModal';
import { SearchFoodResult } from '../../services/nutritionService';
import { SyncService, DEFAULT_GOALS, DEFAULT_WEARABLES, WearableSettings } from '../../services/syncService';
import { DEFAULT_REMINDER_START_MIN, DEFAULT_REMINDER_END_MIN, fmtMin, minToDate, scheduleWaterReminders } from '../../services/waterReminders';
import { SourceOrder, useSourcePrefs } from '../../components/SourceOrder';
import { Sheet } from '../../components/Sheet';
import { bodyAgeFor } from '../../services/bodyAge';
import { BIOMETRICS_ENABLED_KEY } from '../../components/BiometricPrivacyLock';

/** [value sent to POST /api/reports, label]; the server keeps only these values. */
const REPORT_REASONS = [['offensive', 'Offensive or inappropriate'], ['wrong_values', 'Wrong nutrition values'], ['spam', 'Spam or duplicate'], ['other', 'Something else']] as const;

type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type LibraryTab = 'foods' | 'recipes';

interface DayGoal {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const sourcePrefs = useSourcePrefs();
  // Server-backed state (loaded on mount; null/empty until then)
  const [profile, setProfile] = useState<any>(null);
  const [waistDraft, setWaistDraft] = useState<string | null>(null); // null = not editing
  const [vitals, setVitals] = useState<any>(null);
  const [wearables, setWearables] = useState<WearableSettings>(DEFAULT_WEARABLES);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Day of Week Macro Goals State
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('mon');
  const [goalsSavedNotification, setGoalsSavedNotification] = useState(false);
  const [dayGoals, setDayGoals] = useState<Record<DayOfWeek, DayGoal>>({
    mon: DEFAULT_GOALS, tue: DEFAULT_GOALS, wed: DEFAULT_GOALS, thu: DEFAULT_GOALS, fri: DEFAULT_GOALS, sat: DEFAULT_GOALS, sun: DEFAULT_GOALS,
  });

  // Nutrition Library State
  const [activeLibTab, setActiveLibTab] = useState<LibraryTab>('foods');
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [customFoods, setCustomFoods] = useState<SearchFoodResult[]>([]);
  const [customRecipes, setCustomRecipes] = useState<CustomRecipe[]>([]);

  const fail = (what: string) => (e: unknown) => Alert.alert(what, (e as Error).message);
  // Item being reported; the sheet asks for a reason (a sheet, not Alert.alert: Android alerts have no choices).
  const [reporting, setReporting] = useState<{ kind: 'food' | 'recipe'; id: string; hide: () => void } | null>(null);
  const report = (kind: 'food' | 'recipe', id: string, hide: () => void) => setReporting({ kind, id, hide });
  const sendReport = (reason: string) => {
    const r = reporting;
    setReporting(null);
    if (r) SyncService.reportShared(r.kind, r.id, reason).then(r.hide).catch(fail('Could not report'));
  };

  useEffect(() => {
    // custom_foods / custom_recipes tables may not exist until migrations are applied — fetch them
    // with a fallback so a missing table doesn't block the whole settings screen.
    const safeFoods = SyncService.fetchCustomFoods().catch(() => [] as any[]);
    const safeRecipes = SyncService.fetchCustomRecipes().catch(() => [] as any[]);

    Promise.all([
      SyncService.fetchUserProfile(), SyncService.fetchVitals(), SyncService.fetchMacroGoals(), SyncService.fetchWearableSettings(),
      safeFoods, safeRecipes,
    ])
      .then(([p, v, g, w, cf, cr]) => {
        setProfile(p); setVitals(v); setWearables(w); setCustomFoods(cf); setCustomRecipes(cr);
        // goals[] is indexed 0 = Sunday ... 6 = Saturday
        setDayGoals({ sun: g[0], mon: g[1], tue: g[2], wed: g[3], thu: g[4], fri: g[5], sat: g[6] });
      })
      .catch(e => setLoadError((e as Error).message));
  }, []);

  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();

  // Biometrics & Security State
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY).then(val => {
      setBiometricsEnabled(val === 'true');
    });
  }, []);

  const handleToggleBiometrics = async (val: boolean) => {
    await Haptics.selectionAsync();
    setBiometricsEnabled(val);
    await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, val ? 'true' : 'false');
  };

  // Water reminder window (stored as minutes from midnight on the profile)
  const [editingTime, setEditingTime] = useState<'start' | 'end' | null>(null); // iOS picker modal
  const [draftMin, setDraftMin] = useState(0); // iOS picker value, applied on Done
  const reminderStart: number = profile?.water_reminder_start_min ?? DEFAULT_REMINDER_START_MIN;
  const reminderEnd: number = profile?.water_reminder_end_min ?? DEFAULT_REMINDER_END_MIN;

  /** Validates, saves and (if reminders are on) reschedules the reminder window. */
  const saveReminderWindow = (start: number, end: number) => {
    if (end === 0) end = 1440; // picking 12:00 AM as the end means "until midnight"
    if (end <= start) {
      Alert.alert('Invalid window', 'The end time must be after the start time.');
      return;
    }
    Haptics.selectionAsync();
    const patch = { water_reminder_start_min: start, water_reminder_end_min: end };
    const prev = profile;
    setProfile((p: any) => ({ ...p, ...patch }));
    SyncService.updateUserProfile(patch).catch(e => { setProfile(prev); fail('Could not save reminder window')(e); });
    scheduleWaterReminders(
      profile?.water_reminder_enabled ?? true, start, end, profile?.water_reminder_interval_mins || 90,
    ).catch(e => console.warn('[REMINDER_ERR]', e));
  };

  const saveWaist = () => {
    const cm = Number(waistDraft?.replace(',', '.'));
    if (!(cm >= 40 && cm <= 200)) { Alert.alert('Invalid waist', 'Enter your waist circumference in cm, between 40 and 200.'); return; }
    Haptics.selectionAsync();
    SyncService.updateUserProfile({ waist_cm: cm })
      .then((p) => { setProfile(p); setWaistDraft(null); Alert.alert('Saved', 'Your body age and VO₂max update within a minute or two.'); })
      .catch(fail('Could not save waist'));
  };

  const editReminderTime = (which: 'start' | 'end') => {
    Haptics.selectionAsync();
    const current = which === 'start' ? reminderStart : reminderEnd;
    if (Platform.OS === 'ios') {
      setDraftMin(current);
      setEditingTime(which);
      return;
    }
    DateTimePickerAndroid.open({
      value: minToDate(current),
      mode: 'time',
      is24Hour: false,
      onValueChange: (_e, date) => {
        const m = date.getHours() * 60 + date.getMinutes();
        which === 'start' ? saveReminderWindow(m, reminderEnd) : saveReminderWindow(reminderStart, m);
      },
    });
  };

  const confirmIosTime = () => {
    if (editingTime === 'start') saveReminderWindow(draftMin, reminderEnd);
    else if (editingTime === 'end') saveReminderWindow(reminderStart, draftMin);
    setEditingTime(null);
  };

  const handleSignOut = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      if (signOut) {
        await signOut();
      }
    } catch {
      //
    }
    router.replace('/auth/login' as any);
  };

  const saveWearables = (patch: Partial<WearableSettings>) => {
    Haptics.selectionAsync();
    const prev = wearables;
    setWearables({ ...prev, ...patch });
    SyncService.saveWearableSettings(patch).catch(e => { setWearables(prev); fail('Could not save')(e); });
  };

  const days: { key: DayOfWeek; label: string; full: string }[] = [
    { key: 'mon', label: 'Mon', full: 'Monday' },
    { key: 'tue', label: 'Tue', full: 'Tuesday' },
    { key: 'wed', label: 'Wed', full: 'Wednesday' },
    { key: 'thu', label: 'Thu', full: 'Thursday' },
    { key: 'fri', label: 'Fri', full: 'Friday' },
    { key: 'sat', label: 'Sat', full: 'Saturday' },
    { key: 'sun', label: 'Sun', full: 'Sunday' },
  ];

  const updateGoalField = (field: keyof DayGoal, value: string) => {
    const num = parseInt(value, 10) || 0;
    setDayGoals(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        [field]: num,
      },
    }));
  };

  const DAY_INDEX: Record<DayOfWeek, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const flashSaved = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGoalsSavedNotification(true);
    setTimeout(() => setGoalsSavedNotification(false), 2500);
  };
  const saveDays = (keys: DayOfWeek[], goal: DayGoal) =>
    Promise.all(keys.map(k => SyncService.syncMacroGoals(DAY_INDEX[k], goal.calories, goal.proteinG, goal.carbsG, goal.fatG)))
      .then(flashSaved)
      .catch(fail('Could not save targets'));

  const handleCopyGoals = (target: 'weekdays' | 'weekend' | 'all') => {
    const goal = dayGoals[selectedDay];
    const keys = (target === 'weekdays' ? ['mon', 'tue', 'wed', 'thu', 'fri'] : target === 'weekend' ? ['sat', 'sun'] : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) as DayOfWeek[];
    setDayGoals(prev => ({ ...prev, ...Object.fromEntries(keys.map(k => [k, { ...goal }])) }));
    saveDays(keys, goal);
  };

  const handleSaveCurrentDayGoals = () => saveDays([selectedDay], dayGoals[selectedDay]);

  const handleDeleteAccount = () =>
    Alert.alert('Delete account?', 'This permanently deletes all your data and your sign-in. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await SyncService.deleteAccountData();
            await user?.delete();
            router.replace('/auth/login' as any);
          } catch (e) { fail('Could not delete account')(e); }
        },
      },
    ]);

  // Macro Energy Calculations
  const currentGoal = dayGoals[selectedDay];
  const proteinCals = currentGoal.proteinG * 4;
  const carbsCals = currentGoal.carbsG * 4;
  const fatCals = currentGoal.fatG * 9;
  const calculatedTotalCals = proteinCals + carbsCals + fatCals;
  const proteinPct = calculatedTotalCals > 0 ? Math.round((proteinCals / calculatedTotalCals) * 100) : 0;
  const carbsPct = calculatedTotalCals > 0 ? Math.round((carbsCals / calculatedTotalCals) * 100) : 0;
  const fatPct = calculatedTotalCals > 0 ? Math.round((fatCals / calculatedTotalCals) * 100) : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.lg }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={[Typography.heroTitle, { marginBottom: Spacing.md }]}>Profile & Settings</Text>

        {/* User Summary Top Banner Card */}
        {loadError && <Text style={[Typography.caption, { color: Colors.bioRose, marginBottom: Spacing.md }]}>Couldn't load your data: {loadError}</Text>}
        <GlassCard style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(profile?.display_name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('') || '?'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={Typography.cardTitle}>{profile?.display_name ?? user?.primaryEmailAddress?.emailAddress ?? '--'}</Text>
              <Text style={Typography.caption}>
                {profile ? `Baseline: ${new Date(profile.sync_start_timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ' '}
              </Text>
            </View>
            <View style={styles.bioAgePill}>
              <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700' }]}>
                BIO AGE: {bodyAgeFor(profile, vitals).b?.bodyAge.toFixed(1) ?? '--'}
              </Text>
            </View>
          </View>

          <View style={styles.biometricsRow}>
            <View style={styles.biometricItem}>
              <Text style={Typography.caption}>CHRONO AGE</Text>
              <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>
                {profile?.chronological_birthdate ? `${((Date.now() - new Date(profile.chronological_birthdate).getTime()) / 31557600000).toFixed(1)} yrs` : '--'}
              </Text>
            </View>
            <View style={styles.biometricItem}>
              <Text style={Typography.caption}>WEIGHT</Text>
              <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>
                {vitals?.scale_weight_kg
                  ? `${Number(vitals.scale_weight_kg).toFixed(1)} kg`
                  : profile?.weight_kg
                  ? `${Number(profile.weight_kg).toFixed(1)} kg`
                  : '--'}
              </Text>
            </View>
            <View style={styles.biometricItem}>
              <Text style={Typography.caption}>HEIGHT</Text>
              <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>{profile?.height_cm ? `${Number(profile.height_cm)} cm` : '--'}</Text>
            </View>
            <View style={styles.biometricItem}>
              <Text style={Typography.caption}>RESTING HR</Text>
              <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>{vitals?.resting_heart_rate ? `${vitals.resting_heart_rate} bpm` : '--'}</Text>
            </View>
          </View>

          <View style={styles.biometricsRow}>
            {waistDraft === null ? (
              <Pressable style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => setWaistDraft(profile?.waist_cm ? String(Number(profile.waist_cm)) : '')}>
                <View>
                  <Text style={Typography.caption}>WAIST</Text>
                  <Text style={Typography.caption}>Needed for VO₂max and body age</Text>
                </View>
                <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>{profile?.waist_cm ? `${Number(profile.waist_cm)} cm` : 'Add'}  ›</Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <TextInput
                  style={styles.waistInput}
                  value={waistDraft}
                  onChangeText={setWaistDraft}
                  keyboardType="decimal-pad"
                  placeholder="Waist in cm, e.g. 82"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                />
                <Pressable hitSlop={8} onPress={saveWaist}><Text style={{ color: Colors.bioGreen, fontWeight: '700' }}>Save</Text></Pressable>
                <Pressable hitSlop={8} onPress={() => setWaistDraft(null)}><Text style={{ color: Colors.textMuted, fontWeight: '600' }}>Cancel</Text></Pressable>
              </View>
            )}
          </View>
        </GlassCard>

        {/* Day-of-Week Macro Goals Configuration Matrix */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Day-of-Week Macro Targets</Text>
          <Text style={Typography.caption}>Configure custom calories and gram goals for each day</Text>
        </View>

        <GlassCard style={{ marginBottom: Spacing.xl }}>
          {/* Day Selector Pills */}
          <View style={styles.dayPillsRow}>
            {days.map(d => {
              const isSelected = selectedDay === d.key;
              return (
                <Pressable
                  key={d.key}
                  style={[styles.dayPill, isSelected && styles.dayPillActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedDay(d.key);
                  }}
                >
                  <Text style={[styles.dayPillText, isSelected && { color: '#000', fontWeight: '700' }]}>
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Goal Input Matrix */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.xs }}>
            <Text style={[Typography.statLabel, { color: Colors.bioGreen }]}>
              {days.find(d => d.key === selectedDay)?.full.toUpperCase()} TARGETS
            </Text>
            <Text style={[Typography.caption, { color: Colors.textMuted }]}>
              Ratio: {proteinPct}% P / {carbsPct}% C / {fatPct}% F
            </Text>
          </View>

          <View style={styles.matrixRow}>
            <View style={styles.matrixCol}>
              <Text style={[Typography.caption, { color: Colors.textPure }]}>CALORIE BUDGET</Text>
              <TextInput
                style={styles.matrixInput}
                keyboardType="numeric"
                value={String(currentGoal.calories)}
                onChangeText={v => updateGoalField('calories', v)}
              />
            </View>
            <View style={styles.matrixCol}>
              <Text style={[Typography.caption, { color: Colors.bioGreen }]}>PROTEIN (GRAMS)</Text>
              <TextInput
                style={styles.matrixInput}
                keyboardType="numeric"
                value={String(currentGoal.proteinG)}
                onChangeText={v => updateGoalField('proteinG', v)}
              />
            </View>
          </View>

          <View style={[styles.matrixRow, { marginTop: Spacing.xs }]}>
            <View style={styles.matrixCol}>
              <Text style={[Typography.caption, { color: Colors.bioAmber }]}>CARBS (GRAMS)</Text>
              <TextInput
                style={styles.matrixInput}
                keyboardType="numeric"
                value={String(currentGoal.carbsG)}
                onChangeText={v => updateGoalField('carbsG', v)}
              />
            </View>
            <View style={styles.matrixCol}>
              <Text style={[Typography.caption, { color: Colors.bioRose }]}>FAT (GRAMS)</Text>
              <TextInput
                style={styles.matrixInput}
                keyboardType="numeric"
                value={String(currentGoal.fatG)}
                onChangeText={v => updateGoalField('fatG', v)}
              />
            </View>
          </View>

          {/* Macro Sum Energy Bar */}
          <View style={styles.macroSplitBar}>
            <View style={[styles.macroSplitSeg, { flex: Math.max(1, proteinPct), backgroundColor: Colors.bioGreen }]} />
            <View style={[styles.macroSplitSeg, { flex: Math.max(1, carbsPct), backgroundColor: Colors.bioAmber }]} />
            <View style={[styles.macroSplitSeg, { flex: Math.max(1, fatPct), backgroundColor: Colors.bioRose }]} />
          </View>

          {/* Quick Copy Presets */}
          <Text style={[Typography.statLabel, { marginTop: Spacing.md, marginBottom: 4 }]}>QUICK PRESETS & BATCH ACTIONS</Text>
          <View style={styles.presetButtonsRow}>
            <Pressable style={styles.presetBtn} onPress={() => handleCopyGoals('weekdays')}>
              <Text style={styles.presetBtnText}>Apply to Mon–Fri</Text>
            </Pressable>
            <Pressable style={styles.presetBtn} onPress={() => handleCopyGoals('weekend')}>
              <Text style={styles.presetBtnText}>Apply to Sat–Sun</Text>
            </Pressable>
            <Pressable style={styles.presetBtn} onPress={() => handleCopyGoals('all')}>
              <Text style={styles.presetBtnText}>Apply to All 7 Days</Text>
            </Pressable>
          </View>

          {/* Save Confirmation Button */}
          <Pressable style={styles.saveGoalBtn} onPress={handleSaveCurrentDayGoals}>
            <Text style={styles.saveGoalBtnText}>
              {goalsSavedNotification ? '✓ Targets Saved Successfully' : `Save ${days.find(d => d.key === selectedDay)?.label} Goals`}
            </Text>
          </Pressable>
        </GlassCard>

        {/* Nutrition Library: Foods, Recipes & Meals */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Nutrition Library</Text>
          <Text style={Typography.caption}>Manage custom foods, multi-serving recipes & meal combos</Text>
        </View>

        <GlassCard style={{ marginBottom: Spacing.xl }}>
          {/* Library Segmented Tabs */}
          <View style={styles.libTabsRow}>
            <Pressable
              style={[styles.libTab, activeLibTab === 'foods' && styles.libTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveLibTab('foods');
              }}
            >
              <Text style={[styles.libTabText, activeLibTab === 'foods' && styles.libTabTextActive]}>
                Custom Foods ({customFoods.length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.libTab, activeLibTab === 'recipes' && styles.libTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveLibTab('recipes');
              }}
            >
              <Text style={[styles.libTabText, activeLibTab === 'recipes' && styles.libTabTextActive]}>
                Recipes ({customRecipes.length})
              </Text>
            </Pressable>

          </View>

          {/* Tab 1: Custom Foods */}
          {activeLibTab === 'foods' && (
            <View style={{ marginTop: Spacing.md }}>
              <View style={styles.libActionHeader}>
                <Text style={Typography.statLabel}>SHARED FOODS</Text>
                <Pressable
                  style={styles.addLibBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowAddFoodModal(true);
                  }}
                >
                  <Text style={styles.addLibBtnText}>+ Add Food</Text>
                </Pressable>
              </View>

              {customFoods.map(food => (
                <GlassCard key={food.id} style={styles.libItemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.bodyText, { fontWeight: '700' }]}>{food.name}</Text>
                    <Text style={Typography.caption}>{food.servingSize} • {food.brand || 'Custom'}</Text>
                    <View style={styles.itemMacroRow}>
                      <Text style={[Typography.caption, { color: Colors.bioGreen }]}>P: {food.proteinG}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioAmber }]}>C: {food.carbsG}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioRose }]}>F: {food.fatG}g</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <Text style={[Typography.bodyMono, { color: Colors.textPure, fontWeight: '700' }]}>
                      {food.calories} kcal
                    </Text>
                    {food.mine ? (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setCustomFoods(prev => prev.filter(f => f.id !== food.id));
                          SyncService.deleteCustomFood(food.id).catch(fail('Could not delete'));
                        }}
                        hitSlop={10}
                      >
                        <Text style={{ color: Colors.bioRose, fontSize: 12, marginTop: 4 }}>Delete</Text>
                      </Pressable>
                    ) : (
                      <Pressable hitSlop={10} onPress={() => report('food', food.id, () => setCustomFoods(prev => prev.filter(f => f.id !== food.id)))}>
                        <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 4 }}>Report</Text>
                      </Pressable>
                    )}
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {/* Tab 2: Custom Recipes */}
          {activeLibTab === 'recipes' && (
            <View style={{ marginTop: Spacing.md }}>
              <View style={styles.libActionHeader}>
                <Text style={Typography.statLabel}>SHARED RECIPES</Text>
                <Pressable
                  style={styles.addLibBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowAddRecipeModal(true);
                  }}
                >
                  <Text style={styles.addLibBtnText}>+ Create Recipe</Text>
                </Pressable>
              </View>

              {customRecipes.map(recipe => (
                <GlassCard key={recipe.id} style={styles.libItemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.bodyText, { fontWeight: '700' }]}>{recipe.name}</Text>
                    <Text style={Typography.caption}>
                      by {recipe.author ?? 'Unknown'} • {recipe.servingsCount} servings • {recipe.ingredients.length} ingredients
                    </Text>
                    <View style={styles.itemMacroRow}>
                      <Text style={[Typography.caption, { color: Colors.bioGreen }]}>P: {recipe.perServingProteinG}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioAmber }]}>C: {recipe.perServingCarbsG}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioRose }]}>F: {recipe.perServingFatG}g</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <Text style={[Typography.bodyMono, { color: Colors.bioGreen, fontWeight: '700' }]}>
                      {recipe.perServingCalories} <Text style={{ fontSize: 11, color: Colors.textMuted }}>kcal/serv</Text>
                    </Text>
                    {recipe.mine ? (
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setCustomRecipes(prev => prev.filter(r => r.id !== recipe.id));
                          SyncService.deleteCustomRecipe(recipe.id).catch(fail('Could not delete'));
                        }}
                        hitSlop={10}
                      >
                        <Text style={{ color: Colors.bioRose, fontSize: 12, marginTop: 4 }}>Delete</Text>
                      </Pressable>
                    ) : (
                      <Pressable hitSlop={10} onPress={() => report('recipe', recipe.id, () => setCustomRecipes(prev => prev.filter(r => r.id !== recipe.id)))}>
                        <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 4 }}>Report</Text>
                      </Pressable>
                    )}
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

        </GlassCard>

        {/* Water Reminder Window */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Water Reminders</Text>
          <Text style={Typography.caption}>Choose the hours you want hydration reminders between</Text>
        </View>

        <GlassCard style={{ marginBottom: Spacing.xl }}>
          <View style={styles.timeRow}>
            <Pressable style={styles.timeChip} onPress={() => editReminderTime('start')}>
              <Text style={styles.timeChipLabel}>FROM</Text>
              <Text style={styles.timeChipValue}>{fmtMin(reminderStart)}</Text>
            </Pressable>
            <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
            <Pressable style={styles.timeChip} onPress={() => editReminderTime('end')}>
              <Text style={styles.timeChipLabel}>TO</Text>
              <Text style={styles.timeChipValue}>{fmtMin(reminderEnd)}</Text>
            </Pressable>
          </View>
          <Text style={[Typography.caption, { marginTop: Spacing.sm, color: Colors.textMuted }]}>
            Turn reminders on or off, and set the interval, from the Water tab.
          </Text>
        </GlassCard>

        {/* Health data sources: connection management lives on its own screens */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Data Sources</Text>
          <Text style={Typography.caption}>Apple Health, Health Connect and Google Health</Text>
        </View>

        <GlassCard style={{ marginBottom: Spacing.xl }}>
          <Pressable style={styles.toggleRow} onPress={() => router.push('/data-sources' as any)}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.bodyText, { fontWeight: '700' }]}>Manage data sources</Text>
              <Text style={Typography.caption}>Connect, sync and choose which source wins per metric</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        </GlassCard>

        <GlassCard style={{ marginBottom: Spacing.xl }}>
          <Text style={[Typography.bodyText, { fontWeight: '700' }]}>Workout priority</Text>
          <Text style={Typography.caption}>When two sources record the same workout, the one ranked first is kept.</Text>
          <SourceOrder metric="workouts" state={sourcePrefs} />
        </GlassCard>


        {/* Smart Scale Connectors */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Smart Scale Connectors</Text>
          <Text style={Typography.caption}>Auto-sync weights & bioimpedance metrics</Text>
        </View>

        <GlassCard style={{ marginBottom: Spacing.xl }}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={[Typography.bodyText, { fontWeight: '700' }]}>Hume Health Scale</Text>
              <Text style={Typography.caption}>Auto-sync weight, body fat %, muscle mass</Text>
            </View>
            <Switch
              value={wearables.humeScaleConnected}
              onValueChange={v => saveWearables({ humeScaleConnected: v })}
              trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
            />
          </View>

          <View style={[styles.toggleRow, { marginTop: Spacing.md }]}>
            <View>
              <Text style={[Typography.bodyText, { fontWeight: '700' }]}>FITTR Smart Scale</Text>
              <Text style={Typography.caption}>Bluetooth bioimpedance sync</Text>
            </View>
            <Switch
              value={wearables.fittrConnected}
              onValueChange={v => saveWearables({ fittrConnected: v })}
              trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
            />
          </View>

          <View style={[styles.toggleRow, { marginTop: Spacing.md }]}>
            <View>
              <Text style={[Typography.bodyText, { fontWeight: '700' }]}>Fitelo Scale & Coach</Text>
              <Text style={Typography.caption}>Webhook weight ingestion</Text>
            </View>
            <Switch
              value={wearables.fiteloConnected}
              onValueChange={v => saveWearables({ fiteloConnected: v })}
              trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
            />
          </View>
        </GlassCard>

        {/* Security & Biometric Lock */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Security & Privacy Shield</Text>
          <Text style={Typography.caption}>Biometric authentication and app switcher masking</Text>
        </View>

        <GlassCard style={{ marginBottom: Spacing.xl }}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="finger-print" size={16} color={Colors.hydration} />
                <Text style={[Typography.bodyText, { fontWeight: '700' }]}>Biometric Vault Lock</Text>
              </View>
              <Text style={Typography.caption}>Require Face ID / Touch ID when opening or resuming</Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: Colors.surfaceHighlight, true: Colors.hydration }}
            />
          </View>
        </GlassCard>

        {/* Ingestion Baseline Window Info */}
        <GlassCard style={styles.baselineCard}>
          <Text style={[Typography.statLabel, { color: Colors.bioGreen }]}>INGESTION BASELINE WINDOW</Text>
          <Text style={[Typography.bodyText, { marginTop: 4 }]}>
            Historical health data prior to your first login date{profile ? ` (${new Date(profile.sync_start_timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })})` : ''} is strictly discarded, keeping your
            trends completely clean from past device errors.
          </Text>
        </GlassCard>

        {/* Sign Out Action */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={16} color={Colors.warning} />
          <Text style={styles.signOutBtnText}>Sign Out of Athlete Vault</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.signOutBtn, { marginTop: Spacing.sm }]} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={16} color={Colors.bioRose} />
          <Text style={[styles.signOutBtnText, { color: Colors.bioRose }]}>Delete account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Auxiliary Builder Modals */}
      <CustomFoodModal
        visible={showAddFoodModal}
        onClose={() => setShowAddFoodModal(false)}
        onFoodCreated={food => SyncService.createCustomFood(food).then(saved => setCustomFoods(prev => [saved, ...prev])).catch(fail('Could not save food'))}
      />
      <RecipeBuilderModal
        visible={showAddRecipeModal}
        onClose={() => setShowAddRecipeModal(false)}
        onRecipeSaved={r => SyncService.createCustomRecipe(r).then(saved => setCustomRecipes(prev => [saved, ...prev])).catch(fail('Could not save recipe'))}
      />

      <Sheet visible={reporting !== null} onClose={() => setReporting(null)} dim={0.6}>
        <Text style={Typography.cardTitle}>Report this item</Text>
        <Text style={[Typography.caption, { marginBottom: Spacing.md }]}>It is hidden from you now, and from everyone once several people report it.</Text>
        {REPORT_REASONS.map(([key, label]) => (
          <Pressable key={key} style={styles.reasonRow} onPress={() => sendReport(key)}>
            <Text style={Typography.bodyText}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        ))}
      </Sheet>

      {/* iOS reminder time picker (Android uses the native dialog via DateTimePickerAndroid) */}
      <Modal visible={editingTime !== null} transparent animationType="fade" onRequestClose={() => setEditingTime(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={Typography.cardTitle}>{editingTime === 'start' ? 'Reminders start at' : 'Reminders end at'}</Text>
            {editingTime && (
              <DateTimePicker
                value={minToDate(draftMin)}
                mode="time"
                display="spinner"
                themeVariant="dark"
                textColor={Colors.textPrimary}
                style={{ marginVertical: Spacing.md }}
                onValueChange={(_e, date) => setDraftMin(date.getHours() * 60 + date.getMinutes())}
              />
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setEditingTime(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalDoneBtn} onPress={confirmIosTime}>
                <Text style={styles.modalDoneText}>Done</Text>
              </Pressable>
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
  scrollContent: {
    padding: Spacing.xl,
    paddingTop: 54,
    paddingBottom: 110,
  },
  profileCard: {
    marginBottom: Spacing.xl,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.bioGreen,
    fontWeight: '700',
    fontSize: 16,
  },
  bioAgePill: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  biometricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderMachined,
  },
  biometricItem: {
    alignItems: 'center',
  },
  waistInput: {
    flex: 1,
    color: Colors.textPure,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
  },
  dayPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  dayPillActive: {
    backgroundColor: Colors.bioGreen,
    borderColor: Colors.bioGreen,
  },
  dayPillText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  matrixRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  matrixCol: {
    flex: 1,
  },
  matrixInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.sm,
    color: Colors.textPure,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    marginTop: 4,
  },
  macroSplitBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceHighlight,
  },
  macroSplitSeg: {
    height: '100%',
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: 4,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceHighlight,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  presetBtnText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  saveGoalBtn: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveGoalBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  libTabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 10,
    padding: 3,
  },
  libTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  libTabActive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  libTabText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  libTabTextActive: {
    color: Colors.bioGreen,
    fontWeight: '700',
  },
  libActionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  addLibBtn: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  addLibBtnText: {
    color: Colors.bioGreen,
    fontWeight: '700',
    fontSize: 12,
  },
  libItemCard: {
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
  mealCatBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  reasonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderMachined },
  timeChip: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    borderRadius: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  timeChipLabel: { fontSize: 9, letterSpacing: 1, color: Colors.textMuted },
  timeChipValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', padding: Spacing.xl },
  modalCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    borderRadius: Spacing.radiusCard,
    padding: Spacing.xl,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  modalCancelBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Spacing.radiusButton },
  modalCancelText: { color: Colors.textMuted, fontWeight: '600', fontSize: 13 },
  modalDoneBtn: { backgroundColor: Colors.hydration, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Spacing.radiusButton },
  modalDoneText: { color: '#000', fontWeight: '700', fontSize: 13 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  baselineCard: {
    backgroundColor: 'rgba(52, 211, 153, 0.04)',
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radiusButton,
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.25)',
  },
  signOutBtnText: {
    color: Colors.warning,
    fontWeight: '700',
    fontSize: 13,
  },
});

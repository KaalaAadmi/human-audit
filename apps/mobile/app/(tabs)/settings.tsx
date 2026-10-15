import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { CustomFoodModal } from '../../components/CustomFoodModal';
import { RecipeBuilderModal, CustomRecipe } from '../../components/RecipeBuilderModal';
import { MealTemplateModal, SavedMealTemplate } from '../../components/MealTemplateModal';
import { SearchFoodResult } from '../../services/nutritionService';

type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type LibraryTab = 'foods' | 'recipes' | 'meals';

interface DayGoal {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export default function SettingsScreen() {
  // Wearable Priority State
  const [priorities, setPriorities] = useState<string[]>([
    'Fitbit (Sense / Charge)',
    'Apple HealthKit (Watch Series / Ultra)',
    'Google Health Connect (Pixel Watch / Wear OS)',
  ]);

  // Day of Week Macro Goals State
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('mon');
  const [goalsSavedNotification, setGoalsSavedNotification] = useState(false);
  const [dayGoals, setDayGoals] = useState<Record<DayOfWeek, DayGoal>>({
    mon: { calories: 2500, proteinG: 210, carbsG: 260, fatG: 65 },
    tue: { calories: 2400, proteinG: 200, carbsG: 240, fatG: 65 },
    wed: { calories: 2500, proteinG: 210, carbsG: 260, fatG: 65 },
    thu: { calories: 2200, proteinG: 200, carbsG: 180, fatG: 70 }, // Rest / Low Carb day
    fri: { calories: 2600, proteinG: 210, carbsG: 280, fatG: 65 },
    sat: { calories: 2600, proteinG: 210, carbsG: 280, fatG: 65 },
    sun: { calories: 2200, proteinG: 200, carbsG: 180, fatG: 70 }, // Rest day
  });

  // Nutrition Library State
  const [activeLibTab, setActiveLibTab] = useState<LibraryTab>('foods');
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [showAddMealModal, setShowAddMealModal] = useState(false);

  // Custom Foods List
  const [customFoods, setCustomFoods] = useState<SearchFoodResult[]>([
    {
      id: 'cf_1',
      name: "Grandma's Grass-Fed Meatloaf",
      brand: 'Homemade',
      servingSize: '1 slice (120g)',
      servingGrams: 120,
      calories: 240,
      proteinG: 26,
      carbsG: 6,
      fatG: 12,
      source: 'custom',
    },
    {
      id: 'cf_2',
      name: 'High-Protein Banana Oat Muffin',
      brand: 'Home Bakery',
      servingSize: '1 muffin (85g)',
      servingGrams: 85,
      calories: 195,
      proteinG: 14,
      carbsG: 24,
      fatG: 4.5,
      source: 'custom',
    },
  ]);

  // Custom Recipes List
  const [customRecipes, setCustomRecipes] = useState<CustomRecipe[]>([
    {
      id: 'cr_1',
      name: 'Weekly Meal Prep Chicken Rice Bowl',
      servingsCount: 4,
      ingredients: [
        { id: 'i1', name: 'Chicken Breast', grams: 800, calories: 960, proteinG: 192, carbsG: 0, fatG: 19 },
        { id: 'i2', name: 'Jasmine Rice', grams: 400, calories: 1400, proteinG: 28, carbsG: 320, fatG: 4 },
        { id: 'i3', name: 'Avocado', grams: 200, calories: 320, proteinG: 4, carbsG: 17, fatG: 29 },
      ],
      perServingCalories: 670,
      perServingProteinG: 56,
      perServingCarbsG: 84.3,
      perServingFatG: 13,
      totalCalories: 2680,
      totalProteinG: 224,
      totalCarbsG: 337,
      totalFatG: 52,
    },
  ]);

  // Saved Meal Templates List
  const [savedMeals, setSavedMeals] = useState<SavedMealTemplate[]>([
    {
      id: 'sm_1',
      name: 'Post-Workout Fuel Combo',
      category: 'lunch',
      description: '200g Grilled Chicken + 1.5 cup Rice + 1 Hass Avocado',
      calories: 698,
      proteinG: 70,
      carbsG: 76,
      fatG: 15,
    },
    {
      id: 'sm_2',
      name: 'Anabolic Breakfast Stacker',
      category: 'breakfast',
      description: '4 Whole Eggs + 2 Slices Sourdough + 1 Scoop Whey Shake',
      calories: 580,
      proteinG: 58,
      carbsG: 38,
      fatG: 22,
    },
  ]);

  // Smart Scale Toggles
  const [scaleHume, setScaleHume] = useState(true);
  const [scaleFittr, setScaleFittr] = useState(false);
  const [scaleFitelo, setScaleFitelo] = useState(false);

  const days: { key: DayOfWeek; label: string; full: string }[] = [
    { key: 'mon', label: 'Mon', full: 'Monday' },
    { key: 'tue', label: 'Tue', full: 'Tuesday' },
    { key: 'wed', label: 'Wed', full: 'Wednesday' },
    { key: 'thu', label: 'Thu', full: 'Thursday' },
    { key: 'fri', label: 'Fri', full: 'Friday' },
    { key: 'sat', label: 'Sat', full: 'Saturday' },
    { key: 'sun', label: 'Sun', full: 'Sunday' },
  ];

  const handleMovePriorityUp = (index: number) => {
    if (index === 0) return;
    Haptics.selectionAsync();
    const copy = [...priorities];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    setPriorities(copy);
  };

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

  const handleCopyGoals = (target: 'weekdays' | 'weekend' | 'all') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const sourceGoal = dayGoals[selectedDay];
    setDayGoals(prev => {
      const next = { ...prev };
      if (target === 'weekdays' || target === 'all') {
        next.mon = { ...sourceGoal };
        next.tue = { ...sourceGoal };
        next.wed = { ...sourceGoal };
        next.thu = { ...sourceGoal };
        next.fri = { ...sourceGoal };
      }
      if (target === 'weekend' || target === 'all') {
        next.sat = { ...sourceGoal };
        next.sun = { ...sourceGoal };
      }
      return next;
    });
    setGoalsSavedNotification(true);
    setTimeout(() => setGoalsSavedNotification(false), 2500);
  };

  const handleSaveCurrentDayGoals = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGoalsSavedNotification(true);
    setTimeout(() => setGoalsSavedNotification(false), 2500);
  };

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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={[Typography.heroTitle, { marginBottom: Spacing.md }]}>Profile & Settings</Text>

        {/* User Summary Top Banner Card */}
        <GlassCard style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AB</Text>
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={Typography.cardTitle}>Arnav Bhattacharya</Text>
              <Text style={Typography.caption}>Athlete Tier • Baseline: May 18, 2025</Text>
            </View>
            <View style={styles.bioAgePill}>
              <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700' }]}>BIO AGE: 24.8</Text>
            </View>
          </View>

          <View style={styles.biometricsRow}>
            <View style={styles.biometricItem}>
              <Text style={Typography.caption}>CHRONO AGE</Text>
              <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>28.0 yrs</Text>
            </View>
            <View style={styles.biometricItem}>
              <Text style={Typography.caption}>WEIGHT (HUME)</Text>
              <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>76.4 kg</Text>
            </View>
            <View style={styles.biometricItem}>
              <Text style={Typography.caption}>BODY FAT</Text>
              <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>13.8%</Text>
            </View>
            <View style={styles.biometricItem}>
              <Text style={Typography.caption}>RESTING HR</Text>
              <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>52 bpm</Text>
            </View>
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

            <Pressable
              style={[styles.libTab, activeLibTab === 'meals' && styles.libTabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveLibTab('meals');
              }}
            >
              <Text style={[styles.libTabText, activeLibTab === 'meals' && styles.libTabTextActive]}>
                Saved Meals ({savedMeals.length})
              </Text>
            </Pressable>
          </View>

          {/* Tab 1: Custom Foods */}
          {activeLibTab === 'foods' && (
            <View style={{ marginTop: Spacing.md }}>
              <View style={styles.libActionHeader}>
                <Text style={Typography.statLabel}>USER-DEFINED FOODS</Text>
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
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCustomFoods(prev => prev.filter(f => f.id !== food.id));
                      }}
                      hitSlop={10}
                    >
                      <Text style={{ color: Colors.bioRose, fontSize: 12, marginTop: 4 }}>Delete</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {/* Tab 2: Custom Recipes */}
          {activeLibTab === 'recipes' && (
            <View style={{ marginTop: Spacing.md }}>
              <View style={styles.libActionHeader}>
                <Text style={Typography.statLabel}>MULTI-SERVING RECIPES</Text>
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
                      {recipe.servingsCount} servings • {recipe.ingredients.length} ingredients
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
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCustomRecipes(prev => prev.filter(r => r.id !== recipe.id));
                      }}
                      hitSlop={10}
                    >
                      <Text style={{ color: Colors.bioRose, fontSize: 12, marginTop: 4 }}>Delete</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {/* Tab 3: Saved Meal Templates */}
          {activeLibTab === 'meals' && (
            <View style={{ marginTop: Spacing.md }}>
              <View style={styles.libActionHeader}>
                <Text style={Typography.statLabel}>SAVED MEAL COMBOS</Text>
                <Pressable
                  style={styles.addLibBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowAddMealModal(true);
                  }}
                >
                  <Text style={styles.addLibBtnText}>+ Save Meal</Text>
                </Pressable>
              </View>

              {savedMeals.map(meal => (
                <GlassCard key={meal.id} style={styles.libItemCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[Typography.bodyText, { fontWeight: '700' }]}>{meal.name}</Text>
                      <View style={styles.mealCatBadge}>
                        <Text style={[Typography.caption, { fontSize: 10, color: Colors.bioGreen, fontWeight: '700' }]}>
                          {meal.category.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={[Typography.caption, { marginTop: 2 }]} numberOfLines={1}>{meal.description}</Text>
                    <View style={styles.itemMacroRow}>
                      <Text style={[Typography.caption, { color: Colors.bioGreen }]}>P: {meal.proteinG}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioAmber }]}>C: {meal.carbsG}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioRose }]}>F: {meal.fatG}g</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <Text style={[Typography.bodyMono, { color: Colors.textPure, fontWeight: '700' }]}>
                      {meal.calories} kcal
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSavedMeals(prev => prev.filter(m => m.id !== meal.id));
                      }}
                      hitSlop={10}
                    >
                      <Text style={{ color: Colors.bioRose, fontSize: 12, marginTop: 4 }}>Delete</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </GlassCard>

        {/* Wearable Deduplication Priority Engine */}
        <View style={styles.sectionHeader}>
          <Text style={Typography.cardTitle}>Wearable Deduplication Priority</Text>
          <Text style={Typography.caption}>Hierarchy when wearing multiple devices simultaneously</Text>
        </View>

        <GlassCard style={{ marginBottom: Spacing.xl }}>
          {priorities.map((item, index) => (
            <View key={item} style={styles.priorityRow}>
              <View style={styles.priorityNumberBadge}>
                <Text style={styles.priorityNumberText}>{index + 1}</Text>
              </View>
              <Text style={[Typography.bodyText, { flex: 1, fontWeight: '700' }]}>{item}</Text>
              {index > 0 && (
                <Pressable style={styles.moveBtn} onPress={() => handleMovePriorityUp(index)}>
                  <Text style={styles.moveBtnText}>▲ Up</Text>
                </Pressable>
              )}
            </View>
          ))}
          <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: Spacing.sm }]}>
            * Workouts with $\ge 50\%$ time overlap are resolved in favor of the higher-ranked device.
          </Text>
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
              value={scaleHume}
              onValueChange={v => {
                Haptics.selectionAsync();
                setScaleHume(v);
              }}
              trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
            />
          </View>

          <View style={[styles.toggleRow, { marginTop: Spacing.md }]}>
            <View>
              <Text style={[Typography.bodyText, { fontWeight: '700' }]}>FITTR Smart Scale</Text>
              <Text style={Typography.caption}>Bluetooth bioimpedance sync</Text>
            </View>
            <Switch
              value={scaleFittr}
              onValueChange={v => {
                Haptics.selectionAsync();
                setScaleFittr(v);
              }}
              trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
            />
          </View>

          <View style={[styles.toggleRow, { marginTop: Spacing.md }]}>
            <View>
              <Text style={[Typography.bodyText, { fontWeight: '700' }]}>Fitelo Scale & Coach</Text>
              <Text style={Typography.caption}>Webhook weight ingestion</Text>
            </View>
            <Switch
              value={scaleFitelo}
              onValueChange={v => {
                Haptics.selectionAsync();
                setScaleFitelo(v);
              }}
              trackColor={{ false: Colors.surfaceHighlight, true: Colors.bioGreen }}
            />
          </View>
        </GlassCard>

        {/* Ingestion Baseline Window Info */}
        <GlassCard style={styles.baselineCard}>
          <Text style={[Typography.statLabel, { color: Colors.bioGreen }]}>INGESTION BASELINE WINDOW</Text>
          <Text style={[Typography.bodyText, { marginTop: 4 }]}>
            Historical health data prior to your first login date (May 18, 2025) is strictly discarded, keeping your
            trends completely clean from past device errors.
          </Text>
        </GlassCard>
      </ScrollView>

      {/* Auxiliary Builder Modals */}
      <CustomFoodModal
        visible={showAddFoodModal}
        onClose={() => setShowAddFoodModal(false)}
        onFoodCreated={newFood => setCustomFoods(prev => [newFood, ...prev])}
      />
      <RecipeBuilderModal
        visible={showAddRecipeModal}
        onClose={() => setShowAddRecipeModal(false)}
        onRecipeSaved={newRecipe => setCustomRecipes(prev => [newRecipe, ...prev])}
      />
      <MealTemplateModal
        visible={showAddMealModal}
        onClose={() => setShowAddMealModal(false)}
        onMealSaved={newMeal => setSavedMeals(prev => [newMeal, ...prev])}
      />
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
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderMachined,
    gap: Spacing.sm,
  },
  priorityNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityNumberText: {
    color: Colors.bioGreen,
    fontWeight: '700',
    fontSize: 12,
  },
  moveBtn: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  moveBtnText: {
    color: Colors.textPure,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  baselineCard: {
    backgroundColor: 'rgba(52, 211, 153, 0.04)',
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
});

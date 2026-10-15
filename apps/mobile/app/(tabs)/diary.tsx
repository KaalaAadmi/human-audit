import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { GlassCard } from '../../components/GlassCard';
import { NutritionService, FoodLogItem, SearchFoodResult } from '../../services/nutritionService';
import { BarcodeScannerModal } from '../../components/BarcodeScannerModal';
import { VoiceLogModal } from '../../components/VoiceLogModal';
import { PhotoMealModal } from '../../components/PhotoMealModal';
import { CustomFoodModal } from '../../components/CustomFoodModal';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function DiaryScreen() {
  // Day-of-week custom targets (Mon-Sun customizer)
  const targetCalories = 2400;
  const targetProteinG = 200;
  const targetCarbsG = 240;
  const targetFatG = 65;
  const exerciseBurn = 420; // Synced from wearable workout engine

  // State: Logged items
  const [foodLogs, setFoodLogs] = useState<FoodLogItem[]>([
    {
      id: 'log_1',
      name: 'Whole Large Eggs (Scrambled)',
      brand: 'Generic',
      mealType: 'breakfast',
      servingSize: '3 large (150g)',
      servingGrams: 150,
      servingsCount: 1,
      calories: 216,
      proteinG: 18.9,
      carbsG: 1.2,
      fatG: 14.4,
      source: 'usda',
      loggedAt: '08:15 AM',
    },
    {
      id: 'log_2',
      name: 'Sourdough Toast with Grass-Fed Butter',
      mealType: 'breakfast',
      servingSize: '2 slices (70g)',
      servingGrams: 70,
      servingsCount: 1,
      calories: 230,
      proteinG: 8,
      carbsG: 34,
      fatG: 7,
      source: 'custom',
      loggedAt: '08:18 AM',
    },
    {
      id: 'log_3',
      name: 'Grilled Chicken Breast',
      brand: 'Generic',
      mealType: 'lunch',
      servingSize: '200g',
      servingGrams: 200,
      servingsCount: 1,
      calories: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7.2,
      source: 'usda',
      loggedAt: '01:05 PM',
    },
    {
      id: 'log_4',
      name: 'Cooked Jasmine White Rice',
      mealType: 'lunch',
      servingSize: '1.5 cups (237g)',
      servingGrams: 237,
      servingsCount: 1,
      calories: 308,
      proteinG: 6.3,
      carbsG: 67.5,
      fatG: 0.6,
      source: 'usda',
      loggedAt: '01:06 PM',
    },
  ]);

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

  // Computed Totals
  const totalFoodCalories = foodLogs.reduce((acc, item) => acc + item.calories, 0);
  const remainingCalories = targetCalories - totalFoodCalories + exerciseBurn;
  const totalProteinG = Math.round(foodLogs.reduce((acc, item) => acc + item.proteinG, 0));
  const totalCarbsG = Math.round(foodLogs.reduce((acc, item) => acc + item.carbsG, 0));
  const totalFatG = Math.round(foodLogs.reduce((acc, item) => acc + item.fatG, 0));

  // Handlers
  const handleOpenAddModal = (meal: MealType) => {
    setActiveMealType(meal);
    setShowLogSheet(true);
    Haptics.selectionAsync();
  };

  const handleAddFoodItem = (food: SearchFoodResult, meal: MealType = activeMealType) => {
    const newLog: FoodLogItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: food.name,
      brand: food.brand,
      mealType: meal,
      servingSize: food.servingSize,
      servingGrams: food.servingGrams,
      servingsCount: 1,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      source: food.source as any,
      loggedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setFoodLogs(prev => [newLog, ...prev]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAddMultipleFoods = (items: SearchFoodResult[]) => {
    items.forEach(item => handleAddFoodItem(item));
  };

  const handleDeleteFood = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFoodLogs(prev => prev.filter(item => item.id !== id));
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await NutritionService.searchFoods(text);
    setSearchResults(results);
    setIsSearching(false);
  };

  const meals: { key: MealType; label: string; icon: string }[] = [
    { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { key: 'lunch', label: 'Lunch', icon: '☀️' },
    { key: 'dinner', label: 'Dinner', icon: '🌙' },
    { key: 'snack', label: 'Snacks', icon: '🍎' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={Typography.heroTitle}>Food Diary</Text>
          <View style={styles.todayPill}>
            <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700' }]}>TODAY</Text>
          </View>
        </View>

        {/* Calorie Budget Gauge Card */}
        <GlassCard style={styles.calorieCard}>
          <View style={styles.calorieTopRow}>
            <View>
              <Text style={Typography.statLabel}>REMAINING CALORIE BUDGET</Text>
              <Text style={[Typography.displayLarge, { color: Colors.bioGreen, marginVertical: 4 }]}>
                {remainingCalories}
                <Text style={[Typography.bodyMono, { fontSize: 16, color: Colors.textMuted }]}> kcal</Text>
              </Text>
            </View>
            <View style={styles.calEquationBadge}>
              <Text style={[Typography.caption, { color: Colors.textPure }]}>
                {targetCalories} <Text style={{ color: Colors.textMuted }}>Goal</Text> - {totalFoodCalories}{' '}
                <Text style={{ color: Colors.textMuted }}>Food</Text> + {exerciseBurn}{' '}
                <Text style={{ color: Colors.bioGreen }}>Burn</Text>
              </Text>
            </View>
          </View>

          {/* Macro Progress Bars */}
          <View style={styles.macroBarsContainer}>
            {/* Protein */}
            <View style={styles.macroBarCol}>
              <View style={styles.macroBarHeader}>
                <Text style={[Typography.caption, { color: Colors.bioGreen, fontWeight: '700' }]}>PROTEIN</Text>
                <Text style={[Typography.caption, { color: Colors.textPure }]}>
                  {totalProteinG}/{targetProteinG}g
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.round((totalProteinG / targetProteinG) * 100))}%`,
                      backgroundColor: Colors.bioGreen,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Carbs */}
            <View style={styles.macroBarCol}>
              <View style={styles.macroBarHeader}>
                <Text style={[Typography.caption, { color: Colors.bioAmber, fontWeight: '700' }]}>CARBS</Text>
                <Text style={[Typography.caption, { color: Colors.textPure }]}>
                  {totalCarbsG}/{targetCarbsG}g
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.round((totalCarbsG / targetCarbsG) * 100))}%`,
                      backgroundColor: Colors.bioAmber,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Fat */}
            <View style={styles.macroBarCol}>
              <View style={styles.macroBarHeader}>
                <Text style={[Typography.caption, { color: Colors.bioRose, fontWeight: '700' }]}>FAT</Text>
                <Text style={[Typography.caption, { color: Colors.textPure }]}>
                  {totalFatG}/{targetFatG}g
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.round((totalFatG / targetFatG) * 100))}%`,
                      backgroundColor: Colors.bioRose,
                    },
                  ]}
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

          return (
            <View key={meal.key} style={styles.mealSection}>
              <View style={styles.mealHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                  <Text style={{ fontSize: 18 }}>{meal.icon}</Text>
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

              {mealLogs.length === 0 ? (
                <Pressable style={styles.emptyMealBox} onPress={() => handleOpenAddModal(meal.key)}>
                  <Text style={[Typography.caption, { color: Colors.textMuted }]}>
                    No food logged for {meal.label.toLowerCase()} yet. Tap to add.
                  </Text>
                </Pressable>
              ) : (
                mealLogs.map(item => (
                  <GlassCard key={item.id} style={styles.foodItemCard}>
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
                      <Pressable onPress={() => handleDeleteFood(item.id)} hitSlop={10}>
                        <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: Spacing.xs }}>Delete</Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                ))
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
                <Text style={styles.sheetIcon}>🔍</Text>
                <Text style={styles.sheetLabel}>Search Foods</Text>
                <Text style={styles.sheetSub}>USDA + Open Food</Text>
              </Pressable>

              <Pressable
                style={styles.sheetOption}
                onPress={() => {
                  setShowLogSheet(false);
                  setShowBarcodeModal(true);
                }}
              >
                <Text style={styles.sheetIcon}>📷</Text>
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
                <Text style={styles.sheetIcon}>🎙️</Text>
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
                <Text style={styles.sheetIcon}>✨</Text>
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
              <Pressable onPress={() => setShowSearchModal(false)} style={styles.closeSearchBtn}>
                <Text style={{ color: Colors.textMuted }}>Close</Text>
              </Pressable>
            </View>

            {isSearching ? (
              <ActivityIndicator size="small" color={Colors.bioGreen} style={{ marginTop: Spacing.xl }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.searchResultRow}
                    onPress={() => {
                      handleAddFoodItem(item);
                      setShowSearchModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.bodyText, { fontWeight: '700' }]}>{item.name}</Text>
                      <Text style={Typography.caption}>
                        {item.servingSize} • {item.brand || (item.source === 'usda' ? 'USDA Generic' : 'Branded')}
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
        onFoodCreated={handleAddFoodItem}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  todayPill: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  calorieCard: {
    marginBottom: Spacing.xl,
  },
  calorieTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  calEquationBadge: {
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  macroBarsContainer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  macroBarCol: {
    gap: 4,
  },
  macroBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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
});

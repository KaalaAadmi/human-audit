import React, { useState } from 'react';
import {
  StyleSheet, Text, View, Modal, Pressable, TextInput,
  ScrollView, FlatList, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from './GlassCard';
import { NutritionService, SearchFoodResult } from '../services/nutritionService';

export interface RecipeIngredient {
  id: string;
  name: string;
  grams: number;       // total grams logged (servings × servingGrams)
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface CustomRecipe {
  id: string;
  name: string;
  servingsCount: number;
  ingredients: RecipeIngredient[];
  perServingCalories: number;
  perServingProteinG: number;
  perServingCarbsG: number;
  perServingFatG: number;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  author?: string; // recipes are shared; set by the server
  mine?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onRecipeSaved: (recipe: CustomRecipe) => void;
}

export function RecipeBuilderModal({ visible, onClose, onRecipeSaved }: Props) {
  const [recipeName, setRecipeName] = useState('');
  const [servingsCount, setServingsCount] = useState('4');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

  // Ingredient search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchFoodResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  // Pending ingredient: selected food + quantity before confirming
  const [pendingIng, setPendingIng] = useState<SearchFoodResult | null>(null);
  const [pendingServings, setPendingServings] = useState('1');

  // Computed totals
  const totalCals = ingredients.reduce((acc, i) => acc + i.calories, 0);
  const totalP = Number((ingredients.reduce((acc, i) => acc + i.proteinG, 0)).toFixed(1));
  const totalC = Number((ingredients.reduce((acc, i) => acc + i.carbsG, 0)).toFixed(1));
  const totalF = Number((ingredients.reduce((acc, i) => acc + i.fatG, 0)).toFixed(1));
  const servings = Math.max(1, parseInt(servingsCount, 10) || 1);
  const perServingCals = Math.round(totalCals / servings);
  const perServingP = Number((totalP / servings).toFixed(1));
  const perServingC = Number((totalC / servings).toFixed(1));
  const perServingF = Number((totalF / servings).toFixed(1));

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    setSearchNote(null);
    try {
      const { results, fallback } = await NutritionService.searchFoods(text);
      setSearchResults(results);
      if (fallback) setSearchNote('Showing USDA results (Open Food Facts had no match).');
    } catch (e) {
      setSearchResults([]);
      setSearchNote(`Search failed: ${(e as Error).message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const confirmIngredient = () => {
    if (!pendingIng) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const s = Math.max(0.25, parseFloat(pendingServings) || 1);
    const newIng: RecipeIngredient = {
      id: `ing_${Date.now()}`,
      name: pendingIng.name,
      grams: Math.round(pendingIng.servingGrams * s * 10) / 10,
      calories: Math.round(pendingIng.calories * s),
      proteinG: Math.round(pendingIng.proteinG * s * 10) / 10,
      carbsG: Math.round(pendingIng.carbsG * s * 10) / 10,
      fatG: Math.round(pendingIng.fatG * s * 10) / 10,
    };
    setIngredients(prev => [...prev, newIng]);
    setPendingIng(null);
    setPendingServings('1');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSaveRecipe = () => {
    if (!recipeName.trim() || ingredients.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRecipeSaved({
      id: `rec_${Date.now()}`,
      name: recipeName.trim(),
      servingsCount: servings,
      ingredients,
      perServingCalories: perServingCals,
      perServingProteinG: perServingP,
      perServingCarbsG: perServingC,
      perServingFatG: perServingF,
      totalCalories: totalCals,
      totalProteinG: totalP,
      totalCarbsG: totalC,
      totalFatG: totalF,
    });
    // Reset
    setRecipeName(''); setServingsCount('4'); setIngredients([]);
    setSearchQuery(''); setSearchResults([]); setPendingIng(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={Typography.cardTitle}>Recipe Builder</Text>
              <Text style={Typography.caption}>Search ingredients, set quantities</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Recipe name + servings */}
            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>RECIPE NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. High-Protein Chili"
              placeholderTextColor={Colors.textMuted}
              value={recipeName}
              onChangeText={setRecipeName}
            />
            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>NUMBER OF SERVINGS</Text>
            <TextInput
              style={styles.input}
              placeholder="4"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              value={servingsCount}
              onChangeText={setServingsCount}
            />

            {/* Per-serving summary */}
            <GlassCard style={styles.summaryCard}>
              <Text style={[Typography.statLabel, { color: Colors.bioGreen }]}>PER SERVING (1 OF {servings})</Text>
              <View style={styles.macroRow}>
                <View style={styles.macroCol}>
                  <Text style={Typography.caption}>Calories</Text>
                  <Text style={[Typography.bodyMono, { color: Colors.textPure, fontSize: 16 }]}>{perServingCals} kcal</Text>
                </View>
                <View style={styles.macroCol}>
                  <Text style={[Typography.caption, { color: Colors.bioGreen }]}>Protein</Text>
                  <Text style={[Typography.bodyMono, { color: Colors.bioGreen, fontSize: 16 }]}>{perServingP}g</Text>
                </View>
                <View style={styles.macroCol}>
                  <Text style={[Typography.caption, { color: Colors.bioAmber }]}>Carbs</Text>
                  <Text style={[Typography.bodyMono, { color: Colors.bioAmber, fontSize: 16 }]}>{perServingC}g</Text>
                </View>
                <View style={styles.macroCol}>
                  <Text style={[Typography.caption, { color: Colors.bioRose }]}>Fat</Text>
                  <Text style={[Typography.bodyMono, { color: Colors.bioRose, fontSize: 16 }]}>{perServingF}g</Text>
                </View>
              </View>
            </GlassCard>

            {/* --- Ingredient search / quantity step --- */}
            <View style={styles.ingHeader}>
              <Text style={Typography.cardTitle}>Ingredients ({ingredients.length})</Text>
            </View>

            {pendingIng ? (
              /* Step 2: set quantity */
              <GlassCard style={{ marginBottom: Spacing.md, borderColor: Colors.bioGreen }}>
                <Text style={[Typography.bodyText, { fontWeight: '700', marginBottom: 2 }]}>{pendingIng.name}</Text>
                <Text style={[Typography.caption, { color: Colors.textMuted, marginBottom: Spacing.sm }]}>
                  1 serving = {pendingIng.servingSize} • {pendingIng.calories} kcal
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
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
                {/* Live preview */}
                {(() => {
                  const s = Math.max(0.25, parseFloat(pendingServings) || 1);
                  return (
                    <View style={styles.previewRow}>
                      <Text style={[Typography.bodyMono, { color: Colors.bioGreen, fontWeight: '700' }]}>
                        {Math.round(pendingIng.calories * s)} kcal
                      </Text>
                      <Text style={[Typography.caption, { color: Colors.bioGreen }]}>P: {Math.round(pendingIng.proteinG * s * 10) / 10}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioAmber }]}>C: {Math.round(pendingIng.carbsG * s * 10) / 10}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioRose }]}>F: {Math.round(pendingIng.fatG * s * 10) / 10}g</Text>
                    </View>
                  );
                })()}
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                  <Pressable style={[styles.confirmBtn, { flex: 1 }]} onPress={confirmIngredient}>
                    <Text style={styles.confirmBtnText}>Add to Recipe</Text>
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={() => { setPendingIng(null); setPendingServings('1'); }}>
                    <Text style={{ color: Colors.textMuted, fontWeight: '600' }}>Back</Text>
                  </Pressable>
                </View>
              </GlassCard>
            ) : (
              /* Step 1: search */
              <View style={{ marginBottom: Spacing.md }}>
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.searchBar}
                    placeholder="Search chicken breast, oats…"
                    placeholderTextColor={Colors.textMuted}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }} hitSlop={8}>
                      <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Clear</Text>
                    </Pressable>
                  )}
                </View>
                {searchNote && (
                  <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 4 }]}>{searchNote}</Text>
                )}
                {isSearching ? (
                  <ActivityIndicator size="small" color={Colors.bioGreen} style={{ marginTop: Spacing.md }} />
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={item => item.id}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.resultRow}
                        onPress={() => { setPendingIng(item); setPendingServings('1'); Haptics.selectionAsync(); }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[Typography.bodyText, { fontWeight: '700' }]} numberOfLines={1}>{item.name}</Text>
                          <Text style={Typography.caption}>
                            {item.servingSize} • {item.brand || (item.source === 'usda' ? 'USDA' : 'OFF')}
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
                  />
                )}
              </View>
            )}

            {/* Added ingredients list */}
            {ingredients.map(ing => (
              <GlassCard key={ing.id} style={styles.ingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bodyText, { fontWeight: '700' }]}>{ing.name}</Text>
                  <Text style={Typography.caption}>{ing.grams}g • {ing.calories} kcal</Text>
                  <Text style={[Typography.caption, { color: Colors.textMuted }]}>
                    P: {ing.proteinG}g | C: {ing.carbsG}g | F: {ing.fatG}g
                  </Text>
                </View>
                <Pressable
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIngredients(prev => prev.filter(i => i.id !== ing.id)); }}
                  hitSlop={10}
                >
                  <Text style={{ color: Colors.bioRose, fontSize: 13 }}>Remove</Text>
                </Pressable>
              </GlassCard>
            ))}

            {/* Save */}
            <Pressable
              style={[styles.saveBtn, (!recipeName.trim() || ingredients.length === 0) && { opacity: 0.5 }]}
              disabled={!recipeName.trim() || ingredients.length === 0}
              onPress={handleSaveRecipe}
            >
              <Text style={styles.saveBtnText}>Save Recipe to Library</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    maxHeight: '92%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md,
    color: Colors.textPure, fontSize: 15, borderWidth: 1, borderColor: Colors.borderMachined, marginTop: 4,
  },
  summaryCard: { marginTop: Spacing.md, marginBottom: Spacing.md },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  macroCol: { alignItems: 'center' },
  ingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchBar: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.sm,
    color: Colors.textPure, fontSize: 14, borderWidth: 1, borderColor: Colors.borderMachined,
  },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderMachined,
  },
  servingBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderMachined, alignItems: 'center', justifyContent: 'center',
  },
  servingBtnText: { color: Colors.textPure, fontSize: 20, lineHeight: 22, fontWeight: '600' },
  servingInput: {
    width: 64, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.bioGreen, color: Colors.textPure, fontSize: 17,
    fontWeight: '700', textAlign: 'center', paddingVertical: 6,
  },
  previewRow: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: Spacing.sm,
    paddingVertical: 6, borderWidth: 1, borderColor: Colors.borderMachined,
  },
  confirmBtn: {
    backgroundColor: Colors.bioGreen, paddingVertical: Spacing.sm, borderRadius: 10, alignItems: 'center',
  },
  confirmBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  cancelBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMachined,
    alignItems: 'center', justifyContent: 'center',
  },
  ingCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.xs, padding: Spacing.md,
  },
  saveBtn: {
    backgroundColor: Colors.bioGreen, paddingVertical: Spacing.md,
    borderRadius: 12, alignItems: 'center', marginTop: Spacing.lg,
  },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});

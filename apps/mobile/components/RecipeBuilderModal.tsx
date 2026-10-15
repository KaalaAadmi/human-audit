import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from './GlassCard';

export interface RecipeIngredient {
  id: string;
  name: string;
  grams: number;
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
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onRecipeSaved: (recipe: CustomRecipe) => void;
}

export function RecipeBuilderModal({ visible, onClose, onRecipeSaved }: Props) {
  const [recipeName, setRecipeName] = useState('');
  const [servingsCount, setServingsCount] = useState('4');

  // Ingredients list in builder
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { id: 'ing_1', name: 'Raw Chicken Breast', grams: 500, calories: 600, proteinG: 120, carbsG: 0, fatG: 12 },
    { id: 'ing_2', name: 'Jasmine Rice (Dry)', grams: 300, calories: 1050, proteinG: 21, carbsG: 240, fatG: 3 },
    { id: 'ing_3', name: 'Olive Oil', grams: 28, calories: 240, proteinG: 0, carbsG: 0, fatG: 28 },
  ]);

  // Temporary new ingredient input form
  const [ingName, setIngName] = useState('');
  const [ingGrams, setIngGrams] = useState('100');
  const [ingCalories, setIngCalories] = useState('');
  const [ingProtein, setIngProtein] = useState('');
  const [ingCarbs, setIngCarbs] = useState('');
  const [ingFat, setIngFat] = useState('');
  const [showAddIngForm, setShowAddIngForm] = useState(false);

  // Computed Totals
  const totalCals = ingredients.reduce((acc, i) => acc + i.calories, 0);
  const totalP = Math.round(ingredients.reduce((acc, i) => acc + i.proteinG, 0));
  const totalC = Math.round(ingredients.reduce((acc, i) => acc + i.carbsG, 0));
  const totalF = Math.round(ingredients.reduce((acc, i) => acc + i.fatG, 0));

  const servings = Math.max(1, parseInt(servingsCount, 10) || 1);
  const perServingCals = Math.round(totalCals / servings);
  const perServingP = Number((totalP / servings).toFixed(1));
  const perServingC = Number((totalC / servings).toFixed(1));
  const perServingF = Number((totalF / servings).toFixed(1));

  const handleAddIngredient = () => {
    if (!ingName.trim() || !ingCalories.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newIng: RecipeIngredient = {
      id: `ing_${Date.now()}`,
      name: ingName.trim(),
      grams: parseFloat(ingGrams) || 100,
      calories: parseInt(ingCalories, 10) || 0,
      proteinG: parseFloat(ingProtein) || 0,
      carbsG: parseFloat(ingCarbs) || 0,
      fatG: parseFloat(ingFat) || 0,
    };

    setIngredients(prev => [...prev, newIng]);
    setIngName('');
    setIngCalories('');
    setIngProtein('');
    setIngCarbs('');
    setIngFat('');
    setShowAddIngForm(false);
  };

  const handleRemoveIngredient = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients(prev => prev.filter(i => i.id !== id));
  };

  const handleSaveRecipe = () => {
    if (!recipeName.trim() || ingredients.length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const recipe: CustomRecipe = {
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
    };

    onRecipeSaved(recipe);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setRecipeName('');
    setServingsCount('4');
    setShowAddIngForm(false);
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
              <Text style={Typography.caption}>Combine ingredients with auto-macro scaling</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Recipe Meta */}
            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>RECIPE NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. High-Protein Meal Prep Chili"
              placeholderTextColor={Colors.textMuted}
              value={recipeName}
              onChangeText={setRecipeName}
            />

            <View style={{ marginTop: Spacing.sm }}>
              <Text style={Typography.statLabel}>NUMBER OF SERVINGS</Text>
              <TextInput
                style={styles.input}
                placeholder="4"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                value={servingsCount}
                onChangeText={setServingsCount}
              />
            </View>

            {/* Calculated Per-Serving Summary Card */}
            <GlassCard style={styles.summaryCard}>
              <Text style={[Typography.statLabel, { color: Colors.bioGreen }]}>PER SERVING MACROS (1 OF {servings})</Text>
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

            {/* Ingredients Section */}
            <View style={styles.ingHeader}>
              <Text style={Typography.cardTitle}>Ingredients ({ingredients.length})</Text>
              <Pressable
                style={styles.addIngBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowAddIngForm(!showAddIngForm);
                }}
              >
                <Text style={styles.addIngBtnText}>{showAddIngForm ? 'Cancel' : '+ Add Ingredient'}</Text>
              </Pressable>
            </View>

            {/* Add Ingredient Subform */}
            {showAddIngForm && (
              <GlassCard style={{ marginBottom: Spacing.md, borderColor: Colors.bioGreen }}>
                <Text style={[Typography.statLabel, { color: Colors.bioGreen }]}>NEW INGREDIENT</Text>
                <TextInput
                  style={[styles.input, { marginTop: Spacing.xs }]}
                  placeholder="Ingredient name (e.g. Diced Tomatoes)"
                  placeholderTextColor={Colors.textMuted}
                  value={ingName}
                  onChangeText={setIngName}
                />
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={Typography.caption}>Grams</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="100"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={ingGrams}
                      onChangeText={setIngGrams}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={Typography.caption}>Calories *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="120"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={ingCalories}
                      onChangeText={setIngCalories}
                    />
                  </View>
                </View>
                <View style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <Text style={[Typography.caption, { color: Colors.bioGreen }]}>Protein (g)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="15"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={ingProtein}
                      onChangeText={setIngProtein}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={[Typography.caption, { color: Colors.bioAmber }]}>Carbs (g)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="10"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={ingCarbs}
                      onChangeText={setIngCarbs}
                    />
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={[Typography.caption, { color: Colors.bioRose }]}>Fat (g)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="2"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={ingFat}
                      onChangeText={setIngFat}
                    />
                  </View>
                </View>
                <Pressable style={styles.confirmIngBtn} onPress={handleAddIngredient}>
                  <Text style={styles.confirmIngBtnText}>Add to Recipe</Text>
                </Pressable>
              </GlassCard>
            )}

            {/* Existing Ingredients List */}
            {ingredients.map(ing => (
              <GlassCard key={ing.id} style={styles.ingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bodyText, { fontWeight: '700' }]}>{ing.name}</Text>
                  <Text style={Typography.caption}>{ing.grams}g • {ing.calories} kcal</Text>
                  <Text style={[Typography.caption, { color: Colors.textMuted }]}>
                    P: {ing.proteinG}g | C: {ing.carbsG}g | F: {ing.fatG}g
                  </Text>
                </View>
                <Pressable onPress={() => handleRemoveIngredient(ing.id)} hitSlop={10}>
                  <Text style={{ color: Colors.bioRose, fontSize: 13 }}>Remove</Text>
                </Pressable>
              </GlassCard>
            ))}

            {/* Save Recipe Action */}
            <Pressable
              style={[
                styles.saveBtn,
                (!recipeName.trim() || ingredients.length === 0) && { opacity: 0.5 },
              ]}
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    color: Colors.textPure,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
    marginTop: 4,
  },
  summaryCard: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  macroCol: {
    alignItems: 'center',
  },
  ingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  addIngBtn: {
    backgroundColor: Colors.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  addIngBtnText: {
    color: Colors.bioGreen,
    fontWeight: '700',
    fontSize: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  gridCol: {
    flex: 1,
  },
  confirmIngBtn: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  confirmIngBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  ingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    padding: Spacing.md,
  },
  saveBtn: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});

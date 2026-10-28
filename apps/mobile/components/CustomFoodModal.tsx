import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { SearchFoodResult } from '../services/nutritionService';
import { Sheet } from './Sheet';
import { RecipeBuilder, CustomRecipe } from './RecipeBuilderModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodCreated: (food: SearchFoodResult) => void;
  onRecipeSaved: (recipe: CustomRecipe) => void;
}

export function CustomFoodModal({ visible, onClose, onFoodCreated, onRecipeSaved }: Props) {
  const [tab, setTab] = useState<'food' | 'recipe'>('food');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('100g');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');

  const handleSave = () => {
    if (!name.trim() || !calories.trim()) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newFood: SearchFoodResult = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      brand: brand.trim() || undefined,
      servingSize: servingSize.trim() || '1 serving',
      servingGrams: parseFloat(servingSize) || 100, // e.g. "85g" -> 85
      calories: parseInt(calories, 10) || 0,
      proteinG: parseFloat(proteinG) || 0,
      carbsG: parseFloat(carbsG) || 0,
      fatG: parseFloat(fatG) || 0,
      source: 'custom',
    };

    onFoodCreated(newFood);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setName('');
    setBrand('');
    setServingSize('100g');
    setCalories('');
    setProteinG('');
    setCarbsG('');
    setFatG('');
  };

  return (
    <Sheet visible={visible} onClose={onClose} height={0.85}>
          <View style={styles.header}>
            <View>
              <Text style={Typography.cardTitle}>Create Food or Recipe</Text>
              <Text style={Typography.caption}>Saved to your library, shared with other users</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.tabsRow}>
            {(['food', 'recipe'] as const).map(t => (
              <Pressable
                key={t}
                style={[styles.tab, tab === t && styles.tabActive]}
                onPress={() => { Haptics.selectionAsync(); setTab(t); }}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'food' ? 'Custom Food' : 'Recipe'}</Text>
              </Pressable>
            ))}
          </View>

          {/* Both panes stay mounted (the inactive one is hidden) so half-filled forms survive switching tabs. */}
          <View style={tab === 'recipe' ? styles.pane : styles.hidden}>
            <RecipeBuilder onClose={onClose} onRecipeSaved={onRecipeSaved} />
          </View>
          <ScrollView style={tab === 'food' ? styles.pane : styles.hidden} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            {/* Form Fields */}
            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>FOOD / RECIPE NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Grandma's Protein Meatloaf"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>BRAND OR AUTHOR (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Homemade"
              placeholderTextColor={Colors.textMuted}
              value={brand}
              onChangeText={setBrand}
            />

            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>SERVING SIZE DESCRIPTION</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1 slice (120g)"
              placeholderTextColor={Colors.textMuted}
              value={servingSize}
              onChangeText={setServingSize}
            />

            {/* Macro Matrix */}
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={[Typography.statLabel, { color: Colors.textPure }]}>CALORIES *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="250"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={calories}
                  onChangeText={setCalories}
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={[Typography.statLabel, { color: Colors.bioGreen }]}>PROTEIN (G)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="25"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={proteinG}
                  onChangeText={setProteinG}
                />
              </View>
            </View>

            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={[Typography.statLabel, { color: Colors.bioAmber }]}>CARBS (G)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="15"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={carbsG}
                  onChangeText={setCarbsG}
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={[Typography.statLabel, { color: Colors.bioRose }]}>FAT (G)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="8"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  value={fatG}
                  onChangeText={setFatG}
                />
              </View>
            </View>

            <Pressable
              style={[styles.actionBtn, (!name.trim() || !calories.trim()) && { opacity: 0.5 }]}
              disabled={!name.trim() || !calories.trim()}
              onPress={handleSave}
            >
              <Text style={styles.actionBtnText}>Save and Add to Diary</Text>
            </Pressable>
          </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  pane: { flex: 1 },
  hidden: { display: 'none' },
  tabsRow: { flexDirection: 'row', backgroundColor: Colors.surfaceHighlight, borderRadius: 10, padding: 3, marginBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMachined },
  tabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: Colors.bioGreen, fontWeight: '700' },
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
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  gridCol: {
    flex: 1,
  },
  actionBtn: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  actionBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});

import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from './GlassCard';

export interface SavedMealTemplate {
  id: string;
  name: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onMealSaved: (meal: SavedMealTemplate) => void;
}

export function MealTemplateModal({ visible, onClose, onMealSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any'>('lunch');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');

  const categories: { key: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any'; label: string }[] = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'lunch', label: 'Lunch' },
    { key: 'dinner', label: 'Dinner' },
    { key: 'snack', label: 'Snack' },
    { key: 'any', label: 'Any Meal' },
  ];

  const handleSave = () => {
    if (!name.trim() || !calories.trim()) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const meal: SavedMealTemplate = {
      id: `meal_${Date.now()}`,
      name: name.trim(),
      category,
      description: description.trim() || 'Custom meal combo',
      calories: parseInt(calories, 10) || 0,
      proteinG: parseFloat(proteinG) || 0,
      carbsG: parseFloat(carbsG) || 0,
      fatG: parseFloat(fatG) || 0,
    };

    onMealSaved(meal);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setName('');
    setDescription('');
    setCategory('lunch');
    setCalories('');
    setProteinG('');
    setCarbsG('');
    setFatG('');
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={Typography.cardTitle}>Save Meal Template</Text>
              <Text style={Typography.caption}>Create one-tap reusable meal combinations</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Form Fields */}
            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>MEAL TEMPLATE NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Post-Workout Anabolic Bowl"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>DESCRIPTION / FOODS INCLUDED</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 200g Chicken, 1.5 cup Rice, 1 Avocado, Olive Oil"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            {/* Category Selector */}
            <Text style={[Typography.statLabel, { marginTop: Spacing.sm }]}>DEFAULT MEAL TYPE</Text>
            <View style={styles.catRow}>
              {categories.map(c => {
                const isSelected = category === c.key;
                return (
                  <Pressable
                    key={c.key}
                    style={[styles.catPill, isSelected && styles.catPillActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCategory(c.key);
                    }}
                  >
                    <Text style={[styles.catPillText, isSelected && { color: '#000', fontWeight: '700' }]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Macro Matrix */}
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={[Typography.statLabel, { color: Colors.textPure }]}>TOTAL CALORIES *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="650"
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
                  placeholder="55"
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
                  placeholder="68"
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
                  placeholder="16"
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
              <Text style={styles.actionBtnText}>Save Meal Template</Text>
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
    maxHeight: '90%',
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
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  catPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  catPillActive: {
    backgroundColor: Colors.bioGreen,
    borderColor: Colors.bioGreen,
  },
  catPillText: {
    color: Colors.textMuted,
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

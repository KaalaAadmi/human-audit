import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from './GlassCard';
import { NutritionService, SearchFoodResult } from '../services/nutritionService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onItemsParsed: (items: SearchFoodResult[]) => void;
}

export function VoiceLogModal({ visible, onClose, onItemsParsed }: Props) {
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<SearchFoodResult[]>([]);

  const handleParse = async (textToParse?: string) => {
    const text = textToParse || transcript;
    if (!text.trim()) return;

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setError(null);
    try {
      const items = await NutritionService.parseVoice(text);
      if (items.length === 0) throw new Error('No food found in that description');
      setParsedItems(items);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAdd = () => {
    if (parsedItems.length > 0) {
      onItemsParsed(parsedItems);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setTranscript('');
    setParsedItems([]);
    setError(null);
    setLoading(false);
  };

  const quickPresets = [
    '3 scrambled eggs, 2 slices whole wheat toast, black coffee',
    '200g grilled chicken breast, 1 cup jasmine rice, steamed broccoli',
    '1 scoop whey protein isolate with 250ml oat milk',
    '150g baked salmon, sweet potato, avocado salad',
  ];

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={Typography.cardTitle}>Natural Language / Voice Log</Text>
              <Text style={Typography.caption}>Speak or describe your meal naturally</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Input Box */}
            <View style={styles.inputBox}>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 2 fried eggs with 1 avocado and protein shake..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                value={transcript}
                onChangeText={setTranscript}
              />
              <Pressable
                style={[styles.parseBtn, (!transcript.trim() || loading) && { opacity: 0.5 }]}
                disabled={!transcript.trim() || loading}
                onPress={() => handleParse()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.parseBtnText}>Parse Telemetry</Text>
                )}
              </Pressable>
            </View>

            {error && <Text style={[Typography.caption, { color: Colors.bioRose, marginTop: Spacing.sm }]}>{error}</Text>}

            {/* Quick Presets */}
            {parsedItems.length === 0 && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={[Typography.statLabel, { marginBottom: Spacing.xs }]}>OR TAP QUICK PRESET:</Text>
                {quickPresets.map((preset, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.presetItem}
                    onPress={() => {
                      setTranscript(preset);
                      handleParse(preset);
                    }}
                  >
                    <Text style={[Typography.caption, { color: Colors.textPure }]}>"{preset}"</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Parsed Breakdown */}
            {parsedItems.length > 0 && (
              <View style={{ marginTop: Spacing.md }}>
                <Text style={[Typography.statLabel, { color: Colors.bioGreen, marginBottom: Spacing.xs }]}>
                  EXTRACTED FOOD ITEMS ({parsedItems.length}):
                </Text>
                {parsedItems.map((item, idx) => (
                  <GlassCard key={idx} style={{ marginBottom: Spacing.xs, padding: Spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[Typography.bodyText, { fontWeight: '700' }]}>{item.name}</Text>
                      <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>{item.calories} kcal</Text>
                    </View>
                    <Text style={Typography.caption}>Portion: {item.servingSize}</Text>
                    <View style={styles.macroMiniRow}>
                      <Text style={[Typography.caption, { color: Colors.bioGreen }]}>P: {item.proteinG}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioAmber }]}>C: {item.carbsG}g</Text>
                      <Text style={[Typography.caption, { color: Colors.bioRose }]}>F: {item.fatG}g</Text>
                    </View>
                  </GlassCard>
                ))}

                {/* Bulk Confirm */}
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
                  <Pressable style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.surfaceHighlight }]} onPress={handleReset}>
                    <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>Clear</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, { flex: 1.5 }]} onPress={handleConfirmAdd}>
                    <Text style={styles.actionBtnText}>Add All ({parsedItems.reduce((acc, i) => acc + i.calories, 0)} kcal)</Text>
                  </Pressable>
                </View>
              </View>
            )}
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
  inputBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderMachined,
  },
  textInput: {
    color: Colors.textPure,
    fontSize: 15,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  parseBtn: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  parseBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  presetItem: {
    backgroundColor: Colors.surfaceHighlight,
    padding: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: Colors.bioGreen,
  },
  macroMiniRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  actionBtn: {
    backgroundColor: Colors.bioGreen,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
});

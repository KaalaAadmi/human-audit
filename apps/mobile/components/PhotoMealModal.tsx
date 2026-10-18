import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from './GlassCard';
import { NutritionService, SearchFoodResult } from '../services/nutritionService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onMealAnalyzed: (items: SearchFoodResult[]) => void;
}

export function PhotoMealModal({ visible, onClose, onMealAnalyzed }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<CameraView>(null);
  const [detectedPlate, setDetectedPlate] = useState<{ mealName: string; items: SearchFoodResult[] } | null>(null);

  const handleCaptureAndAnalyze = async () => {
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const photo = await camera.current?.takePictureAsync({ base64: true, quality: 0.5 });
      if (!photo?.base64) throw new Error('Could not capture a photo');
      const analysis = await NutritionService.analyzePhoto(photo.base64);
      if (analysis.items.length === 0) throw new Error('No food detected - try again with the plate centred');
      setDetectedPlate(analysis);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAdd = () => {
    if (detectedPlate) {
      onMealAnalyzed(detectedPlate.items);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setDetectedPlate(null);
    setError(null);
    setLoading(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={Typography.cardTitle}>Photo AI Meal Scanner</Text>
              <Text style={Typography.caption}>Point camera at your plate for instant macros</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!detectedPlate ? (
              <View>
                {!permission?.granted ? (
                  <View style={styles.permContainer}>
                    <Text style={[Typography.bodyText, { textAlign: 'center', marginBottom: Spacing.md }]}>
                      Camera permission is required to photograph your meals.
                    </Text>
                    <Pressable style={styles.actionBtn} onPress={requestPermission}>
                      <Text style={styles.actionBtnText}>Grant Camera Access</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.cameraBox}>
                    <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
                    <View style={styles.reticle}>
                      <Text style={[Typography.caption, { color: Colors.bioGreen, textAlign: 'center' }]}>
                        [ Center plate inside frame ]
                      </Text>
                    </View>
                  </View>
                )}

                {error && <Text style={[Typography.caption, { color: Colors.bioRose, marginTop: Spacing.sm }]}>{error}</Text>}
                <Pressable
                  style={[styles.actionBtn, { marginTop: Spacing.md }, loading && { opacity: 0.6 }]}
                  disabled={loading}
                  onPress={handleCaptureAndAnalyze}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.actionBtnText}>Analyze Plate with Vision AI</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View>
                <GlassCard style={{ marginBottom: Spacing.md }}>
                  <Text style={[Typography.statLabel, { color: Colors.bioGreen }]}>AI VISION BREAKDOWN</Text>
                  <Text style={[Typography.cardTitle, { marginVertical: 4 }]}>{detectedPlate.mealName}</Text>
                  <Text style={Typography.caption}>
                    Total: {detectedPlate.items.reduce((acc, i) => acc + i.calories, 0)} kcal |{' '}
                    {detectedPlate.items.reduce((acc, i) => acc + i.proteinG, 0)}g Protein
                  </Text>
                </GlassCard>

                {detectedPlate.items.map((item, idx) => (
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

                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
                  <Pressable style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.surfaceHighlight }]} onPress={handleReset}>
                    <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>Retake</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, { flex: 1.5 }]} onPress={handleConfirmAdd}>
                    <Text style={styles.actionBtnText}>Add All Items</Text>
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
  cameraBox: {
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 240,
    height: 200,
    borderWidth: 2,
    borderColor: Colors.bioGreen,
    borderRadius: 16,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
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

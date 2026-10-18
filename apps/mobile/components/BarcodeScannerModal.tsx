import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { GlassCard } from './GlassCard';
import { NutritionService, SearchFoodResult } from '../services/nutritionService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodScanned: (food: SearchFoodResult) => void;
}

export function BarcodeScannerModal({ visible, onClose, onFoodScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [scannedFood, setScannedFood] = useState<SearchFoodResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let food: SearchFoodResult | null = null;
    let failure: string | null = null;
    try {
      food = await NutritionService.lookupBarcode(result.data);
    } catch (e) {
      failure = (e as Error).message;
    }
    setLoading(false);

    if (food) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScannedFood(food);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setErrorMsg(failure ?? `No product with nutrition data found for barcode ${result.data}`);
    }
  };

  const handleConfirmAdd = () => {
    if (scannedFood) {
      onFoodScanned(scannedFood);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setScannedFood(null);
    setErrorMsg(null);
    setScanning(true);
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
              <Text style={Typography.cardTitle}>Barcode Scanner</Text>
              <Text style={Typography.caption}>Scan product UPC / EAN barcode</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          {/* Camera View */}
          {!permission?.granted ? (
            <View style={styles.permContainer}>
              <Text style={[Typography.bodyText, { textAlign: 'center', marginBottom: Spacing.md }]}>
                Camera permission is required to scan food barcodes.
              </Text>
              <Pressable style={styles.actionBtn} onPress={requestPermission}>
                <Text style={styles.actionBtnText}>Grant Camera Access</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128'],
                }}
                onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
              />
              {/* Aiming Reticle */}
              <View style={styles.reticle}>
                <View style={styles.reticleBorder} />
              </View>
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.bioGreen} />
                  <Text style={[Typography.caption, { color: Colors.textPure, marginTop: Spacing.xs }]}>
                    Searching Open Food Facts...
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Result Card */}
          {scannedFood && (
            <GlassCard style={styles.resultCard}>
              <Text style={Typography.statLabel}>{scannedFood.brand || 'Branded Food'}</Text>
              <Text style={[Typography.cardTitle, { color: Colors.bioGreen, marginVertical: 2 }]}>
                {scannedFood.name}
              </Text>
              <Text style={Typography.caption}>Serving: {scannedFood.servingSize}</Text>

              <View style={styles.macroRow}>
                <View style={styles.macroItem}>
                  <Text style={[Typography.caption, { color: Colors.textMuted }]}>Calories</Text>
                  <Text style={[Typography.bodyMono, { color: Colors.textPure }]}>{scannedFood.calories} kcal</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[Typography.caption, { color: Colors.bioGreen }]}>Protein</Text>
                  <Text style={[Typography.bodyMono, { color: Colors.bioGreen }]}>{scannedFood.proteinG}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[Typography.caption, { color: Colors.bioAmber }]}>Carbs</Text>
                  <Text style={[Typography.bodyMono, { color: Colors.bioAmber }]}>{scannedFood.carbsG}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[Typography.caption, { color: Colors.bioRose }]}>Fat</Text>
                  <Text style={[Typography.bodyMono, { color: Colors.bioRose }]}>{scannedFood.fatG}g</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                <Pressable style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.surfaceHighlight }]} onPress={handleReset}>
                  <Text style={[styles.actionBtnText, { color: Colors.textMuted }]}>Scan Another</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { flex: 1 }]} onPress={handleConfirmAdd}>
                  <Text style={styles.actionBtnText}>Add to Diary</Text>
                </Pressable>
              </View>
            </GlassCard>
          )}

          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={[Typography.caption, { color: Colors.bioRose, textAlign: 'center' }]}>{errorMsg}</Text>
              <Pressable style={[styles.actionBtn, { marginTop: Spacing.sm }]} onPress={handleReset}>
                <Text style={styles.actionBtnText}>Try Again</Text>
              </Pressable>
            </View>
          )}
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
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 220,
    height: 140,
    borderWidth: 2,
    borderColor: Colors.bioGreen,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  reticleBorder: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 13, 16, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  resultCard: {
    marginTop: Spacing.md,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderMachined,
  },
  macroItem: {
    alignItems: 'center',
  },
  errorBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(253, 164, 175, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.bioRose,
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

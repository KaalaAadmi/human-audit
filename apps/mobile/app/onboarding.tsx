import React, { useState } from 'react';
  import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
  import { useRouter } from 'expo-router';
  import { Colors } from '../theme/colors';
  import { Typography } from '../theme/typography';
  import { Spacing } from '../theme/spacing';
  import { GlassCard } from '../components/GlassCard';

  export default function OnboardingScreen() {
    const router = useRouter();
    const [displayName, setDisplayName] = useState('');
    const [birthYear, setBirthYear] = useState('1998');
    const [heightCm, setHeightCm] = useState('178');

    const handleComplete = () => {
      // Record baseline sync timestamp (Today)
      const syncStartTimestamp = new Date().toISOString();
      console.log('Ingestion Baseline Window set to:', syncStartTimestamp);

      // Navigate to Home Dashboard
      router.replace('/');
    };

    return (
      <View style={styles.container}>
        <Text style={Typography.heroTitle}>Welcome to HumanAudit</Text>
        <Text style={[Typography.caption, { marginTop: Spacing.xs, marginBottom: Spacing.xl }]}>
          Set your baseline biometrics to initialize your Biological Body Age.
        </Text>

        <GlassCard style={{ width: '100%', gap: Spacing.md }}>
          <View>
            <Text style={Typography.metricLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your Name"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View>
            <Text style={Typography.metricLabel}>Birth Year (Chronological Age)</Text>
            <TextInput
              style={styles.input}
              value={birthYear}
              onChangeText={setBirthYear}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View>
            <Text style={Typography.metricLabel}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleComplete}>
            <Text style={styles.buttonText}>Grant Permissions & Start Tracking</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.canvas,
      padding: Spacing.xl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    input: {
      backgroundColor: Colors.surfaceSubtle,
      borderRadius: Spacing.radiusButton,
      padding: Spacing.md,
      color: Colors.textPrimary,
      marginTop: Spacing.xs,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    button: {
      backgroundColor: Colors.readiness,
      borderRadius: Spacing.radiusButton,
      padding: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    buttonText: {
      color: '#000',
      fontWeight: '700',
      fontSize: 14,
    },
  });
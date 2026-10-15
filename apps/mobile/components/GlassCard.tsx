import React from 'react';
  import { StyleSheet, View, ViewProps } from 'react-native';
  import { Colors } from '../theme/colors';
  import { Spacing } from '../theme/spacing';

  interface GlassCardProps extends ViewProps {
    children: React.ReactNode;
    borderColor?: string;
  }

  export function GlassCard({ children, style, borderColor, ...props }: GlassCardProps) {
    return (
      <View
        style={[
          styles.card,
          borderColor ? { borderColor } : null,
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }

  const styles = StyleSheet.create({
    card: {
      backgroundColor: Colors.card,
      borderRadius: Spacing.radiusCard,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: Colors.border,
    },
  });
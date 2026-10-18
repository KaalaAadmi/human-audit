import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Dimensions,
  Easing,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { Typography } from "../theme/typography";
import { Spacing } from "../theme/spacing";

interface ConfettiCelebrationProps {
  visible: boolean;
  onDismiss?: () => void;
  title?: string;
  subtitle?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PARTICLE_COUNT = 45;

const CONFETTI_COLORS = [
  Colors.hydration,
  Colors.bioGreen,
  Colors.bioAmber,
  Colors.bioLavender,
  "#38BDF8",
  "#F472B6",
  "#E879F9",
  "#FBBF24",
  "#34D399",
  "#FFFFFF",
];

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  isCircle: boolean;
  animY: Animated.Value;
  animX: Animated.Value;
  animRotate: Animated.Value;
  animOpacity: Animated.Value;
}

export function ConfettiCelebration({
  visible,
  onDismiss,
  title = "GOAL CRUSHED! 💧",
  subtitle = "100% of your daily hydration achieved",
}: ConfettiCelebrationProps) {
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const particlesRef = useRef<Particle[]>([]);

  if (particlesRef.current.length === 0) {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: Math.floor(Math.random() * 8) + 6,
      isCircle: Math.random() > 0.5,
      animY: new Animated.Value(0),
      animX: new Animated.Value(0),
      animRotate: new Animated.Value(0),
      animOpacity: new Animated.Value(1),
    }));
  }

  useEffect(() => {
    if (visible) {
      // Banner slide & pop
      bannerAnim.setValue(0);
      Animated.spring(bannerAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();

      // Launch particles
      const animations = particlesRef.current.map((p) => {
        p.animY.setValue(0);
        p.animX.setValue(0);
        p.animRotate.setValue(0);
        p.animOpacity.setValue(1);

        const dropDuration = 2200 + Math.random() * 1200;
        const drift = (Math.random() - 0.5) * 120;
        const rotations = (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 4);

        return Animated.parallel([
          Animated.timing(p.animY, {
            toValue: SCREEN_HEIGHT + 100,
            duration: dropDuration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(p.animX, {
            toValue: drift,
            duration: dropDuration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(p.animRotate, {
            toValue: rotations,
            duration: dropDuration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(dropDuration * 0.65),
            Animated.timing(p.animOpacity, {
              toValue: 0,
              duration: dropDuration * 0.35,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      Animated.stagger(25, animations).start();

      const timer = setTimeout(() => {
        if (onDismiss) {
          onDismiss();
        }
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Confetti Particles */}
      {particlesRef.current.map((p) => {
        const spin = p.animRotate.interpolate({
          inputRange: [-10, 10],
          outputRange: ["-3600deg", "3600deg"],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                left: p.x,
                width: p.size,
                height: p.isCircle ? p.size : p.size * 1.6,
                backgroundColor: p.color,
                borderRadius: p.isCircle ? p.size / 2 : 2,
                opacity: p.animOpacity,
                transform: [
                  { translateY: p.animY },
                  { translateX: p.animX },
                  { rotate: spin },
                ],
              },
            ]}
          />
        );
      })}

      {/* Floating Celebration Toast */}
      <Animated.View
        style={[
          styles.toastContainer,
          {
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              },
              {
                scale: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.toastContent}
          onPress={onDismiss}
        >
          <View style={styles.trophyCircle}>
            <Ionicons name="sparkles" size={20} color={Colors.hydration} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toastTitle}>{title}</Text>
            <Text style={styles.toastSubtitle}>{subtitle}</Text>
          </View>
          <Ionicons name="close" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  particle: {
    position: "absolute",
    top: -20,
  },
  toastContainer: {
    position: "absolute",
    top: 60,
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: "center",
    zIndex: 10000,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 21, 27, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(103, 232, 249, 0.4)",
    borderRadius: Spacing.radiusCard,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    shadowColor: Colors.hydration,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    gap: Spacing.md,
  },
  trophyCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(103, 232, 249, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(103, 232, 249, 0.3)",
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  toastSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

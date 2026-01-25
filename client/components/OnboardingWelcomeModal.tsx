import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Modal, Pressable, Animated, Easing, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const WHEEL_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

const DEFAULT_BUBBLES = [
  { name: "Family", color: "#8B5CF6", icon: "heart" },
  { name: "Home", color: "#EC4899", icon: "home" },
  { name: "Work", color: "#F97316", icon: "briefcase" },
  { name: "Health", color: "#EF4444", icon: "activity" },
  { name: "Finance", color: "#22C55E", icon: "dollar-sign" },
  { name: "Hobbies", color: "#FBBF24", icon: "star" },
];

interface OnboardingWelcomeModalProps {
  visible: boolean;
  onContinue: () => void;
}

export function OnboardingWelcomeModal({ visible, onContinue }: OnboardingWelcomeModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 20000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),
      ]).start();
    }
  }, [visible, rotateAnim, scaleAnim, fadeAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const centerX = WHEEL_SIZE / 2;
  const centerY = WHEEL_SIZE / 2;
  const bubbleRadius = 28;
  const orbitRadius = WHEEL_SIZE / 2 - bubbleRadius - 10;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.85)" }]}>
        <Animated.View 
          style={[
            styles.content, 
            { 
              opacity: fadeAnim,
              paddingTop: insets.top + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            }
          ]}
        >
          <ThemedText style={styles.welcomeTitle}>Welcome to My Life</ThemedText>
          <ThemedText style={[styles.subtitle, { color: "rgba(255,255,255,0.7)" }]}>
            Your Life Wheel is ready with common categories!
          </ThemedText>

          <Animated.View 
            style={[
              styles.wheelContainer,
              {
                transform: [
                  { scale: scaleAnim },
                  { rotate: spin },
                ],
              },
            ]}
          >
            <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
              <Circle
                cx={centerX}
                cy={centerY}
                r={orbitRadius}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={2}
                fill="transparent"
              />
              <Circle
                cx={centerX}
                cy={centerY}
                r={30}
                fill={theme.primary}
              />
              <G>
                {DEFAULT_BUBBLES.map((bubble, index) => {
                  const angle = (index * 360) / DEFAULT_BUBBLES.length - 90;
                  const radian = (angle * Math.PI) / 180;
                  const x = centerX + orbitRadius * Math.cos(radian);
                  const y = centerY + orbitRadius * Math.sin(radian);
                  return (
                    <Circle
                      key={bubble.name}
                      cx={x}
                      cy={y}
                      r={bubbleRadius}
                      fill={bubble.color}
                    />
                  );
                })}
              </G>
            </Svg>
          </Animated.View>

          <View style={styles.bubblesLegend}>
            {DEFAULT_BUBBLES.map((bubble) => (
              <View key={bubble.name} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: bubble.color }]} />
                <ThemedText style={styles.legendText}>{bubble.name}</ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.tipCard}>
            <Feather name="info" size={18} color={theme.primary} />
            <ThemedText style={[styles.tipText, { color: "rgba(255,255,255,0.8)" }]}>
              Bubbles are your top-level categories — tap one to focus on that area of life.
            </ThemedText>
          </View>

          <Pressable
            style={[styles.continueButton, { backgroundColor: theme.primary }]}
            onPress={onContinue}
          >
            <ThemedText style={styles.continueText}>Let's Get Started</ThemedText>
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    width: "100%",
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  wheelContainer: {
    marginVertical: Spacing.xl,
  },
  bubblesLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    maxWidth: 320,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: BorderRadius.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    maxWidth: 340,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    minWidth: 200,
  },
  continueText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

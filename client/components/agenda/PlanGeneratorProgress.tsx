import React from "react";
import { View, StyleSheet } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

export type PlanGeneratorPhase = "form" | "chat" | "approved";

const STEPS = [
  { key: "form" as const, label: "Setup", number: 1 },
  { key: "chat" as const, label: "Review", number: 2 },
  { key: "approved" as const, label: "Apply", number: 3 },
];

const ACTIVE_COLOR = "#6B7FFF";

interface PlanGeneratorProgressProps {
  currentPhase: PlanGeneratorPhase;
}

export function PlanGeneratorProgress({ currentPhase }: PlanGeneratorProgressProps) {
  const { theme } = useTheme();
  const activeIndex = STEPS.findIndex((s) => s.key === currentPhase);

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isActive = index === activeIndex;
        const isPast = index < activeIndex;

        return (
          <React.Fragment key={step.key}>
            <View style={styles.step}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: isActive || isPast ? ACTIVE_COLOR : theme.backgroundSecondary,
                    borderColor: isActive || isPast ? ACTIVE_COLOR : theme.border,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.circleText,
                    { color: isActive || isPast ? "#FFFFFF" : theme.textSecondary },
                  ]}
                >
                  {step.number}
                </ThemedText>
              </View>
              <ThemedText
                style={[
                  styles.label,
                  { color: isActive ? theme.text : theme.textSecondary },
                ]}
              >
                {step.label}
              </ThemedText>
            </View>
            {index < STEPS.length - 1 ? (
              <View
                style={[
                  styles.line,
                  { backgroundColor: index < activeIndex ? ACTIVE_COLOR : theme.border },
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  step: {
    alignItems: "center",
    width: 56,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  circleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
  line: {
    height: 2,
    flex: 1,
    marginBottom: 16,
    maxWidth: 40,
  },
});

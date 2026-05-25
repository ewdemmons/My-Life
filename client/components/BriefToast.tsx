import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

interface BriefToastProps {
  message: string | null;
  visible: boolean;
}

export function BriefToast({ message, visible }: BriefToastProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  if (!visible || !message) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          bottom: insets.bottom + Spacing.xl,
          backgroundColor: isDark ? theme.backgroundSecondary : theme.text,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.text,
          { color: isDark ? theme.text : theme.buttonText },
        ]}
      >
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});

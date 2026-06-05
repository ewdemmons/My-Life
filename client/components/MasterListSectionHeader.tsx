import React from "react";
import { View, StyleSheet } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

interface MasterListSectionHeaderProps {
  label: string;
}

export function MasterListSectionHeader({ label }: MasterListSectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.label, { color: theme.text }]}>{label}</ThemedText>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  separator: {
    height: 1,
    width: "100%",
  },
});

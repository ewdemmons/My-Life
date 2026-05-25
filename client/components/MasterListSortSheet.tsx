import React from "react";
import { View, StyleSheet, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import {
  MasterListSortOption,
  SORT_OPTIONS,
} from "@/utils/masterListUtils";

interface MasterListSortSheetProps {
  visible: boolean;
  selected: MasterListSortOption;
  onSelect: (option: MasterListSortOption) => void;
  onClose: () => void;
}

export function MasterListSortSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: MasterListSortSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <ThemedText style={[styles.closeButton, { color: theme.textSecondary }]}>
              Close
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Sort</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
          {SORT_OPTIONS.map((option) => {
            const isSelected = selected === option.value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.optionRow,
                  { borderBottomColor: theme.border },
                  isSelected && { backgroundColor: theme.primary + "10" },
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <ThemedText
                  style={[
                    styles.optionLabel,
                    isSelected && { color: theme.primary, fontWeight: "600" },
                  ]}
                >
                  {option.label}
                </ThemedText>
                {isSelected ? (
                  <Feather name="check" size={20} color={theme.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    fontSize: 16,
    minWidth: 50,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpacer: {
    minWidth: 50,
  },
  content: {
    paddingTop: Spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    fontSize: 16,
  },
});

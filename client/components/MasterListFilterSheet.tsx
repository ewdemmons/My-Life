import React from "react";
import { View, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { LifeCategory } from "@/types";
import {
  DEFAULT_MASTERLIST_FILTERS,
  FILTER_ENTRY_TYPES,
  MasterListFilters,
} from "@/utils/masterListUtils";

interface MasterListFilterSheetProps {
  visible: boolean;
  filters: MasterListFilters;
  categories: LifeCategory[];
  onChange: (filters: MasterListFilters) => void;
  onClose: () => void;
}

type PriorityFilter = MasterListFilters["priority"];
type StatusFilter = MasterListFilters["status"];

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
];

export function MasterListFilterSheet({
  visible,
  filters,
  categories,
  onChange,
  onClose,
}: MasterListFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const toggleLifeArea = (categoryId: string) => {
    const isSelected = filters.lifeAreaIds.includes(categoryId);
    onChange({
      ...filters,
      lifeAreaIds: isSelected
        ? filters.lifeAreaIds.filter((id) => id !== categoryId)
        : [...filters.lifeAreaIds, categoryId],
    });
  };

  const toggleEntryType = (type: string) => {
    const isSelected = filters.entryTypes.includes(type);
    onChange({
      ...filters,
      entryTypes: isSelected
        ? filters.entryTypes.filter((t) => t !== type)
        : [...filters.entryTypes, type],
    });
  };

  const handleClearAll = () => {
    onChange(DEFAULT_MASTERLIST_FILTERS);
  };

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
          <ThemedText style={styles.headerTitle}>Filter</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Life Area
            </ThemedText>
            <View style={styles.chipRow}>
              {categories.map((category) => {
                const isSelected = filters.lifeAreaIds.includes(category.id);
                return (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? theme.primary + "20"
                          : theme.backgroundRoot,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => toggleLifeArea(category.id)}
                  >
                    <View style={[styles.chipDot, { backgroundColor: category.color }]} />
                    <ThemedText
                      style={[
                        styles.chipText,
                        isSelected && { color: theme.primary, fontWeight: "600" },
                      ]}
                    >
                      {category.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Priority
            </ThemedText>
            <View style={styles.pillRow}>
              {PRIORITY_OPTIONS.map((option) => {
                const isSelected = filters.priority === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: isSelected
                          ? theme.primary + "20"
                          : theme.backgroundRoot,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => onChange({ ...filters, priority: option.value })}
                  >
                    <ThemedText
                      style={[
                        styles.pillText,
                        isSelected && { color: theme.primary, fontWeight: "600" },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Status
            </ThemedText>
            <View style={styles.pillRow}>
              {STATUS_OPTIONS.map((option) => {
                const isSelected = filters.status === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: isSelected
                          ? theme.primary + "20"
                          : theme.backgroundRoot,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => onChange({ ...filters, status: option.value })}
                  >
                    <ThemedText
                      style={[
                        styles.pillText,
                        isSelected && { color: theme.primary, fontWeight: "600" },
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              Entry Type
            </ThemedText>
            <View style={styles.chipRow}>
              {FILTER_ENTRY_TYPES.map((entryType) => {
                const isSelected = filters.entryTypes.includes(entryType.value);
                return (
                  <Pressable
                    key={entryType.value}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? theme.primary + "20"
                          : theme.backgroundRoot,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => toggleEntryType(entryType.value)}
                  >
                    <ThemedText
                      style={[
                        styles.chipText,
                        isSelected && { color: theme.primary, fontWeight: "600" },
                      ]}
                    >
                      {entryType.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={[styles.clearButton, { borderColor: theme.border }]}
            onPress={handleClearAll}
          >
            <Feather name="x-circle" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.clearButtonText, { color: theme.textSecondary }]}>
              Clear all filters
            </ThemedText>
          </Pressable>
        </ScrollView>
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
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 14,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 14,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
});

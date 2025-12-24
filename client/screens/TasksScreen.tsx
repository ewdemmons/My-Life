import React, { useState, useMemo } from "react";
import { View, StyleSheet, Pressable, TextInput, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { HierarchicalTaskList } from "@/components/HierarchicalTaskList";
import { TASK_TYPES, TaskType } from "@/types";

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { tasks, categories } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = task.title.toLowerCase().includes(searchLower) ||
                           (task.description || "").toLowerCase().includes(searchLower);
      const matchesStatus = showCompleted ? true : task.status !== "completed";
      const matchesCategory = selectedCategory ? task.categoryId === selectedCategory : true;
      const matchesType = selectedType ? task.type === selectedType : true;
      return matchesSearch && matchesStatus && matchesCategory && matchesType;
    });
  }, [tasks, searchQuery, showCompleted, selectedCategory, selectedType]);

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedType(null);
    setSearchQuery("");
    setShowCompleted(false);
  };

  const hasFilters = selectedCategory || selectedType || searchQuery || showCompleted;

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    return { total, completed, pending, inProgress };
  }, [tasks]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search entries..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: showCompleted ? theme.primary + "20" : theme.backgroundDefault },
          ]}
          onPress={() => setShowCompleted(!showCompleted)}
        >
          <Feather
            name="check-circle"
            size={20}
            color={showCompleted ? theme.primary : theme.textSecondary}
          />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.statValue, { color: theme.primary }]}>{stats.total}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Total</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.statValue, { color: theme.success }]}>{stats.completed}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Done</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.statValue, { color: theme.warning }]}>{stats.inProgress}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Active</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.statValue, { color: theme.textSecondary }]}>{stats.pending}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</ThemedText>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <Pressable
            style={[
              styles.filterChip,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
              !selectedCategory && { borderColor: theme.primary },
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <ThemedText style={[styles.filterChipText, !selectedCategory && { color: theme.primary }]}>
              All Categories
            </ThemedText>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[
                styles.filterChip,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                selectedCategory === cat.id && { borderColor: cat.color, backgroundColor: cat.color + "15" },
              ]}
              onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            >
              <View style={[styles.filterDot, { backgroundColor: cat.color }]} />
              <ThemedText
                style={[styles.filterChipText, selectedCategory === cat.id && { color: cat.color }]}
                numberOfLines={1}
              >
                {cat.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.typeFiltersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          <Pressable
            style={[
              styles.filterChip,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
              !selectedType && { borderColor: theme.secondary },
            ]}
            onPress={() => setSelectedType(null)}
          >
            <ThemedText style={[styles.filterChipText, !selectedType && { color: theme.secondary }]}>
              All Types
            </ThemedText>
          </Pressable>
          {TASK_TYPES.map((t) => (
            <Pressable
              key={t.value}
              style={[
                styles.filterChip,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                selectedType === t.value && { borderColor: theme.secondary, backgroundColor: theme.secondary + "15" },
              ]}
              onPress={() => setSelectedType(selectedType === t.value ? null : t.value)}
            >
              <Feather name={t.icon as any} size={14} color={selectedType === t.value ? theme.secondary : theme.textSecondary} />
              <ThemedText
                style={[styles.filterChipText, selectedType === t.value && { color: theme.secondary }]}
              >
                {t.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {hasFilters ? (
        <Pressable style={styles.clearFilters} onPress={clearFilters}>
          <Feather name="x" size={14} color={theme.primary} />
          <ThemedText style={[styles.clearFiltersText, { color: theme.primary }]}>
            Clear filters
          </ThemedText>
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.content}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xxl + Spacing.fabSize,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <HierarchicalTaskList tasks={filteredTasks} showCategory filterType={selectedType} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  filtersContainer: {
    paddingBottom: Spacing.sm,
  },
  typeFiltersContainer: {
    paddingBottom: Spacing.sm,
  },
  filtersRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterChipText: {
    fontSize: 13,
  },
  clearFilters: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
});

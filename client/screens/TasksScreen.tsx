import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, TextInput } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { HierarchicalTaskList } from "@/components/HierarchicalTaskList";
import QuickListModal from "@/components/QuickListModal";
import { BriefToast } from "@/components/BriefToast";
import { MasterListSortSheet } from "@/components/MasterListSortSheet";
import { MasterListFilterSheet } from "@/components/MasterListFilterSheet";
import { Task } from "@/types";
import {
  applyEntriesFilters,
  countActiveFilters,
  DEFAULT_MASTERLIST_FILTERS,
  MasterListFilters,
  MasterListSortOption,
  sortMasterListTasks,
  SORT_OPTIONS,
} from "@/utils/masterListUtils";

const ENTRIES_SORT_OPTIONS = SORT_OPTIONS.filter((o) => o.value !== "manual");

function taskDirectlyMatches(task: Task, searchLower: string): boolean {
  return (
    task.title.toLowerCase().includes(searchLower) ||
    (task.description || "").toLowerCase().includes(searchLower)
  );
}

function buildAncestorBreadcrumb(task: Task, tasksMap: Map<string, Task>): string {
  const chain: string[] = [];
  let current = task.parentId ? tasksMap.get(task.parentId) : undefined;
  while (current) {
    chain.unshift(current.title);
    current = current.parentId ? tasksMap.get(current.parentId) : undefined;
  }
  return chain.join(" › ");
}

export default function TasksScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { tasks, categories } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [sortOption, setSortOption] = useState<MasterListSortOption>("recentlyAdded");
  const [filters, setFilters] = useState<MasterListFilters>(DEFAULT_MASTERLIST_FILTERS);
  const [quickListEntry, setQuickListEntry] = useState<Task | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchLower = searchQuery.trim().toLowerCase();
  const activeFilterCount = countActiveFilters(filters);

  const tasksMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showQuickListToast = useCallback((count: number) => {
    const message = count === 1 ? "1 item added" : `${count} items added`;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setToastMessage(null);
    }, 2500);
  }, []);

  const handleQuickList = useCallback((entry: Task) => {
    setQuickListEntry(entry);
  }, []);

  const flatSearchResults = useMemo(() => {
    if (!searchLower) return undefined;

    let matches = tasks.filter((t) => taskDirectlyMatches(t, searchLower));
    matches = applyEntriesFilters(matches, filters);
    matches = sortMasterListTasks(matches, sortOption, categories);

    const breadcrumbs: Record<string, string> = {};
    for (const task of matches) {
      if (!task.parentId) continue;
      const parent = tasksMap.get(task.parentId);
      if (parent && !taskDirectlyMatches(parent, searchLower)) {
        breadcrumbs[task.id] = buildAncestorBreadcrumb(task, tasksMap);
      }
    }

    return { tasks: matches, breadcrumbs };
  }, [tasks, searchLower, filters, sortOption, categories, tasksMap]);

  const filteredTasks = useMemo(() => {
    if (searchLower) return tasks;

    const filtered = applyEntriesFilters(tasks, filters);
    const roots = filtered.filter((t) => !t.parentId);
    const sortedRoots = sortMasterListTasks(roots, sortOption, categories).map((t, index) => ({
      ...t,
      sortOrder: index,
    }));
    const rootMap = new Map(sortedRoots.map((t) => [t.id, t]));

    return filtered.map((t) => {
      if (!t.parentId && rootMap.has(t.id)) {
        return rootMap.get(t.id)!;
      }
      return t;
    });
  }, [tasks, searchLower, filters, sortOption, categories]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pinned = tasks.filter((t) => t.isPinned).length;
    return { total, completed, pinned };
  }, [tasks]);

  const listTasks = searchLower ? flatSearchResults!.tasks : filteredTasks;

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
          <ThemedText style={[styles.statValue, { color: theme.warning }]}>{stats.pinned}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Pinned</ThemedText>
        </View>
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.controlButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          onPress={() => setShowSortSheet(true)}
        >
          <Feather name="sliders" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.controlButtonText, { color: theme.text }]}>
            Sort
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.controlButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          onPress={() => setShowFilterSheet(true)}
        >
          <Feather name="filter" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.controlButtonText, { color: theme.text }]}>
            {activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : "Filter"}
          </ThemedText>
        </Pressable>
      </View>

      <HierarchicalTaskList
        style={styles.content}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xxl + Spacing.fabSize,
        }}
        tasks={listTasks}
        showCategory
        flatSearchResults={flatSearchResults}
        onQuickList={handleQuickList}
        enableDrag={false}
      />

      {quickListEntry ? (
        <QuickListModal
          visible={quickListEntry !== null}
          parentEntry={quickListEntry}
          onClose={() => setQuickListEntry(null)}
          onSaved={(count) => {
            setQuickListEntry(null);
            showQuickListToast(count);
          }}
        />
      ) : null}

      <MasterListSortSheet
        visible={showSortSheet}
        selected={sortOption}
        onSelect={(option) => {
          setSortOption(option);
          setShowSortSheet(false);
        }}
        onClose={() => setShowSortSheet(false)}
        options={ENTRIES_SORT_OPTIONS}
      />

      <MasterListFilterSheet
        visible={showFilterSheet}
        filters={filters}
        categories={categories}
        onChange={setFilters}
        onClose={() => setShowFilterSheet(false)}
        variant="entries"
      />

      <BriefToast message={toastMessage} visible={toastVisible} />
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
  controlsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  controlButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
});

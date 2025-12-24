import React, { useState, useMemo } from "react";
import { View, ScrollView, StyleSheet, Pressable, Modal, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { LifeWheel } from "@/components/LifeWheel";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { LifeCategory } from "@/types";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { categories, tasks, events, deleteCategory, isLoading } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<LifeCategory | null>(null);

  const handleCategoryPress = (category: LifeCategory) => {
    navigation.navigate("CategoryDetail", { category });
  };

  const handleCategoryLongPress = (category: LifeCategory) => {
    setSelectedCategory(category);
  };

  const handleEditCategory = () => {
    if (selectedCategory) {
      navigation.navigate("AddCategory", { category: selectedCategory });
      setSelectedCategory(null);
    }
  };

  const handleDeleteCategory = () => {
    if (selectedCategory) {
      const taskCount = tasks.filter((t) => t.categoryId === selectedCategory.id).length;
      const message = taskCount > 0
        ? `Delete "${selectedCategory.name}" and ${taskCount} ${taskCount === 1 ? 'entry' : 'entries'}? They will be moved to Recycle Bin.`
        : `Delete "${selectedCategory.name}"? It will be moved to Recycle Bin.`;
      
      Alert.alert(
        "Delete Category",
        message,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              deleteCategory(selectedCategory.id);
              setSelectedCategory(null);
            },
          },
        ]
      );
    }
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    return { total, completed, pending, inProgress };
  }, [tasks]);

  const todayEvents = events.filter(
    (e) => e.startDate === new Date().toISOString().split("T")[0]
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>Loading...</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xxl + Spacing.fabSize,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
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
          <ThemedText style={[styles.statValue, { color: theme.secondary }]}>{todayEvents.length}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Today</ThemedText>
        </View>
      </View>

      <View style={styles.wheelSection}>
        <ThemedText style={styles.sectionTitle}>Your Life Wheel</ThemedText>
        <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          Tap a category to view details, long press to edit
        </ThemedText>
        {categories.length > 0 ? (
          <LifeWheel
            categories={categories}
            onCategoryPress={handleCategoryPress}
            onCategoryLongPress={handleCategoryLongPress}
          />
        ) : (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="plus-circle" size={48} color={theme.primary} />
            <ThemedText style={styles.emptyTitle}>Get Started</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Add your first life category to begin organizing your life
            </ThemedText>
          </View>
        )}
      </View>

      <Modal
        visible={selectedCategory !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCategory(null)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setSelectedCategory(null)}
        >
          <View style={styles.contextMenuContainer}>
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={[
                styles.contextMenu,
                { backgroundColor: isDark ? "rgba(26,26,26,0.9)" : "rgba(255,255,255,0.9)" },
              ]}
            >
              <Pressable
                style={({ pressed }) => [styles.contextMenuItem, pressed && { opacity: 0.7 }]}
                onPress={handleEditCategory}
              >
                <Feather name="edit-2" size={20} color={theme.text} />
                <ThemedText style={styles.contextMenuText}>Edit Category</ThemedText>
              </Pressable>
              <View style={[styles.contextSeparator, { backgroundColor: theme.border }]} />
              <Pressable
                style={({ pressed }) => [styles.contextMenuItem, pressed && { opacity: 0.7 }]}
                onPress={handleDeleteCategory}
              >
                <Feather name="trash-2" size={20} color={theme.error} />
                <ThemedText style={[styles.contextMenuText, { color: theme.error }]}>
                  Delete Category
                </ThemedText>
              </Pressable>
            </BlurView>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  wheelSection: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  sectionSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xxl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  contextMenuContainer: {
    width: "70%",
    maxWidth: 280,
  },
  contextMenu: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  contextMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  contextMenuText: {
    fontSize: 16,
    fontWeight: "500",
  },
  contextSeparator: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
});

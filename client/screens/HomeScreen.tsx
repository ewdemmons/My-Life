import React, { useState } from "react";
import { View, StyleSheet, Pressable, Modal, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const appIcon = require("../../assets/images/icon.png");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { categories, tasks, deleteCategory, isLoading } = useApp();
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

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>Loading...</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.titleRow}>
          <Image source={appIcon} style={styles.appIcon} />
          <ThemedText style={styles.appTitle}>My Life</ThemedText>
        </View>
      </View>

      <View style={styles.heroSection}>
        <ThemedText style={styles.headline}>Balance Your World</ThemedText>
        <ThemedText style={[styles.subheadline, { color: theme.textSecondary }]}>
          Everything that matters, organized in one place.
        </ThemedText>
      </View>

      <View style={styles.wheelContainer}>
        {categories.length > 0 ? (
          <LifeWheel
            categories={categories}
            onCategoryPress={handleCategoryPress}
            onCategoryLongPress={handleCategoryLongPress}
            enlarged
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

      <View style={{ height: tabBarHeight }} />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: Spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroSection: {
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    alignItems: "center",
  },
  headline: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subheadline: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  wheelContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xxl,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
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

import React, { useMemo, useRef, useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Modal, Alert, Animated, Easing, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useAuth } from "@/context/AuthContext";
import { hasFullControlAccess } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

const ZONE_1_HEIGHT = 160;
const TIP_ROW_HEIGHT = 50;
const FAB_ZONE_HEIGHT = 90;
const FAB_SIZE = 64;
const appIcon = require("../../assets/images/icon.png");
const TIP_MESSAGES = [
  "Customize your Life Wheel based on what matters most",
  "Tap the center icon to see your Master List",
  "Ask your Life Coach for help with anything",
  "Pin your most important entries to the Master List",
];

interface HomeScreenProps {
  onOpenCapture?: () => void;
}

export default function HomeScreen({ onOpenCapture }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { categories, tasks, deleteCategory, isLoading } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<LifeCategory | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const tipOpacity = useRef(new Animated.Value(1)).current;
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadDisplayName = async () => {
      if (!user?.id) {
        setDisplayName(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      setDisplayName(data?.display_name?.trim() || null);
    };
    loadDisplayName();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-display-name-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { display_name?: string | null };
          setDisplayName(row.display_name?.trim() || null);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    let isCancelled = false;

    const scheduleTipCycle = () => {
      tipTimer.current = setTimeout(() => {
        Animated.timing(tipOpacity, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished || isCancelled) return;
          setTipIndex((prev) => (prev + 1) % TIP_MESSAGES.length);
          Animated.timing(tipOpacity, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }).start(({ finished: didFadeIn }) => {
            if (didFadeIn && !isCancelled) {
              scheduleTipCycle();
            }
          });
        });
      }, 5000);
    };

    scheduleTipCycle();
    return () => {
      isCancelled = true;
      if (tipTimer.current) {
        clearTimeout(tipTimer.current);
      }
      tipOpacity.stopAnimation();
    };
  }, [tipOpacity]);

  const greetingText = useMemo(() => {
    if (!displayName) {
      return "Welcome back 👋";
    }
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return `Good morning, ${displayName} 👋`;
    if (hour >= 12 && hour < 17) return `Good afternoon, ${displayName} 👋`;
    if (hour >= 17 && hour < 21) return `Good evening, ${displayName} 👋`;
    return `Hey ${displayName} 👋`;
  }, [displayName]);

  const handleTipPress = () => {
    if (tipIndex === 1 || tipIndex === 3) {
      (navigation as any).navigate("TasksTab");
      return;
    }
    if (tipIndex === 2) {
      (navigation.getParent() as NativeStackNavigationProp<RootStackParamList> | undefined)?.navigate("AssistantChat", {});
    }
  };

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

  const canEditCategory = (category: LifeCategory | null) => {
    if (!category || !user) return false;
    return hasFullControlAccess(user.id, category.id, categories);
  };

  const canDeleteCategory = (category: LifeCategory | null) => {
    if (!category) return false;
    return !category.isShared;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>Loading...</ThemedText>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundRoot }]} edges={["top", "left", "right"]}>
      <View style={styles.zone1}>
        <View style={styles.zone1HeaderRow}>
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Image source={appIcon} style={styles.appIcon} />
              <ThemedText style={styles.appTitle}>My Life</ThemedText>
            </View>
            <View style={styles.headerButtons}>
              <Pressable
                style={[styles.headerButton, { backgroundColor: theme.backgroundDefault }]}
                onPress={() => navigation.navigate("Notifications")}
              >
                <Feather name="bell" size={20} color={theme.text} />
              </Pressable>
              <Pressable
                style={[styles.headerButton, { backgroundColor: theme.backgroundDefault }]}
                onPress={() => navigation.navigate("Profile")}
              >
                <Feather name="user" size={20} color={theme.text} />
              </Pressable>
            </View>
          </View>
        </View>
        <View style={styles.zone1GreetingRow}>
          <ThemedText style={styles.headline} numberOfLines={1}>
            {greetingText}
          </ThemedText>
        </View>
        <View style={styles.zone1TipRow}>
          <Pressable style={styles.tipPressable} onPress={handleTipPress}>
            <Animated.Text
              style={[
                styles.subheadline,
                { color: theme.textSecondary, opacity: tipOpacity },
              ]}
              numberOfLines={2}
            >
              {TIP_MESSAGES[tipIndex]}
            </Animated.Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.mainContent}>
        <View style={styles.wheelZone}>
          {categories.length > 0 ? (
            <LifeWheel
              categories={categories}
              onCategoryPress={handleCategoryPress}
              onCategoryLongPress={handleCategoryLongPress}
              onCenterPress={() => navigation.navigate("CentralDashboard")}
            />
          ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="plus-circle" size={48} color={theme.primary} />
              <ThemedText style={styles.emptyTitle}>Get Started</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Add your first Life Area to begin organizing your life
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.fabZone}>
          <View style={styles.fabRow}>
            <View style={styles.fabColumn}>
              <Pressable
                style={[styles.actionFab, { backgroundColor: "#F59E0B" }]}
                onPress={() => (navigation.getParent() as NativeStackNavigationProp<RootStackParamList> | undefined)?.navigate("AssistantChat", {})}
              >
                <Feather name="zap" size={28} color="#FFFFFF" />
              </Pressable>
              <ThemedText style={[styles.fabLabel, { color: theme.buttonText, opacity: 0.78 }]}>
                Life Coach
              </ThemedText>
            </View>
            <View style={styles.fabColumn}>
              <Pressable
                style={[styles.actionFab, styles.captureFab, { backgroundColor: theme.primary }]}
                onPress={onOpenCapture}
                accessibilityLabel="Capture"
              >
                <Feather name="plus" size={28} color="#FFFFFF" />
              </Pressable>
              <ThemedText style={[styles.fabLabel, { color: theme.buttonText, opacity: 0.78 }]}>
                Capture
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: tabBarHeight + insets.bottom }} />

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
              {selectedCategory?.isShared ? (
                <View style={styles.sharedInfo}>
                  <Feather name="users" size={16} color={theme.primary} />
                  <ThemedText style={[styles.sharedInfoText, { color: theme.textSecondary }]}>
                    Shared with you ({selectedCategory.sharePermission === "view" ? "View only" : 
                      selectedCategory.sharePermission === "edit" ? "Can edit" : "Co-owner"})
                  </ThemedText>
                </View>
              ) : null}
              {canEditCategory(selectedCategory) ? (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.contextMenuItem, pressed && { opacity: 0.7 }]}
                    onPress={handleEditCategory}
                  >
                    <Feather name="edit-2" size={20} color={theme.text} />
                    <ThemedText style={styles.contextMenuText}>Edit Category</ThemedText>
                  </Pressable>
                  {canDeleteCategory(selectedCategory) ? (
                    <View style={[styles.contextSeparator, { backgroundColor: theme.border }]} />
                  ) : null}
                </>
              ) : null}
              {canDeleteCategory(selectedCategory) ? (
                <Pressable
                  style={({ pressed }) => [styles.contextMenuItem, pressed && { opacity: 0.7 }]}
                  onPress={handleDeleteCategory}
                >
                  <Feather name="trash-2" size={20} color={theme.error} />
                  <ThemedText style={[styles.contextMenuText, { color: theme.error }]}>
                    Delete Category
                  </ThemedText>
                </Pressable>
              ) : null}
              {selectedCategory?.isShared && selectedCategory.sharePermission === "view" ? (
                <ThemedText style={[styles.viewOnlyHint, { color: theme.textSecondary }]}>
                  You can view entries in this Life Area
                </ThemedText>
              ) : null}
            </BlurView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
  mainContent: {
    flex: 1,
  },
  zone1: {
    height: ZONE_1_HEIGHT,
    paddingHorizontal: Spacing.lg,
  },
  zone1HeaderRow: {
    flex: 1,
    justifyContent: "center",
  },
  zone1GreetingRow: {
    flex: 1,
    justifyContent: "center",
  },
  zone1TipRow: {
    height: TIP_ROW_HEIGHT,
    justifyContent: "center",
    paddingVertical: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  tipPressable: {
    width: "100%",
    flex: 1,
    justifyContent: "center",
  },
  subheadline: {
    fontSize: 15,
    fontWeight: "400",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  wheelZone: {
    flex: 1,
    alignSelf: "stretch",
  },
  fabZone: {
    height: FAB_ZONE_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  fabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  fabColumn: {
    width: FAB_SIZE,
    alignItems: "center",
  },
  actionFab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  captureFab: {
    overflow: "hidden",
  },
  fabLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    width: FAB_SIZE,
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
  sharedInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  sharedInfoText: {
    fontSize: 13,
    fontWeight: "500",
  },
  viewOnlyHint: {
    fontSize: 12,
    textAlign: "center",
    padding: Spacing.md,
    fontStyle: "italic",
  },
  pinnedSection: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  pinnedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pinnedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pinnedTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  pinnedList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  pinnedCard: {
    width: 140,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  pinnedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unpinBtn: {
    padding: 2,
  },
  pinnedTaskTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
    minHeight: 36,
  },
  pinnedCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

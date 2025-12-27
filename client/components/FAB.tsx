import React, { useState } from "react";
import { View, Pressable, StyleSheet, Modal, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FABProps {
  onAddCategory: () => void;
  onAddTask: () => void;
  onAddEvent?: () => void;
  onAddPerson?: () => void;
}

const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 50 });

export function FAB({ onAddCategory, onAddTask, onAddEvent, onAddPerson }: FABProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const scale = useSharedValue(1);

  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT + Spacing.lg;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    setIsOpen(true);
  };

  const handleAddCategory = () => {
    setIsOpen(false);
    onAddCategory();
  };

  const handleAddTask = () => {
    setIsOpen(false);
    onAddTask();
  };

  const handleAddEvent = () => {
    setIsOpen(false);
    if (onAddEvent) {
      onAddEvent();
    }
  };

  const handleAddPerson = () => {
    setIsOpen(false);
    if (onAddPerson) {
      onAddPerson();
    }
  };

  return (
    <>
      <AnimatedPressable
        style={[
          styles.fab,
          animatedStyle,
          {
            backgroundColor: theme.primary,
            bottom: bottomOffset,
          },
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </AnimatedPressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.menuContainer}>
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={[
                styles.menu,
                { backgroundColor: isDark ? "rgba(26,26,26,0.9)" : "rgba(255,255,255,0.9)" },
              ]}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={handleAddCategory}
              >
                <View style={[styles.menuIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="circle" size={20} color={theme.primary} />
                </View>
                <View style={styles.menuTextContainer}>
                  <ThemedText style={styles.menuTitle}>Add Life Category</ThemedText>
                  <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                    Create a new life area
                  </ThemedText>
                </View>
              </Pressable>
              <View style={[styles.separator, { backgroundColor: theme.border }]} />
              <Pressable
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={handleAddTask}
              >
                <View style={[styles.menuIcon, { backgroundColor: theme.secondary + "20" }]}>
                  <Feather name="check-square" size={20} color={theme.secondary} />
                </View>
                <View style={styles.menuTextContainer}>
                  <ThemedText style={styles.menuTitle}>Add Task</ThemedText>
                  <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                    Create a new task
                  </ThemedText>
                </View>
              </Pressable>
              {onAddEvent ? (
                <>
                  <View style={[styles.separator, { backgroundColor: theme.border }]} />
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuItem,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={handleAddEvent}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: theme.success + "20" }]}>
                      <Feather name="calendar" size={20} color={theme.success} />
                    </View>
                    <View style={styles.menuTextContainer}>
                      <ThemedText style={styles.menuTitle}>Schedule Event</ThemedText>
                      <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                        Add to your calendar
                      </ThemedText>
                    </View>
                  </Pressable>
                </>
              ) : null}
              {onAddPerson ? (
                <>
                  <View style={[styles.separator, { backgroundColor: theme.border }]} />
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuItem,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={handleAddPerson}
                  >
                    <View style={[styles.menuIcon, { backgroundColor: "#F472B6" + "20" }]}>
                      <Feather name="user-plus" size={20} color="#F472B6" />
                    </View>
                    <View style={styles.menuTextContainer}>
                      <ThemedText style={styles.menuTitle}>Add Person</ThemedText>
                      <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                        Add someone to your contacts
                      </ThemedText>
                    </View>
                  </Pressable>
                </>
              ) : null}
            </BlurView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const FAB_SIZE = 56;

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    overflow: "hidden",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    width: "80%",
    maxWidth: 320,
  },
  menu: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
  },
  separator: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
});

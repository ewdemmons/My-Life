import React, { useState, useLayoutEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { HeaderButton, useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteParams = RouteProp<RootStackParamList, "AddTask">;

const PRIORITIES = ["low", "medium", "high"] as const;

export default function AddTaskScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { categories, addTask } = useApp();

  const preselectedCategoryId = route.params?.categoryId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(preselectedCategoryId || categories[0]?.id || "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);

  const isValid = title.trim().length > 0 && categoryId;

  const handleSave = useCallback(async () => {
    if (!title.trim() || !categoryId) return;
    await addTask({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      parentId: route.params?.parentTaskId || null,
      dueDate,
      priority,
      status: "pending",
    });
    navigation.goBack();
  }, [title, description, categoryId, priority, dueDate, route.params?.parentTaskId, addTask, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.goBack()}>
          <ThemedText style={{ color: theme.primary }}>Cancel</ThemedText>
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton onPress={handleSave} disabled={!isValid}>
          <ThemedText style={{ color: isValid ? theme.primary : theme.textSecondary, fontWeight: "600" }}>
            Save
          </ThemedText>
        </HeaderButton>
      ),
    });
  }, [navigation, isValid, theme, handleSave]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.section}>
        <ThemedText style={styles.label}>Title</ThemedText>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="What needs to be done?"
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
          autoFocus
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Description (Optional)</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="Add more details..."
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Life Category</ThemedText>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[
                styles.categoryOption,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                categoryId === cat.id && { borderColor: cat.color, borderWidth: 2 },
              ]}
              onPress={() => setCategoryId(cat.id)}
            >
              <View
                style={[styles.categoryDot, { backgroundColor: cat.color }]}
              />
              <ThemedText style={styles.categoryName} numberOfLines={1}>
                {cat.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Priority</ThemedText>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => (
            <Pressable
              key={p}
              style={[
                styles.priorityOption,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                priority === p && {
                  borderColor:
                    p === "high" ? theme.error : p === "medium" ? theme.warning : theme.success,
                  borderWidth: 2,
                },
              ]}
              onPress={() => setPriority(p)}
            >
              <Feather
                name={p === "high" ? "alert-circle" : p === "medium" ? "minus-circle" : "check-circle"}
                size={20}
                color={
                  priority === p
                    ? p === "high"
                      ? theme.error
                      : p === "medium"
                      ? theme.warning
                      : theme.success
                    : theme.textSecondary
                }
              />
              <ThemedText
                style={[
                  styles.priorityText,
                  priority === p && { fontWeight: "600" },
                ]}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Due Date</ThemedText>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textSecondary}
          value={dueDate}
          onChangeText={setDueDate}
        />
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  input: {
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.full,
  },
  categoryName: {
    fontSize: 14,
  },
  priorityRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  priorityOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  priorityText: {
    fontSize: 13,
  },
});

import React, { useState, useLayoutEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Pressable, TextInput, ScrollView, Modal } from "react-native";
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
import { TaskType, TASK_TYPES, Task } from "@/types";

type RouteParams = RouteProp<RootStackParamList, "AddTask">;

const PRIORITIES = ["low", "medium", "high"] as const;

export default function AddTaskScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { categories, tasks, addTask, updateTask } = useApp();

  const preselectedCategoryId = route.params?.categoryId;
  const preselectedParentId = route.params?.parentTaskId;
  const editingTask = route.params?.task;
  const isEditing = !!editingTask;

  const [title, setTitle] = useState(editingTask?.title || "");
  const [description, setDescription] = useState(editingTask?.description || "");
  const [taskType, setTaskType] = useState<TaskType>(editingTask?.type || "task");
  const [categoryId, setCategoryId] = useState(editingTask?.categoryId || preselectedCategoryId || categories[0]?.id || "");
  const [parentId, setParentId] = useState<string | null>(editingTask?.parentId || preselectedParentId || null);
  const [priority, setPriority] = useState<"low" | "medium" | "high">(editingTask?.priority || "medium");
  const [dueDate, setDueDate] = useState(editingTask?.dueDate || new Date().toISOString().split("T")[0]);
  const [showParentPicker, setShowParentPicker] = useState(false);

  const isValid = title.trim().length > 0 && categoryId;

  const potentialParents = useMemo(() => {
    return tasks.filter((t) => {
      if (isEditing && t.id === editingTask?.id) return false;
      if (t.categoryId !== categoryId) return false;
      return true;
    });
  }, [tasks, categoryId, isEditing, editingTask?.id]);

  const selectedParent = parentId ? tasks.find((t) => t.id === parentId) : null;

  const handleSave = useCallback(async () => {
    if (!title.trim() || !categoryId) return;
    
    if (isEditing && editingTask) {
      await updateTask(editingTask.id, {
        title: title.trim(),
        description: description.trim(),
        type: taskType,
        categoryId,
        parentId,
        dueDate,
        priority,
      });
    } else {
      await addTask({
        title: title.trim(),
        description: description.trim(),
        type: taskType,
        categoryId,
        parentId,
        dueDate,
        priority,
        status: "pending",
      });
    }
    navigation.goBack();
  }, [title, description, taskType, categoryId, parentId, priority, dueDate, isEditing, editingTask, addTask, updateTask, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: isEditing ? "Edit Entry" : "Add Entry",
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
  }, [navigation, isEditing, isValid, theme, handleSave]);

  return (
    <>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <View style={styles.section}>
          <ThemedText style={styles.label}>Type</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
            <View style={styles.typeRow}>
              {TASK_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[
                    styles.typeOption,
                    { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                    taskType === t.value && { borderColor: theme.primary, borderWidth: 2 },
                  ]}
                  onPress={() => setTaskType(t.value)}
                >
                  <Feather
                    name={t.icon as any}
                    size={18}
                    color={taskType === t.value ? theme.primary : theme.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.typeText,
                      taskType === t.value && { color: theme.primary, fontWeight: "600" },
                    ]}
                  >
                    {t.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Title *</ThemedText>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="What needs to be done?"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
            autoFocus={!isEditing}
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
                onPress={() => {
                  setCategoryId(cat.id);
                  if (parentId) {
                    const parentTask = tasks.find((t) => t.id === parentId);
                    if (parentTask && parentTask.categoryId !== cat.id) {
                      setParentId(null);
                    }
                  }
                }}
              >
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <ThemedText style={styles.categoryName} numberOfLines={1}>
                  {cat.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.label}>Parent Entry (Optional)</ThemedText>
          <Pressable
            style={[
              styles.parentSelector,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
            onPress={() => setShowParentPicker(true)}
          >
            {selectedParent ? (
              <View style={styles.parentSelected}>
                <Feather
                  name={TASK_TYPES.find((t) => t.value === selectedParent.type)?.icon as any || "check-square"}
                  size={16}
                  color={theme.text}
                />
                <ThemedText style={styles.parentText} numberOfLines={1}>
                  {selectedParent.title}
                </ThemedText>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setParentId(null);
                  }}
                  hitSlop={8}
                >
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.parentPlaceholder}>
                <Feather name="link" size={16} color={theme.textSecondary} />
                <ThemedText style={[styles.parentText, { color: theme.textSecondary }]}>
                  Link to a parent entry...
                </ThemedText>
              </View>
            )}
          </Pressable>
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
                    borderColor: p === "high" ? theme.error : p === "medium" ? theme.warning : theme.success,
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
                      ? p === "high" ? theme.error : p === "medium" ? theme.warning : theme.success
                      : theme.textSecondary
                  }
                />
                <ThemedText style={[styles.priorityText, priority === p && { fontWeight: "600" }]}>
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

      <Modal
        visible={showParentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParentPicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Parent Entry</ThemedText>
              <Pressable onPress={() => setShowParentPicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList}>
              {potentialParents.length === 0 ? (
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No entries available in this category
                </ThemedText>
              ) : (
                potentialParents.map((task) => (
                  <Pressable
                    key={task.id}
                    style={[
                      styles.modalItem,
                      { borderBottomColor: theme.border },
                      parentId === task.id && { backgroundColor: theme.primary + "20" },
                    ]}
                    onPress={() => {
                      setParentId(task.id);
                      setShowParentPicker(false);
                    }}
                  >
                    <Feather
                      name={TASK_TYPES.find((t) => t.value === task.type)?.icon as any || "check-square"}
                      size={18}
                      color={theme.text}
                    />
                    <View style={styles.modalItemText}>
                      <ThemedText numberOfLines={1}>{task.title}</ThemedText>
                      <ThemedText style={[styles.modalItemType, { color: theme.textSecondary }]}>
                        {TASK_TYPES.find((t) => t.value === task.type)?.label || "Task"}
                      </ThemedText>
                    </View>
                    {parentId === task.id ? (
                      <Feather name="check" size={18} color={theme.primary} />
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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
  typeScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  typeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  typeText: {
    fontSize: 13,
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
  parentSelector: {
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    padding: Spacing.md,
  },
  parentSelected: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  parentPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  parentText: {
    flex: 1,
    fontSize: 16,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalList: {
    padding: Spacing.lg,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  modalItemText: {
    flex: 1,
  },
  modalItemType: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
});

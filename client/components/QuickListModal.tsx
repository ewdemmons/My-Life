import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import { Task, TaskType, getTaskTypeInfo } from "@/types";
import { generateUUID } from "@/utils/recurrence";
import { Spacing } from "@/constants/theme";

const ACCENT = "#6B7FFF";

const QUICK_LIST_SUB_TYPE: Record<string, string> = {
  task: "subtask",
  goal: "task",
  objective: "task",
  project: "task",
  list: "item",
  idea: "item",
  resource: "item",
  subtask: "item",
  item: "item",
};

export interface QuickListModalProps {
  visible: boolean;
  parentEntry: Task;
  onClose: () => void;
  onSaved: (count: number) => void;
}

type PendingItem = { id: string; title: string };

function QuickListModal({
  visible,
  parentEntry,
  onClose,
  onSaved,
}: QuickListModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { addTask, categories } = useApp();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500 });

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const subType = (QUICK_LIST_SUB_TYPE[parentEntry.type] ?? "item") as TaskType;
  const subLabel = getTaskTypeInfo(subType).label;
  const subLabelLower = subLabel.toLowerCase();

  const lifeAreaColor = useMemo(
    () =>
      categories.find((c) => c.id === parentEntry.categoryId)?.color ??
      theme.primary,
    [categories, parentEntry.categoryId, theme.primary],
  );

  useEffect(() => {
    if (!visible) {
      setPendingItems([]);
      setInputText("");
      setIsSaving(false);
    }
  }, [visible]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const addItem = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || isSaving) return;

    setPendingItems((prev) => [...prev, { id: generateUUID(), title: trimmed }]);
    setInputText("");
    inputRef.current?.focus();
    scrollToEnd();
  }, [inputText, isSaving, scrollToEnd]);

  const removeItem = useCallback((id: string) => {
    setPendingItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClose = useCallback(() => {
    if (isSaving) return;

    if (pendingItems.length > 0) {
      Alert.alert(
        "Discard items?",
        `You have ${pendingItems.length} unsaved items.`,
        [
          { text: "Keep Editing", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: onClose },
        ],
      );
      return;
    }

    onClose();
  }, [isSaving, pendingItems.length, onClose]);

  const handleDone = useCallback(async () => {
    if (pendingItems.length === 0 || isSaving) return;

    setIsSaving(true);

    const performSave = async () => {
      for (const item of pendingItems) {
        await addTask({
          title: item.title,
          type: subType,
          categoryId: parentEntry.categoryId,
          parentId: parentEntry.id,
          priority: "medium",
          status: "pending",
          description: "",
        });
      }

      const count = pendingItems.length;
      onSaved(count);
      onClose();
    };

    setRetry(() => {
      void handleDone();
    });

    const result = await withSaveIndicator(performSave, {
      errorMessage: "Failed to save some items.",
    });

    if (result === null) {
      setIsSaving(false);
    }
  }, [
    pendingItems,
    isSaving,
    addTask,
    subType,
    parentEntry.categoryId,
    parentEntry.id,
    onSaved,
    onClose,
    withSaveIndicator,
    setRetry,
  ]);

  const canAdd = inputText.trim().length > 0 && !isSaving;
  const canDone = pendingItems.length > 0 && !isSaving;

  const doneLabel =
    pendingItems.length > 0 ? `Done (${pendingItems.length})` : "Done";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + Spacing.sm,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            disabled={isSaving}
            style={[styles.headerSide, isSaving && styles.disabled]}
          >
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Quick List
          </Text>

          <Pressable
            onPress={handleDone}
            hitSlop={8}
            disabled={!canDone}
            style={styles.headerSide}
          >
            {isSaving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={ACCENT} />
                <Text style={[styles.doneButton, { color: ACCENT }]}>
                  Saving...
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.doneButton,
                  { color: canDone ? ACCENT : theme.textSecondary },
                  !canDone && styles.doneDisabled,
                ]}
              >
                {doneLabel}
              </Text>
            )}
          </Pressable>
        </View>

        <Text
          style={[styles.subtitle, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {`Adding ${subLabel}s to: ${parentEntry.title}`}
        </Text>

        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            pendingItems.length === 0 && styles.listContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {pendingItems.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Items you add will appear here
            </Text>
          ) : (
            pendingItems.map((item, index) => (
              <View key={item.id}>
                <View style={styles.itemRow}>
                  <View
                    style={[styles.dot, { backgroundColor: lifeAreaColor }]}
                  />
                  <Text
                    style={[styles.itemTitle, { color: theme.text }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Pressable
                    onPress={() => removeItem(item.id)}
                    hitSlop={8}
                    disabled={isSaving}
                    style={isSaving ? styles.disabled : undefined}
                  >
                    <Feather
                      name="x"
                      size={18}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                </View>
                {index < pendingItems.length - 1 ? (
                  <View
                    style={[styles.separator, { backgroundColor: theme.border }]}
                  />
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View
            style={[
              styles.inputArea,
              {
                paddingBottom: insets.bottom + Spacing.md,
                borderTopColor: theme.border,
                backgroundColor: theme.backgroundRoot,
              },
            ]}
          >
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                  isSaving && styles.disabled,
                ]}
                placeholder={`Add ${subLabelLower}...`}
                placeholderTextColor={theme.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={addItem}
                returnKeyType="done"
                blurOnSubmit={false}
                autoFocus={visible}
                editable={!isSaving}
              />
              <Pressable
                onPress={addItem}
                disabled={!canAdd}
                style={[
                  styles.addButton,
                  !canAdd && styles.addButtonDisabled,
                ]}
              >
                <Text style={styles.addButtonText}>Add →</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>

        <SaveToast
          state={toastState}
          message={toastMessage}
          onRetry={retryFn ?? undefined}
          onDismiss={dismiss}
        />
      </View>
    </Modal>
  );
}

export default QuickListModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerSide: {
    minWidth: 72,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  doneButton: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  doneDisabled: {
    opacity: 0.4,
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  inputArea: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  addButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.4,
  },
});

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Habit, HabitType, GoalFrequency, HABIT_TYPES, GOAL_FREQUENCIES, Task } from "@/types";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

interface AddHabitModalProps {
  visible: boolean;
  onClose: () => void;
  categoryId: string;
  editingHabit?: Habit | null;
  linkedTask?: Task | null;
}

export function AddHabitModal({ visible, onClose, categoryId, editingHabit, linkedTask }: AddHabitModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { addHabit, updateHabit, deleteHabit } = useApp();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [habitType, setHabitType] = useState<HabitType>("positive");
  const [goalFrequency, setGoalFrequency] = useState<GoalFrequency>("daily");
  const [goalCount, setGoalCount] = useState("1");
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editingHabit) {
        setName(editingHabit.name);
        setDescription(editingHabit.description || "");
        setHabitType(editingHabit.habitType);
        setGoalFrequency(editingHabit.goalFrequency);
        setGoalCount(editingHabit.goalCount.toString());
      } else if (linkedTask) {
        setName(linkedTask.title);
        setDescription(linkedTask.description || "");
        setHabitType("positive");
        setGoalFrequency("daily");
        setGoalCount("1");
      } else {
        resetForm();
      }
    }
  }, [visible, editingHabit, linkedTask]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setHabitType("positive");
    setGoalFrequency("daily");
    setGoalCount("1");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a habit name");
      return;
    }

    const count = parseInt(goalCount, 10);
    if (isNaN(count) || count < 1) {
      Alert.alert("Invalid", "Goal count must be at least 1");
      return;
    }

    setIsSaving(true);
    try {
      const habitData = {
        name: name.trim(),
        description: description.trim() || undefined,
        habitType,
        goalFrequency,
        goalCount: count,
        categoryId,
        linkedTaskId: linkedTask?.id || null,
        isActive: true,
      };

      if (editingHabit) {
        await updateHabit(editingHabit.id, habitData);
      } else {
        await addHabit(habitData);
      }

      resetForm();
      onClose();
    } catch (error) {
      Alert.alert("Error", "Failed to save habit. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingHabit) return;

    Alert.alert(
      "Delete Habit",
      `Are you sure you want to delete "${editingHabit.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteHabit(editingHabit.id);
              resetForm();
              onClose();
            } catch (error) {
              Alert.alert("Error", "Failed to delete habit. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getFrequencyLabel = (freq: GoalFrequency) => {
    return GOAL_FREQUENCIES.find((f) => f.value === freq)?.label || freq;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={handleClose}>
            <ThemedText style={[styles.cancelButton, { color: theme.textSecondary }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>
            {editingHabit ? "Edit Habit" : "Add Habit"}
          </ThemedText>
          <Pressable onPress={handleSave} disabled={isSaving}>
            <ThemedText style={[styles.saveButton, { color: theme.primary, opacity: isSaving ? 0.5 : 1 }]}>
              Save
            </ThemedText>
          </Pressable>
        </View>

        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Name *</ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Exercise, Read, No Smoking"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Description</ThemedText>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Habit Type</ThemedText>
            <View style={styles.segmentedControl}>
              {HABIT_TYPES.map((type) => {
                const isSelected = habitType === type.value;
                return (
                  <Pressable
                    key={type.value}
                    style={[
                      styles.segmentButton,
                      { borderColor: theme.border },
                      isSelected && { backgroundColor: type.color + "20", borderColor: type.color },
                    ]}
                    onPress={() => setHabitType(type.value)}
                  >
                    <Feather
                      name={type.icon as any}
                      size={18}
                      color={isSelected ? type.color : theme.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.segmentText,
                        { color: isSelected ? type.color : theme.textSecondary },
                      ]}
                    >
                      {type.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
              {habitType === "positive"
                ? "Track habits you want to build (e.g., exercise, meditation)"
                : "Track habits you want to reduce (e.g., smoking, junk food)"}
            </ThemedText>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Goal Frequency</ThemedText>
            <Pressable
              style={[
                styles.selector,
                { backgroundColor: theme.backgroundRoot, borderColor: theme.border },
              ]}
              onPress={() => setShowFrequencyPicker(true)}
            >
              <Feather name="repeat" size={18} color={theme.primary} />
              <ThemedText style={[styles.selectorText, { color: theme.text }]}>
                {getFrequencyLabel(goalFrequency)}
              </ThemedText>
              <Feather name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Goal Count</ThemedText>
            <View style={styles.countRow}>
              <Pressable
                style={[styles.countButton, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
                onPress={() => {
                  const current = parseInt(goalCount, 10) || 1;
                  if (current > 1) setGoalCount((current - 1).toString());
                }}
              >
                <Feather name="minus" size={20} color={theme.text} />
              </Pressable>
              <TextInput
                style={[
                  styles.countInput,
                  { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
                ]}
                value={goalCount}
                onChangeText={setGoalCount}
                keyboardType="number-pad"
                textAlign="center"
              />
              <Pressable
                style={[styles.countButton, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
                onPress={() => {
                  const current = parseInt(goalCount, 10) || 0;
                  setGoalCount((current + 1).toString());
                }}
              >
                <Feather name="plus" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
              How many times per {goalFrequency === "daily" ? "day" : goalFrequency === "weekly" ? "week" : "month"}?
            </ThemedText>
          </View>

          {editingHabit ? (
            <Pressable
              style={[styles.deleteButton, { borderColor: theme.error }]}
              onPress={handleDelete}
            >
              <Feather name="trash-2" size={18} color={theme.error} />
              <ThemedText style={[styles.deleteButtonText, { color: theme.error }]}>
                Delete Habit
              </ThemedText>
            </Pressable>
          ) : null}
        </KeyboardAwareScrollViewCompat>

        <Modal
          visible={showFrequencyPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFrequencyPicker(false)}
        >
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => setShowFrequencyPicker(false)}
          >
            <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.pickerTitle}>Select Frequency</ThemedText>
              {GOAL_FREQUENCIES.map((freq) => (
                <Pressable
                  key={freq.value}
                  style={[
                    styles.pickerOption,
                    goalFrequency === freq.value && { backgroundColor: theme.primary + "15" },
                  ]}
                  onPress={() => {
                    setGoalFrequency(freq.value);
                    setShowFrequencyPicker(false);
                  }}
                >
                  <ThemedText style={styles.pickerOptionText}>{freq.label}</ThemedText>
                  {goalFrequency === freq.value ? (
                    <Feather name="check" size={18} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  cancelButton: {
    fontSize: 16,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    minHeight: 80,
  },
  segmentedControl: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "500",
  },
  hint: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  countButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  countInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    fontSize: 18,
    fontWeight: "600",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  pickerContainer: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  pickerOptionText: {
    fontSize: 16,
  },
});

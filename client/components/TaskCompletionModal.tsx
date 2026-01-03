import React, { useState } from "react";
import { View, StyleSheet, Pressable, Modal, TextInput, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Task, CompletionType, COMPLETION_TYPES } from "@/types";
import { useApp } from "@/context/AppContext";

interface TaskCompletionModalProps {
  visible: boolean;
  task: Task;
  onClose: () => void;
  onComplete: () => void;
}

export function TaskCompletionModal({ visible, task, onClose, onComplete }: TaskCompletionModalProps) {
  const { theme } = useTheme();
  const { updateTask, addOccurrence, deleteTask, deleteOccurrence, habits } = useApp();
  
  const linkedHabit = habits.find(h => h.linkedTaskId === task.id);
  
  const [completionType, setCompletionType] = useState<CompletionType>(null);
  const [completionDate, setCompletionDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [showKeepRecyclePrompt, setShowKeepRecyclePrompt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  const formatDateForStorage = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const handleComplete = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    const dateStr = formatDateForStorage(completionDate);
    const createdOccurrenceIds: string[] = [];
    
    try {
      const taskOccurrence = await addOccurrence({
        itemId: task.id,
        itemType: "task",
        occurredAt: completionDate.getTime(),
        occurredDate: dateStr,
        notes: notes.trim() || undefined,
      });
      if (taskOccurrence?.id) {
        createdOccurrenceIds.push(taskOccurrence.id);
      }
      
      if (linkedHabit) {
        const habitOccurrence = await addOccurrence({
          itemId: linkedHabit.id,
          itemType: "habit",
          occurredAt: completionDate.getTime(),
          occurredDate: dateStr,
          notes: `Linked task: ${task.title}`,
        });
        if (habitOccurrence?.id) {
          createdOccurrenceIds.push(habitOccurrence.id);
        }
      }
      
      if (task.isRecurring) {
        if (completionType) {
          await updateTask(task.id, {
            completionType,
            completionDate: dateStr,
          });
        }
        
        setIsProcessing(false);
        onComplete();
        onClose();
      } else {
        await updateTask(task.id, {
          status: "completed",
          completionType,
          completionDate: completionType ? dateStr : undefined,
        });
        
        setIsProcessing(false);
        setShowKeepRecyclePrompt(true);
      }
    } catch (error) {
      for (const occId of createdOccurrenceIds) {
        try {
          await deleteOccurrence(occId);
        } catch (cleanupError) {
          console.warn("Failed to cleanup occurrence:", cleanupError);
        }
      }
      
      setIsProcessing(false);
      Alert.alert(
        "Error",
        "Failed to complete task. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const handleKeepTask = () => {
    setShowKeepRecyclePrompt(false);
    onComplete();
    onClose();
  };

  const handleRecycleTask = async () => {
    try {
      await deleteTask(task.id);
      setShowKeepRecyclePrompt(false);
      onComplete();
      onClose();
    } catch (error) {
      Alert.alert("Error", "Failed to recycle task. Please try again.");
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setCompletionDate(selectedDate);
    }
  };

  const resetState = () => {
    setCompletionType(null);
    setCompletionDate(new Date());
    setNotes("");
    setShowKeepRecyclePrompt(false);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (showKeepRecyclePrompt) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={[styles.modal, { backgroundColor: theme.backgroundDefault }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Feather name="check-circle" size={32} color={theme.success} />
              <ThemedText style={[styles.title, { marginTop: Spacing.md }]}>Task Completed</ThemedText>
            </View>
            
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              What would you like to do with this task?
            </ThemedText>

            <View style={styles.promptButtons}>
              <Pressable
                style={[styles.promptButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={handleKeepTask}
              >
                <Feather name="archive" size={20} color={theme.primary} />
                <ThemedText style={[styles.promptButtonText, { color: theme.text }]}>Keep</ThemedText>
                <ThemedText style={[styles.promptButtonSubtext, { color: theme.textSecondary }]}>
                  Keep for reference
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.promptButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={handleRecycleTask}
              >
                <Feather name="trash-2" size={20} color={theme.error} />
                <ThemedText style={[styles.promptButtonText, { color: theme.text }]}>Recycle</ThemedText>
                <ThemedText style={[styles.promptButtonSubtext, { color: theme.textSecondary }]}>
                  Move to recycle bin
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.modal, { backgroundColor: theme.backgroundDefault }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Complete Task</ThemedText>
            <Pressable onPress={handleClose} hitSlop={10}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ThemedText style={styles.taskTitle} numberOfLines={2}>{task.title}</ThemedText>
          
          {task.isRecurring ? (
            <View style={[styles.badge, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="repeat" size={14} color={theme.primary} />
              <ThemedText style={[styles.badgeText, { color: theme.primary }]}>Recurring Task</ThemedText>
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>Completion Type</ThemedText>
            <View style={styles.typeOptions}>
              {COMPLETION_TYPES.map((type) => (
                <Pressable
                  key={type.value || "standard"}
                  style={[
                    styles.typeOption,
                    { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                    completionType === type.value && { borderColor: theme.primary, borderWidth: 2 },
                  ]}
                  onPress={() => setCompletionType(type.value)}
                >
                  <ThemedText style={[styles.typeLabel, completionType === type.value && { color: theme.primary }]}>
                    {type.label}
                  </ThemedText>
                  <ThemedText style={[styles.typeDesc, { color: theme.textSecondary }]} numberOfLines={1}>
                    {type.description}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {completionType ? (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {completionType === "as_of" ? "Completed on" : "Complete until"}
              </ThemedText>
              <Pressable
                style={[styles.dateButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Feather name="calendar" size={18} color={theme.primary} />
                <ThemedText style={{ marginLeft: Spacing.sm }}>{formatDate(completionDate)}</ThemedText>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>Notes (optional)</ThemedText>
            <TextInput
              style={[styles.notesInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Add completion notes..."
              placeholderTextColor={theme.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>

          <Pressable
            style={[styles.completeButton, { backgroundColor: theme.success }]}
            onPress={handleComplete}
          >
            <Feather name="check" size={20} color="#FFFFFF" />
            <ThemedText style={styles.completeButtonText}>Mark Complete</ThemedText>
          </Pressable>

          {showDatePicker ? (
            <DateTimePicker
              value={completionDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              maximumDate={completionType === "as_of" ? new Date() : undefined}
              minimumDate={completionType === "until" ? new Date() : undefined}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  typeOptions: {
    gap: Spacing.sm,
  },
  typeOption: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  typeDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  notesInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 60,
    textAlignVertical: "top",
  },
  completeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  promptButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  promptButton: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  promptButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  promptButtonSubtext: {
    fontSize: 12,
    textAlign: "center",
  },
});

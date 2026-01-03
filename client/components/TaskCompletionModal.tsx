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
  
  const [mainOption, setMainOption] = useState<"complete" | "for_now">("complete");
  const [completeSubOption, setCompleteSubOption] = useState<"mark_complete" | "recycle">("mark_complete");
  const [completedOnDate, setCompletedOnDate] = useState(new Date());
  const [completeUntilDate, setCompleteUntilDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState<"completed_on" | "complete_until" | null>(null);
  const [notes, setNotes] = useState("");
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
    
    const completedOnStr = formatDateForStorage(completedOnDate);
    const createdOccurrenceIds: string[] = [];
    
    try {
      // 1. Log Occurrence
      const taskOccurrence = await addOccurrence({
        itemId: task.id,
        itemType: "task",
        occurredAt: completedOnDate.getTime(),
        occurredDate: completedOnStr,
        notes: notes.trim() || undefined,
      });
      if (taskOccurrence?.id) {
        createdOccurrenceIds.push(taskOccurrence.id);
      }
      
      if (linkedHabit) {
        const habitOccurrence = await addOccurrence({
          itemId: linkedHabit.id,
          itemType: "habit",
          occurredAt: completedOnDate.getTime(),
          occurredDate: completedOnStr,
          notes: `Linked task: ${task.title}`,
        });
        if (habitOccurrence?.id) {
          createdOccurrenceIds.push(habitOccurrence.id);
        }
      }
      
      // 2. Handle Task Status/Update
      if (mainOption === "for_now") {
        const untilStr = formatDateForStorage(completeUntilDate);
        await updateTask(task.id, {
          completionType: "until",
          completionDate: untilStr,
          status: "pending" // Remains pending but with "until" constraint
        });
      } else {
        // Option is "complete"
        if (completeSubOption === "recycle") {
          await deleteTask(task.id);
        } else {
          await updateTask(task.id, {
            status: "completed",
            completionType: "as_of",
            completionDate: completedOnStr
          });
        }
      }

      setIsProcessing(false);
      onComplete();
      onClose();
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
        "Failed to update task. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const type = showDatePicker;
    setShowDatePicker(null);
    if (selectedDate) {
      if (type === "completed_on") {
        setCompletedOnDate(selectedDate);
      } else if (type === "complete_until") {
        setCompleteUntilDate(selectedDate);
      }
    }
  };

  const resetState = () => {
    setMainOption("complete");
    setCompleteSubOption("mark_complete");
    setCompletedOnDate(new Date());
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setCompleteUntilDate(d);
    setNotes("");
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

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
          
          <View style={styles.mainOptions}>
            <Pressable 
              style={[
                styles.optionCard, 
                { borderColor: mainOption === "complete" ? theme.primary : theme.border },
                mainOption === "complete" && { borderWidth: 2 }
              ]}
              onPress={() => setMainOption("complete")}
            >
              <View style={styles.optionHeader}>
                <View style={[styles.radio, { borderColor: mainOption === "complete" ? theme.primary : theme.textSecondary }]}>
                  {mainOption === "complete" && <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />}
                </View>
                <ThemedText style={styles.optionLabel}>Complete</ThemedText>
              </View>
              <ThemedText style={[styles.optionDesc, { color: theme.textSecondary }]}>Mark as fully finished</ThemedText>
            </Pressable>

            <Pressable 
              style={[
                styles.optionCard, 
                { borderColor: mainOption === "for_now" ? theme.primary : theme.border },
                mainOption === "for_now" && { borderWidth: 2 }
              ]}
              onPress={() => setMainOption("for_now")}
            >
              <View style={styles.optionHeader}>
                <View style={[styles.radio, { borderColor: mainOption === "for_now" ? theme.primary : theme.textSecondary }]}>
                  {mainOption === "for_now" && <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />}
                </View>
                <ThemedText style={styles.optionLabel}>Complete for Now</ThemedText>
              </View>
              <ThemedText style={[styles.optionDesc, { color: theme.textSecondary }]}>Done until a specific date</ThemedText>
            </Pressable>
          </View>

          {mainOption === "complete" && (
            <View style={styles.subSection}>
              <View style={styles.subRadioGroup}>
                <Pressable style={styles.subRadioOption} onPress={() => setCompleteSubOption("mark_complete")}>
                  <View style={[styles.radioSmall, { borderColor: completeSubOption === "mark_complete" ? theme.primary : theme.textSecondary }]}>
                    {completeSubOption === "mark_complete" && <View style={[styles.radioInnerSmall, { backgroundColor: theme.primary }]} />}
                  </View>
                  <ThemedText style={styles.subRadioLabel}>Mark as complete</ThemedText>
                </Pressable>
                <Pressable style={styles.subRadioOption} onPress={() => setCompleteSubOption("recycle")}>
                  <View style={[styles.radioSmall, { borderColor: completeSubOption === "recycle" ? theme.primary : theme.textSecondary }]}>
                    {completeSubOption === "recycle" && <View style={[styles.radioInnerSmall, { backgroundColor: theme.primary }]} />}
                  </View>
                  <ThemedText style={styles.subRadioLabel}>Move to Recycle Bin</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {mainOption === "for_now" && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>Complete until</ThemedText>
              <Pressable
                style={[styles.dateButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                onPress={() => setShowDatePicker("complete_until")}
              >
                <Feather name="calendar" size={18} color={theme.primary} />
                <ThemedText style={{ marginLeft: Spacing.sm }}>{formatDate(completeUntilDate)}</ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>Completed On</ThemedText>
            <Pressable
              style={[styles.dateButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              onPress={() => setShowDatePicker("completed_on")}
            >
              <Feather name="clock" size={18} color={theme.primary} />
              <ThemedText style={{ marginLeft: Spacing.sm }}>{formatDate(completedOnDate)}</ThemedText>
            </Pressable>
          </View>

          <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>Notes (optional)</ThemedText>
            <TextInput
              style={[styles.notesInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Add completion notes..."
              placeholderTextColor={theme.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <Pressable
            style={[styles.completeButton, { backgroundColor: theme.success }]}
            onPress={handleComplete}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ThemedText style={styles.completeButtonText}>Processing...</ThemedText>
            ) : (
              <>
                <Feather name="check" size={20} color="#FFFFFF" />
                <ThemedText style={styles.completeButtonText}>Mark Complete</ThemedText>
              </>
            )}
          </Pressable>

          {showDatePicker ? (
            <DateTimePicker
              value={showDatePicker === "completed_on" ? completedOnDate : completeUntilDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              maximumDate={showDatePicker === "completed_on" ? new Date() : undefined}
              minimumDate={showDatePicker === "complete_until" ? new Date() : undefined}
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
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  mainOptions: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  optionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionDesc: {
    fontSize: 13,
    marginLeft: 32,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  subSection: {
    paddingLeft: 32,
    marginBottom: Spacing.sm,
  },
  subRadioGroup: {
    gap: Spacing.xs,
  },
  subRadioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  radioSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInnerSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subRadioLabel: {
    fontSize: 14,
  },
  section: {
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
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
    minHeight: 80,
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
});

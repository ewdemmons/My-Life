import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import {
  CalendarEvent,
  EventType,
  RecurrenceType,
  EVENT_TYPES,
  RECURRENCE_OPTIONS,
  Task,
} from "@/types";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface SchedulingModalProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: string;
  linkedTask?: Task | null;
  editingEvent?: CalendarEvent | null;
  preselectedCategoryId?: string;
}

export function SchedulingModal({
  visible,
  onClose,
  initialDate,
  linkedTask,
  editingEvent,
  preselectedCategoryId,
}: SchedulingModalProps) {
  const { theme } = useTheme();
  const { addEvent, updateEvent, deleteEvent, tasks, categories } = useApp();

  const getInitialStartDate = () => {
    if (editingEvent) return new Date(editingEvent.startDate + "T" + editingEvent.startTime);
    if (initialDate) return new Date(initialDate + "T09:00:00");
    return new Date();
  };

  const getInitialEndDate = () => {
    if (editingEvent) return new Date(editingEvent.endDate + "T" + editingEvent.endTime);
    const start = getInitialStartDate();
    return new Date(start.getTime() + 60 * 60 * 1000);
  };

  const [title, setTitle] = useState(editingEvent?.title || linkedTask?.title || "");
  const [description, setDescription] = useState(editingEvent?.description || "");
  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [endDate, setEndDate] = useState(getInitialEndDate());
  const [eventType, setEventType] = useState<EventType>(editingEvent?.eventType || "appointment");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(editingEvent?.recurrence || "none");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    editingEvent?.linkedTaskId || linkedTask?.id || null
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    editingEvent?.categoryId || linkedTask?.categoryId || preselectedCategoryId || null
  );

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showEventTypePicker, setShowEventTypePicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const isTimedEvent = eventType === "appointment" || eventType === "meeting";

  const openDateTimePicker = (picker: "startDate" | "startTime" | "endDate" | "endTime") => {
    setShowStartDatePicker(picker === "startDate");
    setShowStartTimePicker(picker === "startTime");
    setShowEndDatePicker(picker === "endDate");
    setShowEndTimePicker(picker === "endTime");
  };

  useEffect(() => {
    if (visible) {
      setTitle(editingEvent?.title || linkedTask?.title || "");
      setDescription(editingEvent?.description || linkedTask?.description || "");
      setStartDate(getInitialStartDate());
      setEndDate(getInitialEndDate());
      setEventType(editingEvent?.eventType || (linkedTask ? "reminder" : "appointment"));
      setRecurrence(editingEvent?.recurrence || "none");
      setSelectedTaskId(editingEvent?.linkedTaskId || linkedTask?.id || null);
      const initialCategory = editingEvent?.categoryId || linkedTask?.categoryId || preselectedCategoryId || (categories.length > 0 ? categories[0].id : null);
      setSelectedCategoryId(initialCategory);
    }
  }, [visible, editingEvent, linkedTask, initialDate, preselectedCategoryId, categories]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getTimeString = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowStartDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      const newStart = new Date(startDate);
      newStart.setFullYear(selectedDate.getFullYear());
      newStart.setMonth(selectedDate.getMonth());
      newStart.setDate(selectedDate.getDate());
      setStartDate(newStart);
      if (newStart > endDate) {
        setEndDate(new Date(newStart.getTime() + 60 * 60 * 1000));
      }
    }
  };

  const handleStartTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowStartTimePicker(Platform.OS === "ios");
    if (selectedDate) {
      const newStart = new Date(startDate);
      newStart.setHours(selectedDate.getHours());
      newStart.setMinutes(selectedDate.getMinutes());
      setStartDate(newStart);
      if (newStart >= endDate) {
        setEndDate(new Date(newStart.getTime() + 60 * 60 * 1000));
      }
    }
  };

  const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      const newEnd = new Date(endDate);
      newEnd.setFullYear(selectedDate.getFullYear());
      newEnd.setMonth(selectedDate.getMonth());
      newEnd.setDate(selectedDate.getDate());
      if (newEnd >= startDate) {
        setEndDate(newEnd);
      }
    }
  };

  const handleEndTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndTimePicker(Platform.OS === "ios");
    if (selectedDate) {
      const newEnd = new Date(endDate);
      newEnd.setHours(selectedDate.getHours());
      newEnd.setMinutes(selectedDate.getMinutes());
      if (newEnd > startDate) {
        setEndDate(newEnd);
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    const linkedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;
    const finalCategoryId = selectedCategoryId || linkedTask?.categoryId || null;

    const eventData = {
      title: title.trim(),
      description: description.trim(),
      startDate: getDateString(startDate),
      startTime: isTimedEvent ? getTimeString(startDate) : getTimeString(startDate),
      endDate: isTimedEvent ? getDateString(endDate) : getDateString(startDate),
      endTime: isTimedEvent ? getTimeString(endDate) : getTimeString(startDate),
      eventType,
      recurrence,
      linkedTaskId: selectedTaskId,
      categoryId: finalCategoryId,
    };

    if (editingEvent) {
      await updateEvent(editingEvent.id, eventData);
    } else {
      await addEvent(eventData);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (editingEvent) {
      await deleteEvent(editingEvent.id);
      onClose();
    }
  };

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;
  const selectedCategory = selectedCategoryId 
    ? categories.find((c) => c.id === selectedCategoryId)
    : selectedTask 
      ? categories.find((c) => c.id === selectedTask.categoryId)
      : null;

  const eventTypeInfo = EVENT_TYPES.find((e) => e.value === eventType);
  const recurrenceInfo = RECURRENCE_OPTIONS.find((r) => r.value === recurrence);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerButton}>
              <ThemedText style={[styles.cancelText, { color: theme.primary }]}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.headerTitle}>
              {editingEvent ? "Edit Event" : "New Event"}
            </ThemedText>
            <Pressable
              onPress={handleSave}
              style={[styles.headerButton, !title.trim() && { opacity: 0.5 }]}
              disabled={!title.trim()}
            >
              <ThemedText style={[styles.saveText, { color: theme.primary }]}>Save</ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="edit-3" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.titleInput, { color: theme.text }]}
                placeholder="Event title"
                placeholderTextColor={theme.textSecondary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={[styles.descriptionContainer, { backgroundColor: theme.backgroundDefault }]}>
              <TextInput
                style={[styles.descriptionInput, { color: theme.text }]}
                placeholder="Add description (optional)"
                placeholderTextColor={theme.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
              <Pressable
                style={styles.row}
                onPress={() => setShowEventTypePicker(true)}
              >
                <View style={[styles.iconContainer, { backgroundColor: eventTypeInfo?.color + "20" }]}>
                  <Feather
                    name={eventTypeInfo?.icon as any}
                    size={18}
                    color={eventTypeInfo?.color}
                  />
                </View>
                <View style={styles.rowContent}>
                  <ThemedText style={styles.rowLabel}>Event Type</ThemedText>
                  <View style={styles.rowValue}>
                    <ThemedText style={{ color: theme.textSecondary }}>
                      {eventTypeInfo?.label}
                    </ThemedText>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  </View>
                </View>
              </Pressable>
            </View>

            {isTimedEvent ? (
              <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
                <Pressable
                  style={styles.row}
                  onPress={() => openDateTimePicker("startDate")}
                >
                  <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
                    <Feather name="calendar" size={18} color={theme.primary} />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowLabel}>Start Date</ThemedText>
                    <View style={styles.rowValue}>
                      <ThemedText style={{ color: theme.textSecondary }}>
                        {formatDate(startDate)}
                      </ThemedText>
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </View>
                  </View>
                </Pressable>

                <View style={[styles.separator, { backgroundColor: theme.border }]} />

                <Pressable
                  style={styles.row}
                  onPress={() => openDateTimePicker("startTime")}
                >
                  <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
                    <Feather name="clock" size={18} color={theme.primary} />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowLabel}>Start Time</ThemedText>
                    <View style={styles.rowValue}>
                      <ThemedText style={{ color: theme.textSecondary }}>
                        {formatTime(startDate)}
                      </ThemedText>
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </View>
                  </View>
                </Pressable>

                <View style={[styles.separator, { backgroundColor: theme.border }]} />

                <Pressable
                  style={styles.row}
                  onPress={() => openDateTimePicker("endDate")}
                >
                  <View style={[styles.iconContainer, { backgroundColor: theme.secondary + "20" }]}>
                    <Feather name="calendar" size={18} color={theme.secondary} />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowLabel}>End Date</ThemedText>
                    <View style={styles.rowValue}>
                      <ThemedText style={{ color: theme.textSecondary }}>
                        {formatDate(endDate)}
                      </ThemedText>
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </View>
                  </View>
                </Pressable>

                <View style={[styles.separator, { backgroundColor: theme.border }]} />

                <Pressable
                  style={styles.row}
                  onPress={() => openDateTimePicker("endTime")}
                >
                  <View style={[styles.iconContainer, { backgroundColor: theme.secondary + "20" }]}>
                    <Feather name="clock" size={18} color={theme.secondary} />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowLabel}>End Time</ThemedText>
                    <View style={styles.rowValue}>
                      <ThemedText style={{ color: theme.textSecondary }}>
                        {formatTime(endDate)}
                      </ThemedText>
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </View>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
                <Pressable
                  style={styles.row}
                  onPress={() => openDateTimePicker("startDate")}
                >
                  <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
                    <Feather name="calendar" size={18} color={theme.primary} />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowLabel}>Date</ThemedText>
                    <View style={styles.rowValue}>
                      <ThemedText style={{ color: theme.textSecondary }}>
                        {formatDate(startDate)}
                      </ThemedText>
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </View>
                  </View>
                </Pressable>

                <View style={[styles.separator, { backgroundColor: theme.border }]} />

                <Pressable
                  style={styles.row}
                  onPress={() => openDateTimePicker("startTime")}
                >
                  <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
                    <Feather name="bell" size={18} color={theme.primary} />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowLabel}>Remind me at</ThemedText>
                    <View style={styles.rowValue}>
                      <ThemedText style={{ color: theme.textSecondary }}>
                        {formatTime(startDate)}
                      </ThemedText>
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </View>
                  </View>
                </Pressable>
              </View>
            )}

            <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
              <Pressable style={styles.row} onPress={() => setShowRecurrencePicker(true)}>
                <View style={[styles.iconContainer, { backgroundColor: theme.success + "20" }]}>
                  <Feather name="repeat" size={18} color={theme.success} />
                </View>
                <View style={styles.rowContent}>
                  <ThemedText style={styles.rowLabel}>Repeat</ThemedText>
                  <View style={styles.rowValue}>
                    <ThemedText style={{ color: theme.textSecondary }}>
                      {recurrenceInfo?.label}
                    </ThemedText>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  </View>
                </View>
              </Pressable>
            </View>

            <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
              <Pressable style={styles.row} onPress={() => setShowCategoryPicker(true)}>
                <View style={[styles.iconContainer, { backgroundColor: (selectedCategory?.color || theme.primary) + "20" }]}>
                  <Feather
                    name="grid"
                    size={18}
                    color={selectedCategory?.color || theme.primary}
                  />
                </View>
                <View style={styles.rowContent}>
                  <ThemedText style={styles.rowLabel}>Life Category</ThemedText>
                  <View style={styles.rowValue}>
                    <ThemedText
                      style={{ color: theme.textSecondary }}
                      numberOfLines={1}
                    >
                      {selectedCategory ? selectedCategory.name : "None"}
                    </ThemedText>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  </View>
                </View>
              </Pressable>

              <View style={[styles.separator, { backgroundColor: theme.border }]} />

              <Pressable style={styles.row} onPress={() => setShowTaskPicker(true)}>
                <View style={[styles.iconContainer, { backgroundColor: (selectedCategory?.color || theme.warning) + "20" }]}>
                  <Feather
                    name="link"
                    size={18}
                    color={selectedCategory?.color || theme.warning}
                  />
                </View>
                <View style={styles.rowContent}>
                  <ThemedText style={styles.rowLabel}>Link to Entry</ThemedText>
                  <View style={styles.rowValue}>
                    <ThemedText
                      style={{ color: theme.textSecondary }}
                      numberOfLines={1}
                    >
                      {selectedTask ? selectedTask.title : "None"}
                    </ThemedText>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  </View>
                </View>
              </Pressable>
            </View>

            {editingEvent ? (
              <Pressable
                style={[styles.deleteButton, { borderColor: theme.error }]}
                onPress={handleDelete}
              >
                <Feather name="trash-2" size={18} color={theme.error} />
                <ThemedText style={[styles.deleteText, { color: theme.error }]}>
                  Delete Event
                </ThemedText>
              </Pressable>
            ) : null}

            <View style={{ height: Spacing.xxl }} />
          </ScrollView>

          {(showStartDatePicker || showStartTimePicker || showEndDatePicker || showEndTimePicker) && Platform.OS !== "web" ? (
            <DateTimePicker
              value={
                showStartDatePicker || showStartTimePicker ? startDate : endDate
              }
              mode={showStartDatePicker || showEndDatePicker ? "date" : "time"}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={
                showStartDatePicker
                  ? handleStartDateChange
                  : showStartTimePicker
                  ? handleStartTimeChange
                  : showEndDatePicker
                  ? handleEndDateChange
                  : handleEndTimeChange
              }
            />
          ) : null}
        </View>
      </View>

      <Modal
        visible={showEventTypePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEventTypePicker(false)}
      >
        <Pressable
          style={[styles.pickerOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={() => setShowEventTypePicker(false)}
        >
          <View style={[styles.pickerContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={styles.pickerTitle}>Event Type</ThemedText>
            {EVENT_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.pickerItem,
                  eventType === type.value && { backgroundColor: type.color + "15" },
                ]}
                onPress={() => {
                  setEventType(type.value);
                  setShowEventTypePicker(false);
                }}
              >
                <Feather name={type.icon as any} size={20} color={type.color} />
                <ThemedText style={styles.pickerItemText}>{type.label}</ThemedText>
                {eventType === type.value ? (
                  <Feather name="check" size={18} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showRecurrencePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecurrencePicker(false)}
      >
        <Pressable
          style={[styles.pickerOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={() => setShowRecurrencePicker(false)}
        >
          <View style={[styles.pickerContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={styles.pickerTitle}>Repeat</ThemedText>
            {RECURRENCE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.pickerItem,
                  recurrence === option.value && { backgroundColor: theme.primary + "15" },
                ]}
                onPress={() => {
                  setRecurrence(option.value);
                  setShowRecurrencePicker(false);
                }}
              >
                <ThemedText style={styles.pickerItemText}>{option.label}</ThemedText>
                {recurrence === option.value ? (
                  <Feather name="check" size={18} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showTaskPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTaskPicker(false)}
      >
        <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.taskPickerContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.taskPickerHeader}>
              <ThemedText style={styles.pickerTitle}>Link to Entry</ThemedText>
              <Pressable onPress={() => setShowTaskPicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.taskList}>
              <Pressable
                style={[
                  styles.taskItem,
                  { borderBottomColor: theme.border },
                  !selectedTaskId && { backgroundColor: theme.primary + "15" },
                ]}
                onPress={() => {
                  setSelectedTaskId(null);
                  setShowTaskPicker(false);
                }}
              >
                <Feather name="x-circle" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.taskItemText}>No Link</ThemedText>
                {!selectedTaskId ? (
                  <Feather name="check" size={18} color={theme.primary} />
                ) : null}
              </Pressable>
              {tasks
                .filter((t) => !t.parentId && (!preselectedCategoryId || t.categoryId === preselectedCategoryId))
                .map((task) => {
                  const category = categories.find((c) => c.id === task.categoryId);
                  return (
                    <Pressable
                      key={task.id}
                      style={[
                        styles.taskItem,
                        { borderBottomColor: theme.border },
                        selectedTaskId === task.id && { backgroundColor: theme.primary + "15" },
                      ]}
                      onPress={() => {
                        setSelectedTaskId(task.id);
                        if (!title.trim()) {
                          setTitle(task.title);
                        }
                        if (task.categoryId) {
                          setSelectedCategoryId(task.categoryId);
                        }
                        setShowTaskPicker(false);
                      }}
                    >
                      <View
                        style={[
                          styles.taskColor,
                          { backgroundColor: category?.color || theme.textSecondary },
                        ]}
                      />
                      <View style={styles.taskInfo}>
                        <ThemedText numberOfLines={1} style={styles.taskItemText}>
                          {task.title}
                        </ThemedText>
                        <ThemedText
                          style={[styles.taskCategory, { color: theme.textSecondary }]}
                        >
                          {category?.name || "Uncategorized"}
                        </ThemedText>
                      </View>
                      {selectedTaskId === task.id ? (
                        <Feather name="check" size={18} color={theme.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <Pressable
          style={[styles.pickerOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={[styles.pickerContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={styles.pickerTitle}>Life Category</ThemedText>
            <Pressable
              style={[
                styles.pickerItem,
                !selectedCategoryId && { backgroundColor: theme.primary + "15" },
              ]}
              onPress={() => {
                setSelectedCategoryId(null);
                setShowCategoryPicker(false);
              }}
            >
              <View style={[styles.categoryDot, { backgroundColor: theme.textSecondary }]} />
              <ThemedText style={styles.pickerItemText}>None</ThemedText>
              {!selectedCategoryId ? (
                <Feather name="check" size={18} color={theme.primary} />
              ) : null}
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.pickerItem,
                  selectedCategoryId === cat.id && { backgroundColor: cat.color + "15" },
                ]}
                onPress={() => {
                  setSelectedCategoryId(cat.id);
                  setShowCategoryPicker(false);
                }}
              >
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <ThemedText style={styles.pickerItemText}>{cat.name}</ThemedText>
                {selectedCategoryId === cat.id ? (
                  <Feather name="check" size={18} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerButton: {
    minWidth: 60,
  },
  headerTitle: {
    ...Typography.h3,
    textAlign: "center",
  },
  cancelText: {
    ...Typography.body,
  },
  saveText: {
    ...Typography.body,
    fontWeight: "600",
    textAlign: "right",
  },
  content: {
    padding: Spacing.lg,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  titleInput: {
    flex: 1,
    marginLeft: Spacing.md,
    ...Typography.body,
  },
  descriptionContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  descriptionInput: {
    ...Typography.body,
    minHeight: 80,
  },
  section: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: {
    ...Typography.body,
  },
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  separator: {
    height: 1,
    marginLeft: 52,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  deleteText: {
    ...Typography.body,
    fontWeight: "500",
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  pickerContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  pickerTitle: {
    ...Typography.h3,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  pickerItemText: {
    ...Typography.body,
    flex: 1,
  },
  taskPickerContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "70%",
  },
  taskPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  taskList: {
    padding: Spacing.lg,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  taskColor: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskItemText: {
    ...Typography.body,
  },
  taskCategory: {
    ...Typography.caption,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

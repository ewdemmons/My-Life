import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import AppDatePicker from "./AppDatePicker";
import AppTimePicker from "./AppTimePicker";
import { PeopleSelector } from "./PeopleSelector";
import { useTheme } from "@/hooks/useTheme";
import { useApp } from "@/context/AppContext";
import { useNotifications } from "@/context/NotificationContext";
import {
  CalendarEvent,
  EventType,
  RecurrenceType,
  EVENT_TYPES,
  RECURRENCE_OPTIONS,
  Task,
  Habit,
} from "@/types";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getRecurrenceDescription } from "@/utils/recurrence";
import { scheduleEventReminder, calculateReminderTime } from "@/utils/notifications";
import { SaveToast } from "@/components/SaveToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";

interface SchedulingModalProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  linkedTask?: Task | null;
  linkedHabit?: Habit | null;
  editingEvent?: CalendarEvent | null;
  preselectedCategoryId?: string;
  initialCategoryId?: string;
  initialPeopleIds?: string[];
  lockedCategoryId?: string;
  editingAsInstance?: boolean;
  readOnly?: boolean;
  canDelete?: boolean;
}

export function SchedulingModal({
  visible,
  onClose,
  initialDate,
  initialStartTime,
  initialEndTime,
  linkedTask,
  linkedHabit,
  editingEvent,
  preselectedCategoryId,
  initialCategoryId,
  initialPeopleIds,
  lockedCategoryId,
  editingAsInstance = false,
  readOnly = false,
  canDelete = true,
}: SchedulingModalProps) {
  const { theme } = useTheme();
  const { addEvent, updateEvent, updateEventInstance, updateEventSeries, deleteEvent, tasks, categories, events } = useApp();
  const { preferences } = useNotifications();
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500, successMessage: "Event scheduled" });

  const getInitialStartDate = () => {
    if (editingEvent) return new Date(editingEvent.startDate + "T" + editingEvent.startTime);
    if (initialDate) return new Date(initialDate + "T" + (initialStartTime || "09:00") + ":00");
    return new Date();
  };

  const getInitialEndDate = () => {
    if (editingEvent) return new Date(editingEvent.endDate + "T" + editingEvent.endTime);
    if (initialDate && initialEndTime) return new Date(initialDate + "T" + initialEndTime + ":00");
    const start = getInitialStartDate();
    return new Date(start.getTime() + 60 * 60 * 1000);
  };

  const [title, setTitle] = useState(editingEvent?.title || linkedTask?.title || linkedHabit?.name || "");
  const [description, setDescription] = useState(editingEvent?.description || linkedTask?.description || linkedHabit?.description || "");
  const [startDate, setStartDate] = useState(getInitialStartDate());
  const [endDate, setEndDate] = useState(getInitialEndDate());
  const [eventType, setEventType] = useState<EventType>(editingEvent?.eventType || "appointment");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(editingEvent?.recurrence || "none");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    editingEvent?.linkedTaskId || linkedTask?.id || null
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    lockedCategoryId || editingEvent?.categoryId || linkedTask?.categoryId || linkedHabit?.categoryId || preselectedCategoryId || null
  );
  const [attendeeIds, setAttendeeIds] = useState<string[]>(editingEvent?.attendeeIds || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingSeries, setIsUpdatingSeries] = useState(false);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showEventTypePicker, setShowEventTypePicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const schedulePickerOpen =
    showStartDatePicker ||
    showStartTimePicker ||
    showEndDatePicker ||
    showEndTimePicker;

  const isTimedEvent = eventType === "appointment" || eventType === "meeting";

  const openDateTimePicker = (picker: "startDate" | "startTime" | "endDate" | "endTime") => {
    setShowStartDatePicker(picker === "startDate");
    setShowStartTimePicker(picker === "startTime");
    setShowEndDatePicker(picker === "endDate");
    setShowEndTimePicker(picker === "endTime");
  };

  useEffect(() => {
    if (visible) {
      setTitle(editingEvent?.title || linkedTask?.title || linkedHabit?.name || "");
      setDescription(editingEvent?.description || linkedTask?.description || linkedHabit?.description || "");
      setStartDate(getInitialStartDate());
      setEndDate(getInitialEndDate());
      setEventType(editingEvent?.eventType || (linkedTask ? "reminder" : "appointment"));
      setRecurrence(editingEvent?.recurrence || "none");
      setSelectedTaskId(editingEvent?.linkedTaskId || linkedTask?.id || null);
      const initialCategory =
        lockedCategoryId ||
        editingEvent?.categoryId ||
        linkedTask?.categoryId ||
        linkedHabit?.categoryId ||
        initialCategoryId ||
        preselectedCategoryId ||
        (linkedHabit ? null : categories.length > 0 ? categories[0].id : null);
      setSelectedCategoryId(initialCategory);
      setAttendeeIds(editingEvent?.attendeeIds || initialPeopleIds || []);
    }
  }, [
    visible,
    editingEvent,
    linkedTask,
    linkedHabit,
    initialDate,
    initialStartTime,
    initialEndTime,
    initialCategoryId,
    initialPeopleIds,
    preselectedCategoryId,
    lockedCategoryId,
    categories,
  ]);

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

  const applyDateToDate = (target: Date, dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const next = new Date(target);
    next.setFullYear(y, m - 1, d);
    return next;
  };

  const applyTimeToDate = (target: Date, timeStr: string) => {
    const [h, min] = timeStr.split(":").map(Number);
    const next = new Date(target);
    next.setHours(h, min, 0, 0);
    return next;
  };

  const handleStartDateConfirm = (dateStr: string) => {
    const newStart = applyDateToDate(startDate, dateStr);
    setStartDate(newStart);
    if (newStart > endDate) {
      setEndDate(new Date(newStart.getTime() + 60 * 60 * 1000));
    }
    setShowStartDatePicker(false);
  };

  const handleStartTimeConfirm = (timeStr: string) => {
    const newStart = applyTimeToDate(startDate, timeStr);
    setStartDate(newStart);
    if (newStart >= endDate) {
      setEndDate(new Date(newStart.getTime() + 60 * 60 * 1000));
    }
    setShowStartTimePicker(false);
  };

  const handleEndDateConfirm = (dateStr: string) => {
    const newEnd = applyDateToDate(endDate, dateStr);
    if (newEnd >= startDate) {
      setEndDate(newEnd);
    }
    setShowEndDatePicker(false);
  };

  const handleEndTimeConfirm = (timeStr: string) => {
    const newEnd = applyTimeToDate(endDate, timeStr);
    if (newEnd > startDate) {
      setEndDate(newEnd);
    }
    setShowEndTimePicker(false);
  };

  const datePickerEvents = useMemo(() => {
    const result: { date: string; color: string }[] = [];
    const enumerateDays = (start: string, end: string) => {
      const days: string[] = [];
      const cur = new Date(start + "T12:00:00");
      const last = new Date(end + "T12:00:00");
      while (cur <= last) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        days.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    };
    for (const event of events) {
      const color =
        categories.find((c) => c.id === event.categoryId)?.color ??
        EVENT_TYPES.find((t) => t.value === event.eventType)?.color ??
        theme.primary;
      for (const day of enumerateDays(event.startDate, event.endDate)) {
        result.push({ date: day, color });
      }
    }
    return result;
  }, [events, categories, theme.primary]);

  const handleSave = async () => {
    if (!title.trim() || isSaving) return;

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
      attendeeIds,
    };

    const performSave = async () => {
      setIsSaving(true);
      try {
        if (editingEvent) {
          const isPartOfSeries = editingEvent.seriesId != null && editingEvent.seriesId !== "";

          if (isPartOfSeries && editingEvent.seriesId) {
            if (editingAsInstance) {
              await updateEventInstance(editingEvent.id, eventData);
            } else {
              setIsUpdatingSeries(true);
              await updateEventSeries(editingEvent.seriesId, eventData, editingEvent.id);
              setIsUpdatingSeries(false);
            }
          } else {
            await updateEvent(editingEvent.id, eventData);
          }
        } else {
          await addEvent(eventData);

          if (preferences.enabled && preferences.eventReminders) {
            const reminderTime = calculateReminderTime(
              eventData.startDate,
              eventData.startTime,
              preferences.reminderMinutesBefore
            );
            const notificationEventId = `${eventData.startDate}-${eventData.startTime}-${Date.now()}`;
            await scheduleEventReminder(
              notificationEventId,
              eventData.title,
              `Reminder: "${eventData.title}" starts in ${preferences.reminderMinutesBefore} minutes`,
              reminderTime
            );
          }
        }
        onClose();
      } finally {
        setIsSaving(false);
        setIsUpdatingSeries(false);
      }
    };

    setRetry(() => {
      void performSave();
    });
    await withSaveIndicator(performSave);
  };

  const handleDelete = async () => {
    if (!editingEvent) return;

    const performDelete = async () => {
      await deleteEvent(editingEvent.id);
      onClose();
    };

    setRetry(() => {
      void performDelete();
    });
    await withSaveIndicator(performDelete, { showSuccess: false });
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
    <>
      <Modal visible={visible && !schedulePickerOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.headerButton}>
              <ThemedText style={[styles.cancelText, { color: theme.primary }]}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.headerTitle}>
              {editingEvent ? "Edit Event" : "New Event"}
            </ThemedText>
            {readOnly ? (
              <View style={styles.headerButton} />
            ) : (
              <Pressable
                onPress={handleSave}
                style={[styles.headerButton, (!title.trim() || isSaving) && { opacity: 0.5 }]}
                disabled={!title.trim() || isSaving}
              >
                <ThemedText style={[styles.saveText, { color: theme.primary }]}>
                  {isUpdatingSeries ? "Updating series..." : isSaving ? "Saving..." : "Save"}
                </ThemedText>
              </Pressable>
            )}
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
              {recurrence !== "none" ? (
                <View style={[styles.recurrenceNote, { borderTopColor: theme.border }]}>
                  <Feather name="info" size={14} color={theme.success} style={{ marginRight: Spacing.xs }} />
                  <ThemedText style={[styles.recurrenceNoteText, { color: theme.success }]}>
                    {getRecurrenceDescription(recurrence, getDateString(startDate))}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
              {lockedCategoryId ? (
                <View style={styles.row}>
                  <View style={[styles.iconContainer, { backgroundColor: (selectedCategory?.color || theme.primary) + "20" }]}>
                    <Feather
                      name="grid"
                      size={18}
                      color={selectedCategory?.color || theme.primary}
                    />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowLabel}>Life Area</ThemedText>
                    <View style={styles.rowValue}>
                      <ThemedText
                        style={{ color: selectedCategory?.color || theme.textSecondary }}
                        numberOfLines={1}
                      >
                        {selectedCategory?.name || "None"}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable style={styles.row} onPress={() => setShowCategoryPicker(true)}>
                  <View style={[styles.iconContainer, { backgroundColor: (selectedCategory?.color || theme.primary) + "20" }]}>
                    <Feather
                      name="grid"
                      size={18}
                      color={selectedCategory?.color || theme.primary}
                    />
                  </View>
                  <View style={styles.rowContent}>
                    <ThemedText style={styles.rowLabel}>Life Area</ThemedText>
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
              )}

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

            <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}>
              <PeopleSelector
                selectedIds={attendeeIds}
                onSelectionChange={setAttendeeIds}
                label="Attendees (Optional)"
                placeholder="Add attendees..."
              />
            </View>

            {editingEvent && canDelete && !readOnly ? (
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

        </View>

        <SaveToast
          state={toastState}
          message={toastMessage}
          onRetry={retryFn ?? undefined}
          onDismiss={dismiss}
        />
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
                .filter((t) => !t.parentId && (
                  lockedCategoryId 
                    ? t.categoryId === lockedCategoryId 
                    : (!preselectedCategoryId || t.categoryId === preselectedCategoryId)
                ))
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
                        if (task.categoryId && !lockedCategoryId) {
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
            <ThemedText style={styles.pickerTitle}>Life Area</ThemedText>
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

      <AppDatePicker
        visible={showStartDatePicker}
        value={getDateString(startDate)}
        title="Start Date"
        events={datePickerEvents}
        onConfirm={handleStartDateConfirm}
        onCancel={() => setShowStartDatePicker(false)}
      />
      <AppTimePicker
        visible={showStartTimePicker}
        value={getTimeString(startDate)}
        title="Start Time"
        onConfirm={handleStartTimeConfirm}
        onCancel={() => setShowStartTimePicker(false)}
      />
      <AppDatePicker
        visible={showEndDatePicker}
        value={getDateString(endDate)}
        title="End Date"
        minDate={getDateString(startDate)}
        events={datePickerEvents}
        onConfirm={handleEndDateConfirm}
        onCancel={() => setShowEndDatePicker(false)}
      />
      <AppTimePicker
        visible={showEndTimePicker}
        value={getTimeString(endDate)}
        title="End Time"
        onConfirm={handleEndTimeConfirm}
        onCancel={() => setShowEndTimePicker(false)}
      />
    </>
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
  recurrenceNote: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    marginLeft: 52,
  },
  recurrenceNoteText: {
    ...Typography.caption,
    flex: 1,
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

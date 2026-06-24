import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import * as Network from "expo-network";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { parseCommand } from "@/lib/commandService";
import {
  executeCreateEntry,
  executeScheduleEvent,
  executeCreateHabit,
  executeLogHabit,
  executePinEntry,
  executeCompleteEntry,
  executeCompleteEntryUntil,
  executeUpdateEntry,
  executeUpdateEvent,
} from "@/lib/commandExecutor";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FABProps {
  onAddCategory: () => void;
  onAddTask: () => void;
  onAddEvent?: () => void;
  onAddPerson?: () => void;
  onAddHabit?: () => void;
  hideFloatingButton?: boolean;
}

export type FABHandle = {
  openMenu: () => void;
};

const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 50 });

export const FAB = forwardRef<FABHandle, FABProps>(function FAB(
  { onAddCategory, onAddTask, onAddEvent, onAddPerson, onAddHabit, hideFloatingButton },
  ref,
) {
  const { theme, isDark } = useTheme();
  const {
    categories,
    people,
    tasks,
    habits,
    addTask,
    addEvent,
    updateEvent,
    deleteTask,
    deleteEvent,
    getEventsByDate,
    events,
    addHabit,
    deleteHabit,
    addOccurrence,
    deleteOccurrence,
    pinTask,
    unpinTask,
    updateTask,
  } = useApp();
  const deleteTaskRef = useRef(deleteTask);
  const deleteEventRef = useRef(deleteEvent);
  const getEventsByDateRef = useRef(getEventsByDate);
  const eventsRef = useRef(events);
  const addEventRef = useRef(addEvent);
  const updateEventRef = useRef(updateEvent);
  const habitsRef = useRef(habits);
  const deleteHabitRef = useRef(deleteHabit);
  const addOccurrenceRef = useRef(addOccurrence);
  const deleteOccurrenceRef = useRef(deleteOccurrence);
  const pinTaskRef = useRef(pinTask);
  const unpinTaskRef = useRef(unpinTask);
  const updateTaskRef = useRef(updateTask);
  deleteTaskRef.current = deleteTask;
  deleteEventRef.current = deleteEvent;
  getEventsByDateRef.current = getEventsByDate;
  eventsRef.current = events;
  addEventRef.current = addEvent;
  updateEventRef.current = updateEvent;
  habitsRef.current = habits;
  deleteHabitRef.current = deleteHabit;
  addOccurrenceRef.current = addOccurrence;
  deleteOccurrenceRef.current = deleteOccurrence;
  pinTaskRef.current = pinTask;
  unpinTaskRef.current = unpinTask;
  updateTaskRef.current = updateTask;
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [commandText, setCommandText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState<boolean | null>(null);
  const scale = useSharedValue(1);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const isWebPlatform = Platform.OS as string === "web";

  useEffect(() => {
    if (isOpen) {
      void checkMicPermission();
    }
  }, [isOpen]);

  useImperativeHandle(ref, () => ({
    openMenu: () => setIsOpen(true),
  }));

  const bottomOffset = insets.bottom + TAB_BAR_HEIGHT + 6;

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

  const closeModal = () => {
    setIsOpen(false);
  };

  const handleAddCategory = () => {
    closeModal();
    onAddCategory();
  };

  const handleAddTask = () => {
    closeModal();
    onAddTask();
  };

  const handleAddEvent = () => {
    closeModal();
    if (onAddEvent) {
      onAddEvent();
    }
  };

  const handleAddPerson = () => {
    closeModal();
    if (onAddPerson) {
      onAddPerson();
    }
  };

  const handleAddHabit = () => {
    closeModal();
    if (onAddHabit) {
      onAddHabit();
    }
  };

  const showSuccessAlert = (
    title: string,
    result: { message: string; undo: (() => Promise<void>) | null },
  ) => {
    const buttons: Array<{ text: string; style?: "default" | "destructive"; onPress?: () => void }> = [];
    if (result.undo) {
      buttons.push({
        text: "Undo",
        style: "destructive",
        onPress: () => {
          void result.undo?.();
        },
      });
    }
    buttons.push({ text: "OK", style: "default" });
    Alert.alert(title, result.message, buttons);
    setCommandText("");
  };

  const checkMicPermission = async () => {
    if (isWebPlatform) {
      setRecordingPermission(true);
      return;
    }
    try {
      const status = await AudioModule.getRecordingPermissionsAsync();
      setRecordingPermission(status.granted);
    } catch (error) {
      console.error("Error checking mic permission:", error);
      setRecordingPermission(false);
    }
  };

  const requestMicPermission = async (): Promise<boolean> => {
    if (isWebPlatform) {
      setRecordingPermission(true);
      return true;
    }
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setRecordingPermission(status.granted);
      if (!status.granted && !status.canAskAgain) {
        Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access in your device settings to use voice input.",
          [
            { text: "Cancel", style: "cancel" },
            ...(!isWebPlatform ? [{
              text: "Open Settings",
              onPress: async () => {
                try {
                  await Linking.openSettings();
                } catch (e) {
                  console.error("Could not open settings:", e);
                }
              },
            }] : []),
          ],
        );
      }
      return status.granted;
    } catch (error) {
      console.error("Error requesting mic permission:", error);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      const netState = await Network.getNetworkStateAsync();
      if (!netState.isConnected) {
        Alert.alert("Offline", "Voice input is not available offline. Please connect to the internet.");
        return;
      }
    } catch (e) {
    }

    if (isWebPlatform) {
      Alert.alert("Voice Input", "Voice input works best in the Expo Go app on your mobile device.");
      return;
    }

    if (!recordingPermission) {
      const granted = await requestMicPermission();
      if (!granted) return;
    }

    try {
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      await audioRecorder.stop();
      setIsRecording(false);

      await AudioModule.setAudioModeAsync({
        allowsRecording: false,
      });

      const uri = audioRecorder.uri;
      console.log("Recording stopped, URI:", uri);
      if (uri) {
        await transcribeAudio(uri);
      } else {
        console.error("No recording URI available");
        Alert.alert("Error", "Recording failed. Please try again.");
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
      Alert.alert("Error", "Failed to process recording. Please try again.");
    }
  };

  const transcribeAudio = async (uri: string) => {
    setIsTranscribing(true);
    try {
      console.log("Transcribing audio from URI:", uri);

      const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("Groq API key not configured");
      }

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "recording.m4a",
        type: "audio/m4a",
      } as unknown as Blob);
      formData.append("model", "whisper-large-v3-turbo");

      const response = await fetch(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const transcribedText = data.text;

      if (transcribedText && transcribedText.trim()) {
        setCommandText(transcribedText);
        setTimeout(() => {
          void handleSubmitCommand(transcribedText);
        }, 100);
      } else {
        Alert.alert("No speech detected", "Please try again.");
      }
    } catch (error) {
      console.error("Transcription error:", error);
      Alert.alert("Error", "Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmitCommand = async (overrideText?: string) => {
    const text = (overrideText ?? commandText).trim();
    if (!text || isProcessing) return;
    setIsProcessing(true);

    const pendingTasks = tasks
      .filter((t) => t.status === "pending")
      .map((t) => ({
        id: t.id,
        title: t.title,
        categoryName: categories.find((c) => c.id === t.categoryId)?.name ?? "Unsorted",
      }));

    const habitList = habits.map((h) => ({ id: h.id, title: h.name }));

    const result = await parseCommand(text, {
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      people: people.map((p) => ({ id: p.id, name: p.name })),
      pendingTasks,
      habits: habitList,
    });

    setIsProcessing(false);

    if (result.type === "createEntry") {
      const execResult = await executeCreateEntry(result.input, {
        addTask,
        deleteTask: (id) => deleteTaskRef.current(id),
        categories,
      });
      if (execResult.success) {
        showSuccessAlert("Entry Created", execResult);
      } else {
        console.error("[Command] createEntry failed:", execResult.error);
        Alert.alert("Error", "Failed to create entry. Please try again.");
      }
    } else if (result.type === "scheduleEvent") {
      const execResult = await executeScheduleEvent(result.input, {
        addEvent,
        deleteEvent: (id) => deleteEventRef.current(id),
        getEventsByDate: (date) => getEventsByDateRef.current(date),
        categories,
      });
      if (execResult.success) {
        showSuccessAlert("Event Scheduled", execResult);
      } else {
        console.error("[Command] scheduleEvent failed:", execResult.error);
        Alert.alert("Error", "Failed to schedule event. Please try again.");
      }
    } else if (result.type === "createHabit") {
      const execResult = await executeCreateHabit(result.input, {
        addHabit,
        deleteHabit: (id) => deleteHabitRef.current(id),
        getHabits: () => habitsRef.current,
        categories,
      });
      if (execResult.success) {
        showSuccessAlert("Habit Created", execResult);
      } else {
        console.error("[Command] createHabit failed:", execResult.error);
        Alert.alert("Error", "Failed to create habit. Please try again.");
      }
    } else if (result.type === "logHabit") {
      const execResult = await executeLogHabit(result.input, {
        addOccurrence: (occ) => addOccurrenceRef.current(occ),
        deleteOccurrence: (id) => deleteOccurrenceRef.current(id),
        getHabitName: (id) =>
          habits.find((h) => h.id === id)?.name ?? "habit",
      });
      if (execResult.success) {
        showSuccessAlert("Habit Logged", execResult);
      } else {
        console.error("[Command] logHabit failed:", execResult.error);
        Alert.alert("Error", "Failed to log habit. Please try again.");
      }
    } else if (result.type === "pinEntry") {
      const execResult = await executePinEntry(result.input, {
        pinTask,
        unpinTask: (id) => unpinTaskRef.current(id),
        getTaskTitle: (id) =>
          tasks.find((t) => t.id === id)?.title ?? "entry",
      });
      if (execResult.success) {
        showSuccessAlert("Entry Pinned", execResult);
      } else {
        console.error("[Command] pinEntry failed:", execResult.error);
        Alert.alert("Error", "Failed to pin entry. Please try again.");
      }
    } else if (result.type === "completeEntry") {
      const execResult = await executeCompleteEntry(result.input, {
        updateTask,
        getTaskTitle: (id) =>
          tasks.find((t) => t.id === id)?.title ?? "entry",
      });
      if (execResult.success) {
        showSuccessAlert("Entry Completed", execResult);
      } else {
        console.error("[Command] completeEntry failed:", execResult.error);
        Alert.alert("Error", "Failed to complete entry. Please try again.");
      }
    } else if (result.type === "completeEntryUntil") {
      const execResult = await executeCompleteEntryUntil(result.input, {
        updateTask,
        getTask: (id) => tasks.find((t) => t.id === id),
        getEvents: () => eventsRef.current,
        addEvent: (e) => addEventRef.current(e),
        updateEvent: (id, u) => updateEventRef.current(id, u),
        deleteEvent: (id) => deleteEventRef.current(id),
      });
      if (execResult.success) {
        showSuccessAlert("Complete Until Set", execResult);
      } else {
        console.error("[Command] completeEntryUntil failed:", execResult.error);
        Alert.alert("Error", "Failed to set complete until. Please try again.");
      }
    } else if (result.type === "updateEntry") {
      const execResult = await executeUpdateEntry(result.input, {
        updateTask,
        getTask: (id) => tasks.find((t) => t.id === id),
        categories,
      });
      if (execResult.success) {
        showSuccessAlert("Entry Updated", execResult);
      } else {
        console.error("[Command] updateEntry failed:", execResult.error);
        Alert.alert("Error", "Failed to update entry. Please try again.");
      }
    } else if (result.type === "updateEvent") {
      const execResult = await executeUpdateEvent(result.input, {
        updateEvent,
        getEvent: (id) => events.find((e) => e.id === id),
        categories,
      });
      if (execResult.success) {
        showSuccessAlert("Event Updated", execResult);
      } else {
        console.error("[Command] updateEvent failed:", execResult.error);
        Alert.alert("Error", "Failed to update event. Please try again.");
      }
    } else if (result.type === "clarification") {
      console.log("Needs clarification:", result.question, result.options);
      Alert.alert("Need more info", result.question);
    } else {
      Alert.alert("Error", result.message);
    }
  };

  return (
    <>
      {!hideFloatingButton ? (
        <View style={[styles.fabContainer, { bottom: bottomOffset }]}>
          <AnimatedPressable
            style={[
              styles.fab,
              animatedStyle,
              {
                backgroundColor: theme.primary,
              },
            ]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
          >
            <Feather name="plus" size={28} color="#FFFFFF" />
          </AnimatedPressable>
          <ThemedText style={[styles.fabLabel, { color: theme.buttonText, opacity: 0.78 }]}>
            Capture
          </ThemedText>
        </View>
      ) : null}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View style={styles.menuContainer}>
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={[
                styles.menu,
                { backgroundColor: isDark ? "rgba(26,26,26,0.9)" : "rgba(255,255,255,0.9)" },
              ]}
            >
              <View style={styles.commandBarSection}>
                <View
                  style={[
                    styles.commandBar,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.commandInput, { color: theme.text }]}
                    placeholder={
                      isRecording
                        ? "Listening..."
                        : isTranscribing
                          ? "Transcribing..."
                          : "Type a command... (e.g. 'call dentist tomorrow')"
                    }
                    placeholderTextColor={theme.textSecondary}
                    value={commandText}
                    onChangeText={setCommandText}
                    editable={!isProcessing && !isRecording && !isTranscribing}
                    returnKeyType="send"
                    onSubmitEditing={() => {
                      void handleSubmitCommand();
                    }}
                  />
                  <Pressable
                    onPress={isRecording ? stopRecording : startRecording}
                    disabled={isTranscribing || isProcessing}
                    style={[
                      styles.commandMicBtn,
                      isRecording && { backgroundColor: theme.error },
                    ]}
                  >
                    {isTranscribing ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <Feather
                        name={isRecording ? "square" : "mic"}
                        size={16}
                        color={isRecording ? "#fff" : theme.primary}
                      />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void handleSubmitCommand();
                    }}
                    disabled={isProcessing || isRecording || isTranscribing || !commandText.trim()}
                    style={[
                      styles.commandSendBtn,
                      { backgroundColor: theme.primary },
                      (isProcessing || isRecording || isTranscribing || !commandText.trim()) &&
                        styles.commandSendBtnDisabled,
                    ]}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Feather name="send" size={16} color="#fff" />
                    )}
                  </Pressable>
                </View>
              </View>
              <View style={[styles.separator, { backgroundColor: theme.border }]} />
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
                    <ThemedText style={styles.menuTitle}>Add Life Area</ThemedText>
                    <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                      Create a new Life Area
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
                    <ThemedText style={styles.menuTitle}>Add Entry</ThemedText>
                    <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                      Capture a task, goal, project, list, note, idea
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
                        <ThemedText style={styles.menuTitle}>Add People</ThemedText>
                        <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                          Add someone to your inner circle
                        </ThemedText>
                      </View>
                    </Pressable>
                  </>
                ) : null}
                {onAddHabit ? (
                  <>
                    <View style={[styles.separator, { backgroundColor: theme.border }]} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuItem,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={handleAddHabit}
                    >
                      <View style={[styles.menuIcon, { backgroundColor: "#8B5CF6" + "20" }]}>
                        <Feather name="activity" size={20} color="#8B5CF6" />
                      </View>
                      <View style={styles.menuTextContainer}>
                        <ThemedText style={styles.menuTitle}>Add Habit</ThemedText>
                        <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
                          Track a new habit
                        </ThemedText>
                      </View>
                    </Pressable>
                  </>
                ) : null}
            </BlurView>
          </View>
        </View>
      </Modal>
    </>
  );
});

const FAB_SIZE = 64;

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    right: Spacing.lg,
    alignItems: "center",
    zIndex: 100,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    overflow: "hidden",
  },
  fabLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
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
    zIndex: 1,
  },
  menu: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    width: "100%",
  },
  commandBarSection: {
    width: "100%",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  commandBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    marginBottom: 12,
    width: "100%",
  },
  commandInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 10,
  },
  commandMicBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  commandSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  commandSendBtnDisabled: {
    opacity: 0.4,
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

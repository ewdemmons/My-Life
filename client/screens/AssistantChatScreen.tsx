import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Animated,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import * as Speech from "expo-speech";
import * as Network from "expo-network";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useApp } from "@/context/AppContext";
import { SaveToast } from "@/components/SaveToast";
import { BriefToast } from "@/components/BriefToast";
import { useSaveIndicator } from "@/hooks/useSaveIndicator";
import { buildSchedulePreferences } from "@/utils/schedulePreferences";
import { buildAppContext } from "@/utils/appContextBuilder";
import { sendToAI, isPlanningRequest, isRefinementBranchRequest } from "@/lib/aiService";
import {
  parseChatMessage,
  CommandAction,
  CommandContext,
  CreateEntryInput,
} from "@/lib/commandService";
import {
  BatchExecutionResult,
  buildBatchSummary,
  getBatchItemDisplay,
  getBatchItemIcon,
  inferBatchActionLabel,
  inferBatchCategoryName,
  inferBatchSummaryKind,
} from "@/lib/commandBatch";
import { CommandBatchSummary } from "@/components/CommandBatchSummary";
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
  CommandExecutionResult,
} from "@/lib/commandExecutor";
import {
  getRegularSystemPrompt,
  getPlanningSystemPrompt,
  getHabitsPrompt,
  getSchedulingPrompt,
  getAssignmentsPrompt,
} from "@/lib/systemPrompts";
import { Plan, parsePlanFromMessage, extractTextFromMessage } from "@/components/PlanPreview";
import { PlanPreviewModal, PlanPreviewButton } from "@/components/PlanPreviewModal";
import { Task, TaskType, Habit, CalendarEvent } from "@/types";
import { RootStackParamList, EntryContext } from "@/navigation/RootStackNavigator";

const MESSAGES_STORAGE_KEY = "@assistant_messages";
const REFINEMENT_STATE_KEY = "@assistant_refinement_state";
const SPEAK_OVER_SILENT_MODE_KEY = "@speak_over_silent_mode";

interface ScheduleProposal {
  type: "schedule";
  tasks: Array<{
    taskId: string;
    title: string;
    suggestedDueDate: string;
    reminderDays?: number;
  }>;
  events?: Array<{
    title: string;
    date: string;
    time?: string;
    isRecurring?: boolean;
    recurrencePattern?: string;
  }>;
}

interface HabitProposal {
  type: "habit";
  suggestions: Array<{
    taskTitle: string;
    habitName: string;
    frequency: "daily" | "weekly" | "monthly";
    habitType: "positive" | "negative";
    goalCount?: number;
  }>;
}

interface AssignmentProposal {
  type: "assignment";
  suggestions: Array<{
    taskId: string;
    taskTitle: string;
    suggestedPeople: Array<{
      personId: string;
      personName: string;
    }>;
  }>;
}

type RefinementProposal = ScheduleProposal | HabitProposal | AssignmentProposal;

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  plan?: Plan;
  planImplemented?: boolean;
  refinementProposal?: RefinementProposal;
  proposalImplemented?: boolean;
  isRefinementPrompt?: boolean;
  quickReplies?: string[];
  isImportedPlan?: boolean;
  importSource?: "text" | "url";
  isCommandClarification?: boolean;
  batchCommandResult?: BatchExecutionResult;
}

interface RefinementState {
  isActive: boolean;
  implementedPlan?: Plan;
  createdTaskIds?: string[];
  currentBranch?: "scheduling" | "habits" | "assignments" | null;
  bubbleId?: string;
}

export default function AssistantChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<RootStackParamList, "AssistantChat">>();
  const entryContext = route.params?.entryContext;
  const lifeAreaContext = route.params?.lifeAreaContext;
  const openPlanningSession = route.params?.openPlanningSession;
  const initialPrompt = route.params?.initialPrompt;
  const { theme, isDark } = useTheme();
  const {
    categories,
    tasks,
    events,
    habits,
    people,
    occurrences,
    addTask,
    addCategory,
    updateTask,
    addEvent,
    addHabit,
    deleteTask,
    deleteEvent,
    getEventsByDate,
    deleteHabit,
    addOccurrence,
    deleteOccurrence,
    pinTask,
    unpinTask,
    updateEvent,
    lifeAreaSchedules,
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
  const unpinTaskRef = useRef(unpinTask);
  const updateTaskRef = useRef(updateTask);
  const tasksRef = useRef(tasks);
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
  unpinTaskRef.current = unpinTask;
  updateTaskRef.current = updateTask;
  tasksRef.current = tasks;
  const commandHistoryRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const lastMessageWasVoiceRef = useRef(false);
  const recentEntitiesRef = useRef<Array<{ id: string; kind: "task" | "event"; title: string }>>([]);
  const batchUndoHandlersRef = useRef<Record<string, Record<string, () => Promise<void>>>>({});
  const { toastState, toastMessage, withSaveIndicator, setRetry, dismiss, retryFn } =
    useSaveIndicator({ threshold: 500, successMessage: "Saved" });

  const schedulePreferences = useMemo(
    () => buildSchedulePreferences(lifeAreaSchedules, categories),
    [lifeAreaSchedules, categories],
  );
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [implementingPlanId, setImplementingPlanId] = useState<string | null>(null);
  const [implementingProposalId, setImplementingProposalId] = useState<string | null>(null);
  const [previewPlanMessageId, setPreviewPlanMessageId] = useState<string | null>(null);
  const [refinementState, setRefinementState] = useState<RefinementState>({ isActive: false });
  const [entryContextHandled, setEntryContextHandled] = useState(false);
  const [lifeAreaContextHandled, setLifeAreaContextHandled] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState<boolean | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakOverSilent, setSpeakOverSilent] = useState(false);
  const [silentHintMessage, setSilentHintMessage] = useState<string | null>(null);
  const [silentHintVisible, setSilentHintVisible] = useState(false);
  const [isParsingExternalPlan, setIsParsingExternalPlan] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasShownSilentHintRef = useRef(false);
  const silentHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    loadMessages();
    checkMicPermission();
    AsyncStorage.getItem(SPEAK_OVER_SILENT_MODE_KEY).then((val) => {
      if (val !== null) {
        setSpeakOverSilent(val === "true");
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (silentHintTimerRef.current) {
        clearTimeout(silentHintTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, isLoadingHistory]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  useEffect(() => {
    if (entryContext && !entryContextHandled && !isLoadingHistory) {
      setEntryContextHandled(true);
      
      const parentInfo = entryContext.parentTitle 
        ? `Parent: "${entryContext.parentTitle}". ` 
        : "";
      const bubbleInfo = entryContext.bubbleName 
        ? `in ${entryContext.bubbleName} bubble` 
        : "";
      
      const typeLabel = entryContext.entryType 
        ? entryContext.entryType.charAt(0).toUpperCase() + entryContext.entryType.slice(1)
        : entryContext.type.charAt(0).toUpperCase() + entryContext.type.slice(1);
      
      const contextualGreeting: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `I'm here to help with "${entryContext.title}" (${typeLabel}) ${bubbleInfo}.\n\n${parentInfo}What would you like to do with this entry?`,
        timestamp: new Date(),
        isRefinementPrompt: true,
        quickReplies: getEntryQuickActions(entryContext),
      };
      
      setMessages(prev => [...prev, contextualGreeting]);
      
      setRefinementState({
        isActive: true,
        bubbleId: entryContext.bubbleId,
        createdTaskIds: entryContext.type === "task" ? [entryContext.id] : [],
      });
    }
  }, [entryContext, entryContextHandled, isLoadingHistory]);

  useEffect(() => {
    if (
      lifeAreaContext &&
      !entryContext &&
      !lifeAreaContextHandled &&
      !isLoadingHistory
    ) {
      setLifeAreaContextHandled(true);

      const goalHint = lifeAreaContext.profile?.primaryGoal
        ? `\n\nYour primary goal: "${lifeAreaContext.profile.primaryGoal}".`
        : "";

      const planningQuickReplies = openPlanningSession
        ? [
            "Help me plan toward my primary goal",
            `Manifest a new goal in ${lifeAreaContext.name}`,
            "Break my focus areas into actionable steps",
          ]
        : undefined;

      const contextualGreeting: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `I'm your Coach for "${lifeAreaContext.name}".${goalHint}\n\nWhat would you like to work on in this Life Area?`,
        timestamp: new Date(),
        isRefinementPrompt: true,
        quickReplies: planningQuickReplies,
      };

      setMessages((prev) => [...prev, contextualGreeting]);

      setRefinementState({
        isActive: true,
        bubbleId: lifeAreaContext.categoryId,
      });

      if (initialPrompt?.trim()) {
        setInputText(initialPrompt.trim());
      }
    }
  }, [
    lifeAreaContext,
    entryContext,
    lifeAreaContextHandled,
    isLoadingHistory,
    openPlanningSession,
    initialPrompt,
  ]);

  const getEntryQuickActions = (context: EntryContext): string[] => {
    const actions: string[] = [];
    
    if (context.type === "task") {
      const taskType = context.entryType || "task";
      if (["goal", "objective", "project"].includes(taskType)) {
        actions.push("Plan sub-entries");
      }
      actions.push("Schedule this");
      actions.push("Make it a habit");
      actions.push("Assign to someone");
      actions.push("Give me advice");
    } else if (context.type === "habit") {
      actions.push("Improve this habit");
      actions.push("Schedule reminders");
      actions.push("Give me advice");
    } else if (context.type === "event") {
      actions.push("Create related tasks");
      actions.push("Reschedule");
      actions.push("Give me advice");
    }
    
    return actions;
  };

  const isWebPlatform = Platform.OS as string === "web";

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
          ]
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

  const cancelRecording = async () => {
    if (!isRecording) return;
    
    try {
      await audioRecorder.stop();
      setIsRecording(false);
      await AudioModule.setAudioModeAsync({
        allowsRecording: false,
      });
    } catch (error) {
      console.error("Failed to cancel recording:", error);
      setIsRecording(false);
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
        lastMessageWasVoiceRef.current = true;
        setTimeout(() => sendMessage(transcribedText), 100);
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

  const speakMessage = async (messageId: string, text: string) => {
    if (speakingMessageId === messageId) {
      Speech.stop();
      setSpeakingMessageId(null);
      return;
    }

    const cleanText = text
      .replace(/```json[\s\S]*?```/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();

    if (!cleanText) return;

    setSpeakingMessageId(messageId);

    if (speakOverSilent) {
      await AudioModule.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    }

    Speech.speak(cleanText, {
      language: "en-US",
      pitch: 1,
      rate: 0.9,
      onDone: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
      onStopped: () => setSpeakingMessageId(null),
    });

    if (!speakOverSilent && !hasShownSilentHintRef.current) {
      hasShownSilentHintRef.current = true;
      if (silentHintTimerRef.current) {
        clearTimeout(silentHintTimerRef.current);
      }
      setSilentHintMessage(
        "🔇 If you don't hear anything, your phone may be on silent. Enable 'Speak Over Silent Mode' in Settings to always hear responses.",
      );
      setSilentHintVisible(true);
      silentHintTimerRef.current = setTimeout(() => {
        setSilentHintVisible(false);
        setSilentHintMessage(null);
      }, 4000);
    }
  };

  const maybeAutoSpeakResponse = (messageId: string, text: string) => {
    if (lastMessageWasVoiceRef.current) {
      lastMessageWasVoiceRef.current = false;
      void speakMessage(messageId, text);
    }
  };

  const appendAssistantMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
    maybeAutoSpeakResponse(message.id, message.content);
  };

  const stopSpeaking = () => {
    Speech.stop();
    setSpeakingMessageId(null);
  };

  const loadMessages = async () => {
    try {
      const [storedMessages, storedRefinement] = await Promise.all([
        AsyncStorage.getItem(MESSAGES_STORAGE_KEY),
        AsyncStorage.getItem(REFINEMENT_STATE_KEY),
      ]);
      
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        const restored = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(restored);
      }
      
      if (storedRefinement) {
        setRefinementState(JSON.parse(storedRefinement));
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveMessages = async (msgs: Message[]) => {
    try {
      const last50 = msgs.slice(-50);
      await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(last50));
    } catch (error) {
      console.error("Failed to save messages:", error);
    }
  };

  const saveRefinementState = async (state: RefinementState) => {
    try {
      await AsyncStorage.setItem(REFINEMENT_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save refinement state:", error);
    }
  };

  const getAppContext = () =>
    buildAppContext({
      categories,
      tasks,
      habits,
      events,
      people,
      occurrences,
      schedulePreferences,
      refinementState,
      entryContext,
      lifeAreaContext: entryContext ? null : lifeAreaContext,
    });

  const getRefinementContext = () => {
    if (!refinementState.isActive || !refinementState.implementedPlan) return null;
    
    const planTasks = tasks.filter(t => 
      refinementState.createdTaskIds?.includes(t.id)
    );
    
    return {
      plan: refinementState.implementedPlan,
      tasks: planTasks.map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
      })),
      people: people.map(p => ({
        id: p.id,
        name: p.name,
        relationship: p.relationship,
      })),
      currentBranch: refinementState.currentBranch,
    };
  };

  const parseRefinementProposal = (content: string): RefinementProposal | null => {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return null;
    
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.type === "schedule" || parsed.type === "habit" || parsed.type === "assignment") {
        return parsed as RefinementProposal;
      }
    } catch (e) {
      console.error("Failed to parse refinement proposal:", e);
    }
    return null;
  };

  const detectExternalPlanRequest = (message: string): { isConvert: boolean; hasUrl: boolean; url?: string; planText?: string } => {
    const convertPatterns = [
      /convert\s+(?:this\s+)?(?:plan|text)/i,
      /import\s+(?:this\s+)?plan/i,
      /parse\s+(?:this\s+)?plan/i,
      /turn\s+(?:this\s+)?(?:into\s+)?(?:a\s+)?plan/i,
      /make\s+(?:this\s+)?(?:into\s+)?(?:a\s+)?plan/i,
      /create\s+(?:a\s+)?plan\s+from/i,
    ];
    
    const isConvert = convertPatterns.some(pattern => pattern.test(message));
    
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const urlMatch = message.match(urlPattern);
    const hasUrl = !!urlMatch;
    const url = urlMatch?.[0];
    
    let planText: string | undefined;
    if (isConvert && !hasUrl) {
      planText = message
        .replace(/convert\s+(?:this\s+)?(?:plan|text)\s*:?\s*/i, "")
        .replace(/import\s+(?:this\s+)?plan\s*:?\s*/i, "")
        .replace(/parse\s+(?:this\s+)?plan\s*:?\s*/i, "")
        .replace(/turn\s+(?:this\s+)?(?:into\s+)?(?:a\s+)?plan\s*:?\s*/i, "")
        .replace(/make\s+(?:this\s+)?(?:into\s+)?(?:a\s+)?plan\s*:?\s*/i, "")
        .replace(/create\s+(?:a\s+)?plan\s+from\s*:?\s*/i, "")
        .trim();
    }
    
    return { isConvert, hasUrl, url, planText };
  };

  const fetchUrlContent = async (
    url: string,
  ): Promise<{ content: string | null; errorType?: "blocked" | "unavailable" | "unknown" }> => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error("Anthropic API key not configured");
        return { content: null, errorType: "unknown" };
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: `Fetch and extract the full text content from this URL, preserving structure (headings, lists, sections): ${url}\n\nReturn ONLY the extracted content, no commentary.`,
            },
          ],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403) {
          return { content: null, errorType: "blocked" };
        }
        if (response.status === 404) {
          return { content: null, errorType: "unavailable" };
        }
        console.error("URL fetch failed:", response.status, errorText);
        return { content: null, errorType: "unknown" };
      }

      const data = await response.json();
      const textBlocks = data.content?.filter(
        (block: { type: string }) => block.type === "text",
      );
      const content =
        textBlocks?.map((b: { text: string }) => b.text).join("\n") ?? null;

      if (!content || content.trim().length < 20) {
        return { content: null, errorType: "unavailable" };
      }

      return { content };
    } catch (error) {
      console.error("Failed to fetch URL:", error);
      return { content: null, errorType: "unknown" };
    }
  };

  const buildCommandContext = (): CommandContext => ({
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    people: people.map((p) => ({ id: p.id, name: p.name })),
    pendingTasks: tasks
      .filter((t) => t.status === "pending")
      .map((t) => ({
        id: t.id,
        title: t.title,
        categoryName:
          categories.find((c) => c.id === t.categoryId)?.name ?? "Unsorted",
      })),
    habits: habits.map((h) => ({ id: h.id, title: h.name })),
    recentEntities: recentEntitiesRef.current,
    focusedEntry:
      entryContext?.type === "task"
        ? {
            id: entryContext.id,
            bubbleId: entryContext.bubbleId,
            title: entryContext.title,
          }
        : undefined,
    focusedLifeAreaId:
      !entryContext && lifeAreaContext ? lifeAreaContext.categoryId : undefined,
  });

  const applyEntryContextToCreateEntry = (
    input: CreateEntryInput,
  ): CreateEntryInput => {
    if (entryContext?.type === "task") {
      return {
        ...input,
        parentId: entryContext.id,
        categoryId: entryContext.bubbleId ?? input.categoryId,
      };
    }
    if (lifeAreaContext && !entryContext) {
      return {
        ...input,
        categoryId: lifeAreaContext.categoryId,
      };
    }
    return input;
  };

  const pushRecentEntity = (entity: { id: string; kind: "task" | "event"; title: string }) => {
    recentEntitiesRef.current = [
      entity,
      ...recentEntitiesRef.current.filter((e) => e.id !== entity.id),
    ].slice(0, 5);
  };

  const executeCommandAction = async (
    chatResult: CommandAction,
  ): Promise<CommandExecutionResult> => {
    switch (chatResult.type) {
      case "createEntry":
        return executeCreateEntry(
          applyEntryContextToCreateEntry(chatResult.input),
          {
            addTask,
            deleteTask: (id) => deleteTaskRef.current(id),
            categories,
          },
        );
      case "scheduleEvent":
        return executeScheduleEvent(chatResult.input, {
          addEvent,
          deleteEvent: (id) => deleteEventRef.current(id),
          getEventsByDate: (date) => getEventsByDateRef.current(date),
          categories,
        });
      case "createHabit":
        return executeCreateHabit(chatResult.input, {
          addHabit,
          deleteHabit: (id) => deleteHabitRef.current(id),
          getHabits: () => habitsRef.current,
          categories,
        });
      case "logHabit":
        return executeLogHabit(chatResult.input, {
          addOccurrence: (occ) => addOccurrenceRef.current(occ),
          deleteOccurrence: (id) => deleteOccurrenceRef.current(id),
          getHabitName: (id) =>
            habits.find((h) => h.id === id)?.name ?? "habit",
        });
      case "pinEntry":
        return executePinEntry(chatResult.input, {
          pinTask,
          unpinTask: (id) => unpinTaskRef.current(id),
          getTaskTitle: (id) =>
            tasksRef.current.find((t) => t.id === id)?.title ?? "entry",
        });
      case "completeEntry":
        return executeCompleteEntry(chatResult.input, {
          updateTask,
          getTaskTitle: (id) =>
            tasksRef.current.find((t) => t.id === id)?.title ?? "entry",
        });
      case "completeEntryUntil":
        return executeCompleteEntryUntil(chatResult.input, {
          updateTask,
          getTask: (id) => tasksRef.current.find((t) => t.id === id),
          getEvents: () => eventsRef.current,
          addEvent: (e) => addEventRef.current(e),
          updateEvent: (id, u) => updateEventRef.current(id, u),
          deleteEvent: (id) => deleteEventRef.current(id),
        });
      case "updateEntry":
        return executeUpdateEntry(chatResult.input, {
          updateTask,
          getTask: (id) => tasksRef.current.find((t) => t.id === id),
          categories,
        });
      case "updateEvent":
        return executeUpdateEvent(chatResult.input, {
          updateEvent: (id, u) => updateEventRef.current(id, u),
          getEvent: (id) => eventsRef.current.find((e) => e.id === id),
          categories,
        });
      default:
        return {
          success: false,
          message: "",
          undo: null,
          error: "Unknown command type",
        };
    }
  };

  const executeCommandBatch = async (
    actions: CommandAction[],
  ): Promise<{
    result: BatchExecutionResult;
    undoHandlers: Record<string, () => Promise<void>>;
  }> => {
    const summaryKind = inferBatchSummaryKind(actions);
    let categoryName = inferBatchCategoryName(actions, categories);
    if (
      !categoryName &&
      entryContext?.type === "task" &&
      entryContext.bubbleId
    ) {
      categoryName = categories.find((c) => c.id === entryContext.bubbleId)?.name;
    }
    const actionLabel = inferBatchActionLabel(actions);
    const items: BatchExecutionResult["items"] = [];
    const undoHandlers: Record<string, () => Promise<void>> = {};
    let succeeded = 0;
    let failed = 0;

    for (let index = 0; index < actions.length; index++) {
      const action = actions[index];
      const itemId = `${Date.now()}-${index}`;
      const displayAction =
        action.type === "createEntry"
          ? { ...action, input: applyEntryContextToCreateEntry(action.input) }
          : action;
      const display = getBatchItemDisplay(displayAction, categories);

      const execResult = await executeCommandAction(action);

      if (execResult.success) {
        succeeded++;
        if (execResult.trackedEntity) {
          pushRecentEntity(execResult.trackedEntity);
        }
        if (execResult.undo) {
          undoHandlers[itemId] = execResult.undo;
        }
        items.push({
          id: itemId,
          success: true,
          label: display.label,
          detail: display.detail,
          canUndo: Boolean(execResult.undo),
          icon: getBatchItemIcon(action),
        });
      } else {
        failed++;
        console.error("[CommandBatch] item failed:", execResult.error);
        items.push({
          id: itemId,
          success: false,
          label: display.label,
          detail: display.detail,
          error: execResult.error ?? "Failed to create",
          canUndo: false,
          icon: getBatchItemIcon(action),
        });
      }
    }

    const result: BatchExecutionResult = {
      total: actions.length,
      succeeded,
      failed,
      items,
      categoryName,
      actionLabel,
      summaryKind,
      summary: buildBatchSummary({
        total: actions.length,
        succeeded,
        failed,
        actionLabel,
        categoryName,
        summaryKind,
      }),
    };

    return { result, undoHandlers };
  };

  const handleBatchItemUndo = async (messageId: string, itemId: string) => {
    const handler = batchUndoHandlersRef.current[messageId]?.[itemId];
    if (!handler) return;

    await handler();

    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId || !message.batchCommandResult) {
          return message;
        }

        const updatedItems = message.batchCommandResult.items.map((item) =>
          item.id === itemId ? { ...item, undone: true } : item,
        );
        const activeSucceeded = updatedItems.filter(
          (item) => item.success && !item.undone,
        ).length;

        return {
          ...message,
          content: buildBatchSummary({
            total: message.batchCommandResult.total,
            succeeded: activeSucceeded,
            failed: message.batchCommandResult.failed,
            actionLabel: message.batchCommandResult.actionLabel,
            categoryName: message.batchCommandResult.categoryName,
            summaryKind: message.batchCommandResult.summaryKind,
          }),
          batchCommandResult: {
            ...message.batchCommandResult,
            succeeded: activeSucceeded,
            summary: buildBatchSummary({
              total: message.batchCommandResult.total,
              succeeded: activeSucceeded,
              failed: message.batchCommandResult.failed,
              actionLabel: message.batchCommandResult.actionLabel,
              categoryName: message.batchCommandResult.categoryName,
              summaryKind: message.batchCommandResult.summaryKind,
            }),
            items: updatedItems,
          },
        };
      }),
    );
  };

  const parseExternalPlan = async (planText: string): Promise<Plan | null> => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error("Anthropic API key not configured");
        return null;
      }

      const systemPrompt = `You convert informal plan text (which may be formatted as headers with bullet points, numbered lists, or loose paragraphs) into a structured JSON plan.

How to interpret the input:
- High-level section headers or bolded phrases (e.g. "Finish Core Feature Stability", "App Store Compliance & Polish") are OBJECTIVES — the major milestones of the plan.
- Each bullet point or line under an objective is a TASK belonging to that objective. Use a single "General" project under each objective unless the text clearly groups tasks into distinct sub-categories — if it does, those become PROJECTS.
- If an objective's tasks don't naturally divide into distinct sub-groups, put them all under a single project named exactly "General" — this will be automatically simplified during import, so always use the exact word "General" for this case rather than inventing another name.
- For each task: extract a short, clear TITLE (a few words, action-oriented), and put any additional context, reasoning, or specifics into the DESCRIPTION field. If a bullet point is short with no extra detail, the description can be brief or restate the title in plain language — never leave it empty.
- Set priority: "medium" for ALL tasks by default. Only set priority: "high" if the source text explicitly and specifically calls an item urgent, critical, or the single most important first step. Limit high priority to at most 1 item in the entire plan. Never infer high priority based on your own judgment about importance — only assign it when the source material explicitly demands it.
- The overall "goal" field should be a one-sentence summary of what the plan accomplishes.
- The "advice" field should be 1-2 sentences of practical guidance for executing this plan.
- The "suggestedBubble" field should be your best guess at which Life Area this belongs to (e.g. "App Development", "Business Planning", "Work") based on the content.

You MUST find actionable items in any plan-like text, even if loosely formatted. Only fail to extract a plan if the text is genuinely conversational with no list-like or task-like structure whatsoever (e.g. casual chat with no goals mentioned).

Respond ONLY with valid JSON in this exact shape, no markdown fences, no commentary before or after:
{
  "goal": "string",
  "advice": "string",
  "suggestedBubble": "string",
  "objectives": [
    {
      "name": "string",
      "projects": [
        {
          "name": "string",
          "tasks": [
            { "title": "string", "description": "string", "priority": "low" | "medium" | "high" }
          ]
        }
      ]
    }
  ]
}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: "user", content: planText }],
        }),
      });

      console.log("[ParseExternalPlan] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Plan parse failed:", response.status, errorText);
        return null;
      }

      const data = await response.json();
      const textBlock = data.content?.find(
        (block: { type: string }) => block.type === "text",
      );
      console.log("[ParseExternalPlan] Raw Claude response:", textBlock?.text);
      if (!textBlock?.text) return null;

      const cleanJson = textBlock.text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      console.log("[ParseExternalPlan] Cleaned JSON string:", cleanJson);

      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error("[ParseExternalPlan] JSON.parse failed:", parseError);
        console.error(
          "[ParseExternalPlan] Content that failed to parse:",
          cleanJson,
        );
        return null;
      }

      console.log(
        "[ParseExternalPlan] Parsed object:",
        JSON.stringify(parsed, null, 2),
      );

      return {
        goal: parsed.goal || "Imported Plan",
        advice: parsed.advice || "Imported from external source",
        suggestedBubble: parsed.suggestedBubble || "General",
        objectives: (parsed.objectives || []).map((obj: any) => ({
          name: obj.name,
          projects: (obj.projects || []).map((proj: any) => ({
            name: proj.name,
            tasks: (proj.tasks || []).map((task: any) => ({
              title: task.title,
              description: task.description || "",
              priority: task.priority || "medium",
            })),
          })),
        })),
      };
    } catch (error) {
      console.error("Failed to parse plan:", error);
      return null;
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const messageText = overrideText || inputText.trim();
    if (!messageText || isLoading || isParsingExternalPlan) return;

    if (!overrideText) {
      lastMessageWasVoiceRef.current = false;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");

    const externalPlanRequest = detectExternalPlanRequest(messageText);
    
    if (externalPlanRequest.isConvert || externalPlanRequest.hasUrl) {
      setIsParsingExternalPlan(true);
      
      try {
        let planTextToConvert: string | null = null;
        let importSource: "text" | "url" = "text";
        
        if (externalPlanRequest.hasUrl && externalPlanRequest.url) {
          importSource = "url";
          const statusMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Fetching content from the link...",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, statusMessage]);
          
          const fetchResult = await fetchUrlContent(externalPlanRequest.url);
          planTextToConvert = fetchResult.content;
          
          if (!planTextToConvert) {
            setMessages(prev => prev.filter(m => m.id !== statusMessage.id));
            
            let errorContent = "";
            if (fetchResult.errorType === "blocked") {
              errorContent = "That link is protected and can't be accessed directly (sites like Grok and ChatGPT block automated access).\n\n**Instead, try this:**\n1. Open the link in your browser\n2. Copy the plan text from the page\n3. Paste it here with \"Convert this plan:\" before it\n\nExample: \"Convert this plan: [paste your plan here]\"";
            } else if (fetchResult.errorType === "unavailable") {
              errorContent = "That link appears to be unavailable or expired. Please check the URL and try again, or copy/paste the plan content directly.";
            } else {
              errorContent = "I couldn't fetch content from that link. Try copying and pasting the plan text directly instead.\n\nExample: \"Convert this plan: [paste your plan here]\"";
            }
            
            const errorMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: "assistant",
              content: errorContent,
              timestamp: new Date(),
            };
            appendAssistantMessage(errorMessage);
            return;
          }
          
          setMessages(prev => prev.map(m => 
            m.id === statusMessage.id 
              ? { ...m, content: "Content fetched! Converting to a structured plan..." }
              : m
          ));
        } else if (externalPlanRequest.planText) {
          planTextToConvert = externalPlanRequest.planText;
          
          const statusMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Converting your text to a structured plan...",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, statusMessage]);
        }
        
        if (planTextToConvert && planTextToConvert.length > 20) {
          const parsedPlan = await parseExternalPlan(planTextToConvert);
          
          setMessages(prev => prev.filter(m => 
            !m.content.includes("Converting") && !m.content.includes("Fetching") && !m.content.includes("Content fetched")
          ));
          
          if (parsedPlan) {
            const successMessage: Message = {
              id: (Date.now() + 3).toString(),
              role: "assistant",
              content: `I've converted your ${importSource === "url" ? "linked content" : "text"} into a structured plan! Here's what I found:`,
              timestamp: new Date(),
              plan: parsedPlan,
              planImplemented: false,
              isImportedPlan: true,
              importSource,
            };
            appendAssistantMessage(successMessage);
          } else {
            const errorMessage: Message = {
              id: (Date.now() + 3).toString(),
              role: "assistant",
              content: "I couldn't convert that into a structured plan. The text might not contain actionable items. Try providing a more detailed plan with specific goals and tasks.",
              timestamp: new Date(),
            };
            appendAssistantMessage(errorMessage);
          }
        } else {
          setMessages(prev => prev.filter(m => 
            !m.content.includes("Converting")
          ));
          
          const errorMessage: Message = {
            id: (Date.now() + 3).toString(),
            role: "assistant",
            content: "Please provide more content to convert. You can:\n\n• Paste plan text after \"Convert this plan:\"\n• Share a link to a ChatGPT or Grok conversation\n\nExample: \"Convert this plan: 1. Wake up early, 2. Exercise, 3. Work on project...\"",
            timestamp: new Date(),
          };
          appendAssistantMessage(errorMessage);
        }
      } catch (error) {
        console.error("External plan parsing error:", error);
        const errorMessage: Message = {
          id: (Date.now() + 3).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error while processing your plan. Please try again.",
          timestamp: new Date(),
        };
        appendAssistantMessage(errorMessage);
      } finally {
        setIsParsingExternalPlan(false);
      }
      return;
    }

    setIsLoading(true);

    try {
      const conversationHistory = messages
        .filter(
          (m) =>
            m.content &&
            m.content.trim().length > 0 &&
            !m.plan &&
            !m.refinementProposal,
        )
        .slice(-20)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const clarificationHistory = commandHistoryRef.current;
      const chatResult = await parseChatMessage(
        messageText,
        buildCommandContext(),
        clarificationHistory.length > 0
          ? clarificationHistory
          : conversationHistory,
      );

      if (chatResult.type === "clarification") {
        commandHistoryRef.current = [
          ...clarificationHistory,
          { role: "user", content: messageText },
          { role: "assistant", content: chatResult.question },
        ];

        const clarificationMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: chatResult.question,
          timestamp: new Date(),
          quickReplies: chatResult.options,
          isCommandClarification: true,
        };
        appendAssistantMessage(clarificationMessage);
        return;
      }

      if (chatResult.type === "error") {
        commandHistoryRef.current = [];
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: chatResult.message,
          timestamp: new Date(),
        };
        appendAssistantMessage(errorMessage);
        return;
      }

      if (chatResult.type === "batch") {
        commandHistoryRef.current = [];

        const batchActionLabel = inferBatchActionLabel(chatResult.actions);
        const statusMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Adding ${batchActionLabel}…`,
          timestamp: new Date(),
        };
        appendAssistantMessage(statusMessage);

        const { result: batchResult, undoHandlers } = await executeCommandBatch(
          chatResult.actions,
        );

        const confirmMessageId = (Date.now() + 2).toString();
        batchUndoHandlersRef.current[confirmMessageId] = undoHandlers;

        setMessages((prev) => {
          const withoutStatus = prev.filter((m) => m.id !== statusMessage.id);
          return [
            ...withoutStatus,
            {
              id: confirmMessageId,
              role: "assistant",
              content: batchResult.summary,
              timestamp: new Date(),
              batchCommandResult: batchResult,
            },
          ];
        });
        return;
      }

      if (chatResult.type !== "conversation") {
        const execResult = await executeCommandAction(chatResult);
        commandHistoryRef.current = [];

        if (execResult.success) {
          if (execResult.trackedEntity) {
            pushRecentEntity(execResult.trackedEntity);
          }
          const confirmMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: execResult.message,
            timestamp: new Date(),
          };
          appendAssistantMessage(confirmMessage);
        } else {
          console.error("[Command] action failed:", execResult.error);
          const failMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Sorry, I couldn't complete that action. Please try again.",
            timestamp: new Date(),
          };
          appendAssistantMessage(failMessage);
        }
        return;
      }

      commandHistoryRef.current = [];

      const refinementContext = getRefinementContext();
      const appContext = getAppContext();
      let endRefinement = false;
      let selectedSystemPrompt: string;

      if (refinementState.isActive && refinementContext) {
        const branch = isRefinementBranchRequest(messageText);

        if (branch === "done") {
          endRefinement = true;
          selectedSystemPrompt = getRegularSystemPrompt(appContext);
        } else if (branch === "scheduling") {
          selectedSystemPrompt = getSchedulingPrompt(appContext, refinementContext);
        } else if (branch === "habits") {
          selectedSystemPrompt = getHabitsPrompt(appContext, refinementContext);
        } else if (branch === "assignments") {
          selectedSystemPrompt = getAssignmentsPrompt(appContext, refinementContext);
        } else {
          selectedSystemPrompt = `You are helping the user refine their recently created plan: "${refinementContext?.plan?.goal || 'their goal'}".
          
The user said: "${messageText}"

If they're asking about scheduling, due dates, or timelines, help them set up a schedule.
If they're asking about habits or recurring tasks, help identify potential habits.
If they're asking about assignments or delegation, help assign tasks to people.
If they seem done or want to finish, acknowledge completion and wish them luck.

Available options to remind them of:
- Scheduling (due dates, reminders, milestones)
- Habits (convert recurring tasks into Build or Break habits)
- Assignments (delegate tasks to contacts)

Be conversational and helpful.`;
        }
      } else if (isPlanningRequest(messageText)) {
        selectedSystemPrompt = getPlanningSystemPrompt(appContext);
      } else {
        selectedSystemPrompt = getRegularSystemPrompt(appContext);
      }

      const aiResponse = await sendToAI({
        message: messageText,
        context: appContext,
        history: messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content,
        })),
        systemPrompt: selectedSystemPrompt,
      });

      const data = {
        message: aiResponse,
        isPlanningResponse: isPlanningRequest(messageText),
        endRefinement,
        quickReplies: [] as string[],
      };
      const messageContent = data.message || "I apologize, but I couldn't process your request.";
      
      const plan = parsePlanFromMessage(messageContent);
      const refinementProposal = !plan ? parseRefinementProposal(messageContent) : null;
      const textContent = extractTextFromMessage(messageContent);
      
      const quickReplies = data.quickReplies || extractQuickReplies(messageContent);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: messageContent,
        timestamp: new Date(),
        plan: plan || undefined,
        planImplemented: false,
        refinementProposal: refinementProposal || undefined,
        proposalImplemented: false,
        quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
      };

      appendAssistantMessage(assistantMessage);
      
      if (data.endRefinement) {
        const newState = { isActive: false };
        setRefinementState(newState);
        saveRefinementState(newState);
      }
    } catch (error) {
      console.error("Assistant error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      appendAssistantMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const extractQuickReplies = (content: string): string[] => {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes("scheduling") && lowerContent.includes("habits") && lowerContent.includes("assignments")) {
      return ["Add scheduling", "Create habits", "Assign people", "I'm done"];
    }
    
    if (lowerContent.includes("anything else") || lowerContent.includes("would you like")) {
      return ["Yes", "No, I'm done"];
    }
    
    return [];
  };

  const implementPlan = async (messageId: string, plan: Plan) => {
    setImplementingPlanId(messageId);

    const performImplement = async () => {
      const createdTaskIds: string[] = [];

      let categoryId: string | undefined;
      let parentEntryId: string | null = null;
      
      if (entryContext && entryContext.type === "task") {
        categoryId = entryContext.bubbleId;
        parentEntryId = entryContext.id;
      } else if (lifeAreaContext && !entryContext) {
        categoryId = lifeAreaContext.categoryId;
      } else {
        categoryId = categories.find(
          c => c.name.toLowerCase() === plan.suggestedBubble.toLowerCase()
        )?.id;

        if (!categoryId) {
          const similarCategory = categories.find(c => 
            c.name.toLowerCase().includes(plan.suggestedBubble.toLowerCase()) ||
            plan.suggestedBubble.toLowerCase().includes(c.name.toLowerCase())
          );
          
          if (similarCategory) {
            categoryId = similarCategory.id;
          } else {
            await addCategory({
              name: plan.suggestedBubble,
              description: `Created for: ${plan.goal}`,
              color: "#3B82F6",
              icon: "target",
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const newCategory = categories.find(c => c.name === plan.suggestedBubble);
            categoryId = newCategory?.id;
          }
        }
      }

      if (!categoryId) {
        categoryId = categories[0]?.id || "";
      }

      let createdCount = 0;
      let failedCount = 0;

      let goalId: string;
      
      if (parentEntryId) {
        goalId = parentEntryId;
        createdTaskIds.push(parentEntryId);
      } else {
        const createdGoal = await addTask({
          title: plan.goal,
          description: plan.advice,
          type: "goal" as TaskType,
          categoryId,
          parentId: null,
          priority: "medium",
          status: "pending",
        });

        if (!createdGoal) {
          console.error("Failed to create goal task");
          throw new Error("Failed to create goal task");
        }
        createdCount++;
        createdTaskIds.push(createdGoal.id);
        goalId = createdGoal.id;
      }

      let firstTaskCreated = false;

      for (const objective of plan.objectives) {
        const createdObjective = await addTask({
          title: objective.name,
          description: "",
          type: "objective" as TaskType,
          categoryId,
          parentId: goalId,
          priority: "medium",
          status: "pending",
        });

        if (!createdObjective) {
          console.error(`Failed to create objective: ${objective.name}`);
          failedCount++;
          continue;
        }
        createdCount++;
        createdTaskIds.push(createdObjective.id);
        const objectiveId = createdObjective.id;

        const projects = objective.projects || [];
        const shouldFlattenProjects =
          projects.length === 1 &&
          projects[0].name.trim().toLowerCase() === "general";

        if (shouldFlattenProjects) {
          const tasksToCreate = projects[0].tasks || [];
          for (const taskItem of tasksToCreate) {
            const isFirstTask = !firstTaskCreated;
            if (isFirstTask) {
              firstTaskCreated = true;
            }
            const taskPriority = isFirstTask
              ? "high"
              : taskItem.priority === "high"
                ? "medium"
                : taskItem.priority || "medium";
            const taskIsPinned = isFirstTask;
            const taskPinnedOrder = isFirstTask ? 0 : undefined;

            const createdTask = await addTask({
              title: taskItem.title,
              description: taskItem.description || "",
              type: "task" as TaskType,
              categoryId,
              parentId: objectiveId,
              priority: taskPriority,
              isPinned: taskIsPinned,
              ...(taskPinnedOrder !== undefined
                ? { pinnedOrder: taskPinnedOrder }
                : {}),
              status: "pending",
            });

            if (!createdTask) {
              console.error(`Failed to create task: ${taskItem.title}`);
              failedCount++;
              continue;
            }
            createdCount++;
            createdTaskIds.push(createdTask.id);
          }
        } else if (projects.length > 0) {
          for (const project of projects) {
            const createdProject = await addTask({
              title: project.name,
              description: "",
              type: "project" as TaskType,
              categoryId,
              parentId: objectiveId,
              priority: "medium",
              status: "pending",
            });

            if (!createdProject) {
              console.error(`Failed to create project: ${project.name}`);
              failedCount++;
              continue;
            }
            createdCount++;
            createdTaskIds.push(createdProject.id);
            const projectId = createdProject.id;

            for (const taskItem of project.tasks) {
              const isFirstTask = !firstTaskCreated;
              if (isFirstTask) {
                firstTaskCreated = true;
              }
              const taskPriority = isFirstTask
                ? "high"
                : taskItem.priority === "high"
                  ? "medium"
                  : taskItem.priority || "medium";
              const taskIsPinned = isFirstTask;
              const taskPinnedOrder = isFirstTask ? 0 : undefined;

              const createdTask = await addTask({
                title: taskItem.title,
                description: taskItem.description,
                type: "task" as TaskType,
                categoryId,
                parentId: projectId,
                priority: taskPriority,
                isPinned: taskIsPinned,
                ...(taskPinnedOrder !== undefined
                  ? { pinnedOrder: taskPinnedOrder }
                  : {}),
                status: "pending",
              });

              if (!createdTask) {
                console.error(`Failed to create task: ${taskItem.title}`);
                failedCount++;
              } else {
                createdCount++;
                createdTaskIds.push(createdTask.id);
              }
            }
          }
        }

        if (objective.tasks && objective.tasks.length > 0) {
          for (const taskItem of objective.tasks) {
            const isFirstTask = !firstTaskCreated;
            if (isFirstTask) {
              firstTaskCreated = true;
            }
            const taskPriority = isFirstTask
              ? "high"
              : taskItem.priority === "high"
                ? "medium"
                : taskItem.priority || "medium";
            const taskIsPinned = isFirstTask;
            const taskPinnedOrder = isFirstTask ? 0 : undefined;

            const createdTask = await addTask({
              title: taskItem.title,
              description: taskItem.description,
              type: "task" as TaskType,
              categoryId,
              parentId: objectiveId,
              priority: taskPriority,
              isPinned: taskIsPinned,
              ...(taskPinnedOrder !== undefined
                ? { pinnedOrder: taskPinnedOrder }
                : {}),
              status: "pending",
            });

            if (!createdTask) {
              console.error(`Failed to create task: ${taskItem.title}`);
              failedCount++;
            } else {
              createdCount++;
              createdTaskIds.push(createdTask.id);
            }
          }
        }
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, planImplemented: true } : m
      ));

      const newRefinementState: RefinementState = {
        isActive: true,
        implementedPlan: plan,
        createdTaskIds,
        currentBranch: null,
        bubbleId: categoryId,
      };
      setRefinementState(newRefinementState);
      saveRefinementState(newRefinementState);

      const refinementMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Great! Your "${plan.goal}" plan has been created with ${createdCount} items in the ${plan.suggestedBubble} bubble!\n\nWould you like to enhance this plan further? I can help you with:\n\n- **Scheduling**: Set due dates, milestones, and reminders\n- **Habits**: Convert recurring tasks into trackable habits\n- **Assignments**: Assign tasks to people in your contacts\n\nWhat would you like to do?`,
        timestamp: new Date(),
        isRefinementPrompt: true,
        quickReplies: ["Add scheduling", "Create habits", "Assign people", "I'm done for now"],
      };

      setMessages(prev => [...prev, refinementMessage]);
    };

    setRetry(() => {
      void implementPlan(messageId, plan);
    });
    try {
      await withSaveIndicator(performImplement);
    } catch (error) {
      console.error("Failed to implement plan:", error);
    } finally {
      setImplementingPlanId(null);
    }
  };

  const implementScheduleProposal = async (messageId: string, proposal: ScheduleProposal) => {
    setImplementingProposalId(messageId);

    const performImplement = async () => {
      let eventCount = 0;

      for (const taskSchedule of proposal.tasks) {
        const task = tasks.find(t => t.id === taskSchedule.taskId);
        if (task) {
          await addEvent({
            title: `Due: ${task.title}`,
            description: task.description || "",
            startDate: taskSchedule.suggestedDueDate,
            startTime: "09:00",
            endDate: taskSchedule.suggestedDueDate,
            endTime: "10:00",
            eventType: "reminder",
            recurrence: "none",
            linkedTaskId: task.id,
            categoryId: refinementState.bubbleId || categories[0]?.id || null,
          });
          eventCount++;
        }
      }

      if (proposal.events) {
        for (const eventData of proposal.events) {
          await addEvent({
            title: eventData.title,
            description: "",
            startDate: eventData.date,
            startTime: eventData.time || "09:00",
            endDate: eventData.date,
            endTime: eventData.time ? `${parseInt(eventData.time.split(":")[0]) + 1}:00` : "10:00",
            eventType: "reminder",
            recurrence: eventData.isRecurring ? "weekly" : "none",
            linkedTaskId: null,
            categoryId: refinementState.bubbleId || categories[0]?.id || null,
          });
          eventCount++;
        }
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, proposalImplemented: true } : m
      ));

      const followUpMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Done! I've created ${eventCount} calendar event${eventCount !== 1 ? "s" : ""} with due date reminders linked to your tasks.\n\nWould you like to do anything else with this plan?`,
        timestamp: new Date(),
        quickReplies: ["Create habits", "Assign people", "I'm done"],
      };

      setMessages(prev => [...prev, followUpMessage]);
    };

    setRetry(() => {
      void implementScheduleProposal(messageId, proposal);
    });
    try {
      await withSaveIndicator(performImplement);
    } catch (error) {
      console.error("Failed to implement schedule:", error);
    } finally {
      setImplementingProposalId(null);
    }
  };

  const implementHabitProposal = async (messageId: string, proposal: HabitProposal) => {
    setImplementingProposalId(messageId);

    const performImplement = async () => {
      let createdCount = 0;

      for (const suggestion of proposal.suggestions) {
        await addHabit({
          name: suggestion.habitName,
          description: `Created from plan refinement`,
          categoryId: refinementState.bubbleId || categories[0]?.id || null,
          goalFrequency: suggestion.frequency,
          habitType: suggestion.habitType,
          goalCount: suggestion.goalCount || 1,
          linkedTaskId: null,
          isActive: true,
        });
        createdCount++;
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, proposalImplemented: true } : m
      ));

      const followUpMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Created ${createdCount} new habit${createdCount !== 1 ? "s" : ""}! You can track your progress in the Habits section.\n\nAnything else you'd like to do with this plan?`,
        timestamp: new Date(),
        quickReplies: ["Add scheduling", "Assign people", "I'm done"],
      };

      setMessages(prev => [...prev, followUpMessage]);
    };

    setRetry(() => {
      void implementHabitProposal(messageId, proposal);
    });
    try {
      await withSaveIndicator(performImplement);
    } catch (error) {
      console.error("Failed to create habits:", error);
    } finally {
      setImplementingProposalId(null);
    }
  };

  const implementAssignmentProposal = async (messageId: string, proposal: AssignmentProposal) => {
    setImplementingProposalId(messageId);

    const performImplement = async () => {
      let assignedCount = 0;

      for (const suggestion of proposal.suggestions) {
        const personIds = suggestion.suggestedPeople.map(p => p.personId);
        await updateTask(suggestion.taskId, {
          assigneeIds: personIds,
        });
        assignedCount++;
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, proposalImplemented: true } : m
      ));

      const followUpMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Assigned ${assignedCount} task${assignedCount !== 1 ? "s" : ""} to your contacts! They'll be notified about their assignments.\n\nWould you like to do anything else?`,
        timestamp: new Date(),
        quickReplies: ["Add scheduling", "Create habits", "I'm done"],
      };

      setMessages(prev => [...prev, followUpMessage]);
    };

    setRetry(() => {
      void implementAssignmentProposal(messageId, proposal);
    });
    try {
      await withSaveIndicator(performImplement);
    } catch (error) {
      console.error("Failed to assign tasks:", error);
    } finally {
      setImplementingProposalId(null);
    }
  };

  const handleQuickReply = (reply: string, isCommandClarification?: boolean) => {
    if (isCommandClarification) {
      sendMessage(reply);
      return;
    }

    const lowerReply = reply.toLowerCase();
    
    if (lowerReply.includes("done") || lowerReply === "no") {
      const newState = { isActive: false };
      setRefinementState(newState);
      saveRefinementState(newState);
      
      const closingMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Perfect! Your plan is all set. Good luck with your goals! Feel free to come back anytime if you need more help.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, closingMessage]);
    } else {
      sendMessage(reply);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const renderProposal = (proposal: RefinementProposal, messageId: string, isImplemented: boolean) => {
    if (isImplemented) {
      return (
        <View style={[styles.implementedBadge, { backgroundColor: theme.success + "20" }]}>
          <Feather name="check-circle" size={16} color={theme.success} />
          <ThemedText style={[styles.implementedText, { color: theme.success }]}>
            {proposal.type === "schedule" ? "Schedule applied" : 
             proposal.type === "habit" ? "Habits created" : "Assignments made"}
          </ThemedText>
        </View>
      );
    }

    const isImplementing = implementingProposalId === messageId;

    if (proposal.type === "schedule") {
      return (
        <View style={[styles.proposalCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.proposalHeader}>
            <Feather name="calendar" size={20} color={theme.primary} />
            <ThemedText style={styles.proposalTitle}>Proposed Schedule</ThemedText>
          </View>
          {proposal.tasks.slice(0, 5).map((task, index) => (
            <View key={index} style={styles.proposalItem}>
              <ThemedText style={styles.proposalItemTitle}>{task.title}</ThemedText>
              <ThemedText style={[styles.proposalItemMeta, { color: theme.textSecondary }]}>
                Due: {new Date(task.suggestedDueDate).toLocaleDateString()}
              </ThemedText>
            </View>
          ))}
          {proposal.tasks.length > 5 && (
            <ThemedText style={[styles.proposalMore, { color: theme.textSecondary }]}>
              +{proposal.tasks.length - 5} more tasks
            </ThemedText>
          )}
          <Pressable
            style={[styles.proposalButton, { backgroundColor: theme.primary }]}
            onPress={() => implementScheduleProposal(messageId, proposal)}
            disabled={isImplementing}
          >
            {isImplementing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.proposalButtonText}>Apply Schedule</ThemedText>
            )}
          </Pressable>
        </View>
      );
    }

    if (proposal.type === "habit") {
      return (
        <View style={[styles.proposalCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.proposalHeader}>
            <Feather name="repeat" size={20} color={theme.primary} />
            <ThemedText style={styles.proposalTitle}>Suggested Habits</ThemedText>
          </View>
          {proposal.suggestions.map((habit, index) => (
            <View key={index} style={styles.proposalItem}>
              <ThemedText style={styles.proposalItemTitle}>{habit.habitName}</ThemedText>
              <ThemedText style={[styles.proposalItemMeta, { color: theme.textSecondary }]}>
                {habit.frequency} • {habit.habitType}
              </ThemedText>
            </View>
          ))}
          <Pressable
            style={[styles.proposalButton, { backgroundColor: theme.primary }]}
            onPress={() => implementHabitProposal(messageId, proposal)}
            disabled={isImplementing}
          >
            {isImplementing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.proposalButtonText}>Create Habits</ThemedText>
            )}
          </Pressable>
        </View>
      );
    }

    if (proposal.type === "assignment") {
      return (
        <View style={[styles.proposalCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.proposalHeader}>
            <Feather name="users" size={20} color={theme.primary} />
            <ThemedText style={styles.proposalTitle}>Suggested Assignments</ThemedText>
          </View>
          {proposal.suggestions.map((assignment, index) => (
            <View key={index} style={styles.proposalItem}>
              <ThemedText style={styles.proposalItemTitle}>{assignment.taskTitle}</ThemedText>
              <ThemedText style={[styles.proposalItemMeta, { color: theme.textSecondary }]}>
                Assign to: {assignment.suggestedPeople.map(p => p.personName).join(", ")}
              </ThemedText>
            </View>
          ))}
          <Pressable
            style={[styles.proposalButton, { backgroundColor: theme.primary }]}
            onPress={() => implementAssignmentProposal(messageId, proposal)}
            disabled={isImplementing}
          >
            {isImplementing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.proposalButtonText}>Assign Tasks</ThemedText>
            )}
          </Pressable>
        </View>
      );
    }

    return null;
  };

  const renderQuickReplies = (replies: string[], isCommandClarification?: boolean) => (
    <View style={styles.quickRepliesContainer}>
      {replies.map((reply, index) => (
        <Pressable
          key={index}
          style={[styles.quickReplyChip, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}
          onPress={() => handleQuickReply(reply, isCommandClarification)}
        >
          <ThemedText style={[styles.quickReplyText, { color: theme.primary }]}>{reply}</ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    
    if (!isUser && item.batchCommandResult) {
      return (
        <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
          <View
            style={[
              styles.messageBubble,
              styles.assistantBubble,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ThemedText style={styles.messageText}>{item.content}</ThemedText>
            <CommandBatchSummary
              result={item.batchCommandResult}
              onUndoItem={(itemId) => handleBatchItemUndo(item.id, itemId)}
              canUndoItem={(itemId) =>
                Boolean(batchUndoHandlersRef.current[item.id]?.[itemId])
              }
            />
          </View>
        </View>
      );
    }

    if (!isUser && item.plan && !item.planImplemented) {
      const textContent = extractTextFromMessage(item.content);
      
      return (
        <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
          {textContent ? (
            <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: theme.backgroundDefault, marginBottom: Spacing.sm }]}>
              <ThemedText style={styles.messageText}>{textContent}</ThemedText>
            </View>
          ) : null}
          <PlanPreviewButton
            plan={item.plan}
            onPress={() => setPreviewPlanMessageId(item.id)}
          />
        </View>
      );
    }

    if (!isUser && item.planImplemented && item.plan) {
      return (
        <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
          <View style={[styles.implementedBadge, { backgroundColor: theme.success + "20" }]}>
            <Feather name="check-circle" size={16} color={theme.success} />
            <ThemedText style={[styles.implementedText, { color: theme.success }]}>
              Plan "{item.plan.goal}" implemented
            </ThemedText>
          </View>
        </View>
      );
    }

    if (!isUser && item.refinementProposal) {
      const textContent = extractTextFromMessage(item.content);
      
      return (
        <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
          {textContent ? (
            <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: theme.backgroundDefault, marginBottom: Spacing.sm }]}>
              <ThemedText style={styles.messageText}>{textContent}</ThemedText>
            </View>
          ) : null}
          {renderProposal(item.refinementProposal, item.id, item.proposalImplemented || false)}
        </View>
      );
    }
    
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.assistantMessageContainer]}>
        <View style={[
          styles.messageBubble,
          isUser 
            ? [styles.userBubble, { backgroundColor: theme.primary }]
            : [styles.assistantBubble, { backgroundColor: theme.backgroundDefault }],
        ]}>
          <ThemedText style={[styles.messageText, isUser && { color: "#FFFFFF" }]}>
            {item.content}
          </ThemedText>
        </View>
        {!isUser && (
          <View style={styles.messageActions}>
            <Pressable
              style={[styles.speakButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => speakMessage(item.id, item.content)}
            >
              <Feather 
                name={speakingMessageId === item.id ? "volume-x" : "volume-2"} 
                size={14} 
                color={speakingMessageId === item.id ? theme.error : theme.textSecondary} 
              />
              <ThemedText style={[styles.speakButtonText, { color: theme.textSecondary }]}>
                {speakingMessageId === item.id ? "Stop" : "Read aloud"}
              </ThemedText>
            </Pressable>
          </View>
        )}
        {!isUser && item.quickReplies && item.quickReplies.length > 0 && (
          renderQuickReplies(item.quickReplies, item.isCommandClarification)
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoadingHistory) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }
    
    return (
        <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="zap" size={32} color={theme.primary} />
        </View>
        <ThemedText style={styles.emptyTitle}>Hi! I'm your Life Coach</ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Ask me anything about organizing your life, or try planning a goal:
        </ThemedText>
        <View style={styles.suggestionContainer}>
          <Pressable 
            style={[styles.suggestionChip, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => setInputText("Plan to run a marathon")}
          >
            <ThemedText style={styles.suggestionText}>Plan to run a marathon</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.suggestionChip, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => setInputText("Help me learn a new language")}
          >
            <ThemedText style={styles.suggestionText}>Help me learn a new language</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.suggestionChip, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => setInputText("I want to save money for vacation")}
          >
            <ThemedText style={styles.suggestionText}>I want to save money for vacation</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <ThemedView style={styles.container}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.messageList,
            { 
              paddingTop: Spacing.md,
              paddingBottom: Spacing.md,
            },
            messages.length === 0 && styles.emptyListContainer,
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
        
        {isRecording && (
          <View style={[styles.recordingOverlay, { backgroundColor: theme.backgroundDefault }]}>
            <Animated.View 
              style={[
                styles.recordingIndicator,
                { 
                  backgroundColor: theme.error + "20",
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Feather name="mic" size={32} color={theme.error} />
            </Animated.View>
            <ThemedText style={styles.recordingText}>Listening...</ThemedText>
            <ThemedText style={[styles.recordingHint, { color: theme.textSecondary }]}>
              Tap the mic button to stop
            </ThemedText>
          </View>
        )}

        {isTranscribing && (
          <View style={[styles.recordingOverlay, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={styles.recordingText}>Transcribing...</ThemedText>
          </View>
        )}

        <View style={[
          styles.inputContainer,
          { 
            backgroundColor: theme.backgroundDefault,
            paddingBottom: Spacing.sm,
            borderTopColor: theme.border,
          },
        ]}>
          <View style={[
            styles.inputWrapper,
            { backgroundColor: theme.backgroundRoot },
          ]}>
            <Animated.View style={{ transform: [{ scale: isRecording ? pulseAnim : 1 }] }}>
              <Pressable
                style={[
                  styles.micButton,
                  { 
                    backgroundColor: isRecording ? theme.error : "transparent",
                  },
                ]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isTranscribing || isParsingExternalPlan}
              >
                <Feather 
                  name={isRecording ? "mic-off" : "mic"} 
                  size={20} 
                  color={isRecording ? "#FFFFFF" : theme.primary} 
                />
              </Pressable>
            </Animated.View>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder={isRecording ? "Listening..." : isParsingExternalPlan ? "Converting plan..." : "Ask your Life Coach..."}
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              editable={!isLoading && !isRecording && !isParsingExternalPlan}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: theme.primary },
                (!inputText.trim() || isLoading || isRecording || isParsingExternalPlan) && { opacity: 0.5 },
              ]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading || isRecording || isParsingExternalPlan}
            >
              {isLoading || isParsingExternalPlan ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      </ThemedView>

      {(() => {
        const previewMessage = messages.find(m => m.id === previewPlanMessageId);
        if (!previewMessage?.plan) return null;
        return (
          <PlanPreviewModal
            visible={!!previewPlanMessageId}
            plan={previewMessage.plan}
            onClose={() => setPreviewPlanMessageId(null)}
            onImplement={() => {
              implementPlan(previewMessage.id, previewMessage.plan!);
              setPreviewPlanMessageId(null);
            }}
            onRefine={() => {
              setPreviewPlanMessageId(null);
              setTimeout(() => {
                setInputText("I'd like to refine this plan. ");
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
            isImplementing={implementingPlanId === previewMessage.id}
          />
        );
      })()}
      <SaveToast
        state={toastState}
        message={toastMessage}
        onRetry={retryFn ?? undefined}
        onDismiss={dismiss}
      />
      <BriefToast message={silentHintMessage} visible={silentHintVisible} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: Spacing.md,
    flexGrow: 1,
  },
  emptyListContainer: {
    justifyContent: "center",
  },
  messageContainer: {
    marginVertical: Spacing.xs,
  },
  userMessageContainer: {
    alignItems: "flex-end",
  },
  assistantMessageContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  implementedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    maxWidth: "80%",
  },
  implementedText: {
    fontSize: 14,
    fontWeight: "500",
  },
  proposalCard: {
    width: "90%",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  proposalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  proposalTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  proposalItem: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  proposalItemTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  proposalItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  proposalMore: {
    fontSize: 12,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
  proposalButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  proposalButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  quickRepliesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    maxWidth: "90%",
  },
  quickReplyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  suggestionContainer: {
    flexDirection: "column",
    gap: Spacing.sm,
    width: "100%",
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  suggestionText: {
    fontSize: 14,
    textAlign: "center",
  },
  inputContainer: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.md,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.xs,
  },
  recordingOverlay: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    paddingVertical: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  recordingIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  recordingText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  recordingHint: {
    fontSize: 14,
  },
  messageActions: {
    flexDirection: "row",
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  speakButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  speakButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
});

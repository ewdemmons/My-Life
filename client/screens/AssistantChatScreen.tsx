import React, { useState, useRef, useEffect } from "react";
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
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import * as Speech from "expo-speech";
import { File } from "expo-file-system/next";
import * as Network from "expo-network";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useApp } from "@/context/AppContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { PlanPreview, Plan, parsePlanFromMessage, extractTextFromMessage } from "@/components/PlanPreview";
import { Task, TaskType, Habit, CalendarEvent } from "@/types";

const MESSAGES_STORAGE_KEY = "@assistant_messages";
const REFINEMENT_STATE_KEY = "@assistant_refinement_state";

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
  const { theme, isDark } = useTheme();
  const { 
    categories, 
    tasks, 
    events, 
    habits, 
    people, 
    addTask, 
    addCategory,
    updateTask,
    addEvent,
    addHabit,
  } = useApp();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [implementingPlanId, setImplementingPlanId] = useState<string | null>(null);
  const [implementingProposalId, setImplementingProposalId] = useState<string | null>(null);
  const [refinementState, setRefinementState] = useState<RefinementState>({ isActive: false });
  const flatListRef = useRef<FlatList>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState<boolean | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isParsingExternalPlan, setIsParsingExternalPlan] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    loadMessages();
    checkMicPermission();
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
      
      // Wait for the file to be fully written
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
      
      // Try to read the audio file as base64
      // First try with the URI as-is, then try stripping file:// prefix
      let base64Audio: string | null = null;
      
      // Try original URI first
      try {
        const audioFile = new File(uri);
        base64Audio = await audioFile.base64();
        console.log("Audio read with original URI, length:", base64Audio.length);
      } catch (e1) {
        console.log("Failed with original URI, trying stripped path...");
        // Try without file:// prefix
        const filePath = uri.startsWith("file://") ? uri.substring(7) : uri;
        try {
          const audioFile = new File(filePath);
          base64Audio = await audioFile.base64();
          console.log("Audio read with stripped path, length:", base64Audio.length);
        } catch (e2) {
          console.error("Both read attempts failed:", e1, e2);
          throw new Error("Could not read recording file");
        }
      }
      
      if (!base64Audio || base64Audio.length === 0) {
        throw new Error("Recording file is empty");
      }
      
      console.log("Audio read successfully, length:", base64Audio.length);

      const response = await apiRequest("POST", "/api/assistant/transcribe", {
        audio: base64Audio,
        mimeType: "audio/m4a",
      });

      const data = await response.json();
      
      if (data.text) {
        setInputText(data.text);
        setTimeout(() => sendMessage(data.text), 100);
      } else if (data.error) {
        Alert.alert("Transcription Error", data.error);
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
    
    Speech.speak(cleanText, {
      language: "en-US",
      pitch: 1,
      rate: 0.9,
      onDone: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
      onStopped: () => setSpeakingMessageId(null),
    });
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

  const getAppContext = () => {
    const bubbleInfo = categories.map(c => `${c.name} (${c.color})`).join(", ");
    const tasksByBubble: Record<string, number> = {};
    const goalCount = tasks.filter(t => t.type === "goal").length;
    const projectCount = tasks.filter(t => t.type === "project").length;
    const pendingTasks = tasks.filter(t => t.status === "pending").length;
    const completedTasks = tasks.filter(t => t.status === "completed").length;
    
    categories.forEach(c => {
      tasksByBubble[c.name] = tasks.filter(t => t.categoryId === c.id).length;
    });

    const habitInfo = habits.length > 0 
      ? `Active habits: ${habits.map(h => h.name).join(", ")}`
      : "No habits tracked yet";

    const peopleInfo = people.length > 0
      ? `People: ${people.map(p => `${p.name} (${p.relationship || 'contact'})`).join(", ")}`
      : "No contacts yet";

    let refinementContext = "";
    if (refinementState.isActive && refinementState.implementedPlan) {
      refinementContext = `
ACTIVE REFINEMENT MODE:
Recently implemented plan: "${refinementState.implementedPlan.goal}"
Created tasks: ${refinementState.createdTaskIds?.length || 0} items
Current branch: ${refinementState.currentBranch || "none"}
      `;
    }

    return `
Life Bubbles: ${bubbleInfo || "None created yet"}
Tasks by bubble: ${Object.entries(tasksByBubble).map(([name, count]) => `${name}: ${count}`).join(", ") || "None"}
Summary: ${goalCount} goals, ${projectCount} projects, ${pendingTasks} pending tasks, ${completedTasks} completed
${habitInfo}
${peopleInfo}
${refinementContext}
    `.trim();
  };

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

  const fetchUrlContent = async (url: string): Promise<string | null> => {
    try {
      const response = await apiRequest("POST", "/api/assistant/fetch-url", { url });
      const data = await response.json();
      return data.content || null;
    } catch (error) {
      console.error("Failed to fetch URL:", error);
      return null;
    }
  };

  const parseExternalPlan = async (planText: string): Promise<Plan | null> => {
    try {
      const response = await apiRequest("POST", "/api/assistant/parse-plan", { planText });
      const data = await response.json();
      if (data.plan) {
        return {
          goal: data.plan.goal || "Imported Plan",
          advice: data.plan.advice || "Imported from external source",
          suggestedBubble: data.plan.suggestedBubble || "General",
          objectives: (data.plan.objectives || []).map((obj: any) => ({
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
      }
      return null;
    } catch (error) {
      console.error("Failed to parse plan:", error);
      return null;
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const messageText = overrideText || inputText.trim();
    if (!messageText || isLoading || isParsingExternalPlan) return;

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
          
          planTextToConvert = await fetchUrlContent(externalPlanRequest.url);
          
          if (!planTextToConvert) {
            setMessages(prev => prev.filter(m => m.id !== statusMessage.id));
            const errorMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: "assistant",
              content: "I couldn't fetch content from that link. The page might be protected or unavailable. Try copying and pasting the plan text directly instead.",
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
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
            setMessages(prev => [...prev, successMessage]);
          } else {
            const errorMessage: Message = {
              id: (Date.now() + 3).toString(),
              role: "assistant",
              content: "I couldn't convert that into a structured plan. The text might not contain actionable items. Try providing a more detailed plan with specific goals and tasks.",
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
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
          setMessages(prev => [...prev, errorMessage]);
        }
      } catch (error) {
        console.error("External plan parsing error:", error);
        const errorMessage: Message = {
          id: (Date.now() + 3).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error while processing your plan. Please try again.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsParsingExternalPlan(false);
      }
      return;
    }

    setIsLoading(true);

    try {
      const refinementContext = getRefinementContext();
      
      const response = await apiRequest("POST", "/api/assistant/chat", {
        message: messageText,
        context: getAppContext(),
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        refinementMode: refinementState.isActive,
        refinementContext: refinementContext,
      });

      const data = await response.json();
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

      setMessages(prev => [...prev, assistantMessage]);
      
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
      setMessages(prev => [...prev, errorMessage]);
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
    const createdTaskIds: string[] = [];

    try {
      let categoryId = categories.find(
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

      if (!categoryId) {
        categoryId = categories[0]?.id || "";
      }

      let createdCount = 0;
      let failedCount = 0;

      const createdGoal = await addTask({
        title: plan.goal,
        description: plan.advice,
        type: "goal" as TaskType,
        categoryId,
        parentId: null,
        priority: "high",
        status: "pending",
      });

      if (!createdGoal) {
        console.error("Failed to create goal task");
        throw new Error("Failed to create goal task");
      }
      createdCount++;
      createdTaskIds.push(createdGoal.id);
      const goalId = createdGoal.id;

      for (const objective of plan.objectives) {
        const createdObjective = await addTask({
          title: objective.name,
          description: "",
          type: "objective" as TaskType,
          categoryId,
          parentId: goalId,
          priority: "high",
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

        for (const project of objective.projects) {
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
            const createdTask = await addTask({
              title: taskItem.title,
              description: taskItem.description,
              type: "task" as TaskType,
              categoryId,
              parentId: projectId,
              priority: taskItem.priority || "medium",
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
    } catch (error) {
      console.error("Failed to implement plan:", error);
      Alert.alert(
        "Error",
        "Failed to create the plan. Please try again.",
        [{ text: "OK", style: "default" }]
      );
    } finally {
      setImplementingPlanId(null);
    }
  };

  const implementScheduleProposal = async (messageId: string, proposal: ScheduleProposal) => {
    setImplementingProposalId(messageId);
    
    try {
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
    } catch (error) {
      console.error("Failed to implement schedule:", error);
      Alert.alert("Error", "Failed to apply scheduling. Please try again.");
    } finally {
      setImplementingProposalId(null);
    }
  };

  const implementHabitProposal = async (messageId: string, proposal: HabitProposal) => {
    setImplementingProposalId(messageId);
    
    try {
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
    } catch (error) {
      console.error("Failed to create habits:", error);
      Alert.alert("Error", "Failed to create habits. Please try again.");
    } finally {
      setImplementingProposalId(null);
    }
  };

  const implementAssignmentProposal = async (messageId: string, proposal: AssignmentProposal) => {
    setImplementingProposalId(messageId);
    
    try {
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
    } catch (error) {
      console.error("Failed to assign tasks:", error);
      Alert.alert("Error", "Failed to assign tasks. Please try again.");
    } finally {
      setImplementingProposalId(null);
    }
  };

  const handleQuickReply = (reply: string) => {
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

  const renderQuickReplies = (replies: string[]) => (
    <View style={styles.quickRepliesContainer}>
      {replies.map((reply, index) => (
        <Pressable
          key={index}
          style={[styles.quickReplyChip, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}
          onPress={() => handleQuickReply(reply)}
        >
          <ThemedText style={[styles.quickReplyText, { color: theme.primary }]}>{reply}</ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    
    if (!isUser && item.plan && !item.planImplemented) {
      const textContent = extractTextFromMessage(item.content);
      
      return (
        <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
          {textContent ? (
            <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: theme.backgroundDefault, marginBottom: Spacing.sm }]}>
              <ThemedText style={styles.messageText}>{textContent}</ThemedText>
            </View>
          ) : null}
          <PlanPreview
            plan={item.plan}
            onImplement={() => implementPlan(item.id, item.plan!)}
            isImplementing={implementingPlanId === item.id}
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
          renderQuickReplies(item.quickReplies)
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
        <ThemedText style={styles.emptyTitle}>Hi! I'm your Life Assistant</ThemedText>
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
              placeholder={isRecording ? "Listening..." : isParsingExternalPlan ? "Converting plan..." : "Ask your assistant..."}
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

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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useApp } from "@/context/AppContext";
import { apiRequest } from "@/lib/query-client";
import { PlanPreview, Plan, parsePlanFromMessage, extractTextFromMessage } from "@/components/PlanPreview";
import { Task, TaskType } from "@/types";

const MESSAGES_STORAGE_KEY = "@assistant_messages";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  plan?: Plan;
  planImplemented?: boolean;
}

export default function AssistantChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { categories, tasks, events, habits, people, addTask, addCategory } = useApp();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [implementingPlanId, setImplementingPlanId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, isLoadingHistory]);

  const loadMessages = async () => {
    try {
      const stored = await AsyncStorage.getItem(MESSAGES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const restored = parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(restored);
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
      ? `${people.length} people in contacts`
      : "No contacts yet";

    return `
Life Bubbles: ${bubbleInfo || "None created yet"}
Tasks by bubble: ${Object.entries(tasksByBubble).map(([name, count]) => `${name}: ${count}`).join(", ") || "None"}
Summary: ${goalCount} goals, ${projectCount} projects, ${pendingTasks} pending tasks, ${completedTasks} completed
${habitInfo}
${peopleInfo}
    `.trim();
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/assistant/chat", {
        message: userMessage.content,
        context: getAppContext(),
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      });

      const data = await response.json();
      const messageContent = data.message || "I apologize, but I couldn't process your request.";
      
      const plan = parsePlanFromMessage(messageContent);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: messageContent,
        timestamp: new Date(),
        plan: plan || undefined,
        planImplemented: false,
      };

      setMessages(prev => [...prev, assistantMessage]);
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

  const implementPlan = async (messageId: string, plan: Plan) => {
    setImplementingPlanId(messageId);

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
            }
          }
        }
      }

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, planImplemented: true } : m
      ));

      const successMessage = failedCount > 0
        ? `Created ${createdCount} items (${failedCount} failed). Check your ${plan.suggestedBubble} bubble!`
        : `Your "${plan.goal}" plan has been created with all ${createdCount} items. Check your ${plan.suggestedBubble} bubble!`;

      Alert.alert(
        "Plan Created!",
        successMessage,
        [{ text: "Great!", style: "default" }]
      );
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

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

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
      const textContent = extractTextFromMessage(item.content);
      
      return (
        <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
          {textContent ? (
            <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: theme.backgroundDefault, marginBottom: Spacing.sm }]}>
              <ThemedText style={styles.messageText}>{textContent}</ThemedText>
            </View>
          ) : null}
          <View style={[styles.implementedBadge, { backgroundColor: theme.success + "20" }]}>
            <Feather name="check-circle" size={16} color={theme.success} />
            <ThemedText style={[styles.implementedText, { color: theme.success }]}>
              Plan "{item.plan.goal}" implemented
            </ThemedText>
          </View>
        </View>
      );
    }
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
      ]}>
        <View style={[
          styles.messageBubble,
          isUser 
            ? [styles.userBubble, { backgroundColor: theme.primary }]
            : [styles.assistantBubble, { backgroundColor: theme.backgroundDefault }],
        ]}>
          <ThemedText style={[
            styles.messageText,
            isUser && { color: "#FFFFFF" },
          ]}>
            {item.content}
          </ThemedText>
        </View>
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
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Ask your assistant..."
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              editable={!isLoading}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: theme.primary },
                (!inputText.trim() || isLoading) && { opacity: 0.5 },
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
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
});

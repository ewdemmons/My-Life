import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  askAssessmentQuestion,
  generateLifeAreaProfile,
  MAX_QUESTIONS,
} from "@/lib/lifeAreaAssessmentService";
import { showRetakeAssessmentAlert } from "@/lib/lifeAreaCoachUtils";
import type { AssessmentQAPair } from "@/types";

type RouteParams = RouteProp<RootStackParamList, "LifeAreaAssessment">;

export default function LifeAreaAssessmentScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { categoryId, isRetake } = route.params;

  const {
    categories,
    getLifeAreaProfile,
    saveAssessmentProgress,
    saveLifeAreaAssessment,
    resetLifeAreaAssessment,
  } = useApp();

  const category = categories.find((c) => c.id === categoryId);
  const existingProfile = getLifeAreaProfile(categoryId);

  const [rawAnswers, setRawAnswers] = useState<AssessmentQAPair[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPriorAnswers, setShowPriorAnswers] = useState(false);
  const startedRef = useRef(false);
  const initRef = useRef(false);

  const questionNumber = rawAnswers.length + (currentQuestion ? 1 : 0);
  const progress = Math.min(questionNumber / MAX_QUESTIONS, 1);

  const completeAssessment = useCallback(async (
    answers: AssessmentQAPair[],
    closingMessage?: string,
  ) => {
    if (!category) return;
    setIsSynthesizing(true);
    setCurrentQuestion(null);
    setError(null);

    try {
      const synthesis = await generateLifeAreaProfile(
        answers,
        category.name,
        category.description,
      );

      if (!synthesis) {
        setError("Could not build your profile. Please try again.");
        setIsSynthesizing(false);
        return;
      }

      await saveLifeAreaAssessment(categoryId, answers, synthesis);

      if (closingMessage) {
        Alert.alert("Assessment complete", closingMessage, [
          {
            text: "Review Profile",
            onPress: () =>
              navigation.replace("LifeAreaProfileEdit", { categoryId, fromAssessment: true }),
          },
        ]);
      } else {
        navigation.replace("LifeAreaProfileEdit", { categoryId, fromAssessment: true });
      }
    } catch (err) {
      console.error("Profile synthesis error:", err);
      setError("Something went wrong saving your profile. Please try again.");
      setIsSynthesizing(false);
    }
  }, [category, categoryId, navigation, saveLifeAreaAssessment]);

  const fetchNextQuestion = useCallback(async (answers: AssessmentQAPair[]) => {
    if (!category) return;
    setIsLoadingQuestion(true);
    setError(null);
    try {
      const result = await askAssessmentQuestion({
        lifeAreaName: category.name,
        lifeAreaDescription: category.description,
        rawAnswers: answers,
      });

      if (result.status === "complete") {
        await completeAssessment(answers, result.closingMessage);
        return;
      }

      setCurrentQuestion(result.question);
      await saveAssessmentProgress(categoryId, answers, result.question);
    } catch (err) {
      console.error("Assessment question error:", err);
      setError("Something went wrong loading the next question. Please try again.");
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [category, categoryId, completeAssessment, saveAssessmentProgress]);

  const beginAssessment = useCallback(async () => {
    if (!category || startedRef.current) return;
    startedRef.current = true;

    const profile = getLifeAreaProfile(categoryId);

    if (profile?.status === "in_progress") {
      setRawAnswers(profile.rawAnswers);
      if (profile.pendingQuestion) {
        setCurrentQuestion(profile.pendingQuestion);
        setIsLoadingQuestion(false);
        return;
      }
      if (profile.rawAnswers.length > 0) {
        await fetchNextQuestion(profile.rawAnswers);
        return;
      }
    }

    setRawAnswers([]);
    await fetchNextQuestion([]);
  }, [category, categoryId, fetchNextQuestion, getLifeAreaProfile]);

  useEffect(() => {
    if (!category || initRef.current) return;
    initRef.current = true;

    navigation.setOptions({
      headerTitle: `${category.name} Assessment`,
    });

    if (isRetake) {
      void resetLifeAreaAssessment(categoryId).then(() => beginAssessment());
      return;
    }

    if (existingProfile?.status === "completed") {
      setIsLoadingQuestion(false);
      showRetakeAssessmentAlert(
        category.name,
        () => {
          void resetLifeAreaAssessment(categoryId).then(() => beginAssessment());
        },
        () => navigation.goBack(),
      );
      return;
    }

    void beginAssessment();
  }, [category, categoryId, isRetake, existingProfile?.status, navigation, beginAssessment, resetLifeAreaAssessment]);

  const handleStartOver = () => {
    if (!category) return;
    showRetakeAssessmentAlert(category.name, () => {
      void resetLifeAreaAssessment(categoryId).then(() => {
        startedRef.current = false;
        setRawAnswers([]);
        setCurrentQuestion(null);
        setAnswerText("");
        setError(null);
        void beginAssessment();
      });
    });
  };

  const handleSubmitAnswer = async () => {
    const trimmed = answerText.trim();
    if (!trimmed || !currentQuestion || isLoadingQuestion || isSynthesizing) return;

    const nextAnswers: AssessmentQAPair[] = [
      ...rawAnswers,
      { question: currentQuestion, answer: trimmed },
    ];

    setRawAnswers(nextAnswers);
    setAnswerText("");
    setCurrentQuestion(null);

    if (nextAnswers.length >= MAX_QUESTIONS) {
      await completeAssessment(nextAnswers);
      return;
    }

    await fetchNextQuestion(nextAnswers);
  };

  if (!category) {
    return (
      <View style={[styles.centered, { paddingTop: headerHeight, backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.progressTrack, { marginTop: headerHeight + Spacing.sm }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: category.color },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText style={[styles.stepLabel, { color: theme.textSecondary }]}>
          Question {Math.min(questionNumber, MAX_QUESTIONS)} of ~{MAX_QUESTIONS}
        </ThemedText>

        {rawAnswers.length > 0 ? (
          <Pressable
            onPress={() => setShowPriorAnswers((v) => !v)}
            style={styles.priorToggle}
          >
            <ThemedText style={[styles.priorToggleText, { color: category.color }]}>
              {showPriorAnswers ? "Hide" : "Show"} previous answers ({rawAnswers.length})
            </ThemedText>
            <Feather
              name={showPriorAnswers ? "chevron-up" : "chevron-down"}
              size={16}
              color={category.color}
            />
          </Pressable>
        ) : null}

        {showPriorAnswers
          ? rawAnswers.map((pair, index) => (
              <View
                key={`prior-${index}`}
                style={[styles.priorCard, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
              >
                <ThemedText style={[styles.priorQuestion, { color: theme.text }]}>
                  {pair.question}
                </ThemedText>
                <ThemedText style={[styles.priorAnswer, { color: theme.textSecondary }]}>
                  {pair.answer}
                </ThemedText>
              </View>
            ))
          : null}

        {isSynthesizing ? (
          <View style={styles.centeredBlock}>
            <ActivityIndicator size="large" color={category.color} />
            <ThemedText style={[styles.synthText, { color: theme.textSecondary }]}>
              Building your Coach profile...
            </ThemedText>
          </View>
        ) : isLoadingQuestion ? (
          <View style={styles.centeredBlock}>
            <ActivityIndicator size="large" color={category.color} />
          </View>
        ) : currentQuestion ? (
          <>
            <ThemedText style={[styles.question, { color: theme.text }]}>
              {currentQuestion}
            </ThemedText>
            <TextInput
              style={[
                styles.answerInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Your answer..."
              placeholderTextColor={theme.textSecondary}
              value={answerText}
              onChangeText={setAnswerText}
              multiline
              textAlignVertical="top"
            />
          </>
        ) : null}

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: `${theme.error}15` }]}>
            <ThemedText style={{ color: theme.error }}>{error}</ThemedText>
            <Pressable onPress={() => void fetchNextQuestion(rawAnswers)}>
              <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>Retry</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {(existingProfile?.status === "in_progress" || rawAnswers.length > 0) && !isSynthesizing ? (
          <Pressable onPress={handleStartOver} style={styles.startOverBtn}>
            <ThemedText style={[styles.startOverText, { color: theme.textSecondary }]}>
              Start Over
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>

      {!isLoadingQuestion && !isSynthesizing && currentQuestion ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + Spacing.md,
              backgroundColor: theme.backgroundRoot,
              borderTopColor: theme.border,
            },
          ]}
        >
          <Pressable
            style={[
              styles.continueBtn,
              {
                backgroundColor: answerText.trim() ? category.color : theme.backgroundTertiary,
              },
            ]}
            onPress={() => void handleSubmitAnswer()}
            disabled={!answerText.trim()}
          >
            <ThemedText style={[styles.continueText, { color: theme.buttonText }]}>
              Continue
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(128,128,128,0.2)",
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  stepLabel: {
    ...Typography.caption,
    marginBottom: Spacing.lg,
  },
  priorToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  priorToggleText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  priorCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  priorQuestion: {
    ...Typography.body,
    fontWeight: "600",
  },
  priorAnswer: {
    ...Typography.body,
  },
  question: {
    ...Typography.h1,
    marginBottom: Spacing.lg,
    lineHeight: 32,
  },
  answerInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  centeredBlock: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  synthText: {
    ...Typography.body,
    textAlign: "center",
  },
  errorBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  startOverBtn: {
    marginTop: Spacing.xl,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  startOverText: {
    ...Typography.link,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  continueBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    ...Typography.body,
    fontWeight: "600",
  },
});

import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Image } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthNavigator from "@/navigation/AuthNavigator";
import OnboardingIntroScreen from "@/screens/auth/OnboardingIntroScreen";
import OnboardingScreen from "@/screens/auth/OnboardingScreen";
import CategoryDetailScreen from "@/screens/CategoryDetailScreen";
import AddCategoryScreen from "@/screens/AddCategoryScreen";
import AddTaskScreen from "@/screens/AddTaskScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import CentralDashboardScreen from "@/screens/CentralDashboardScreen";
import AssistantChatScreen from "@/screens/AssistantChatScreen";
import DailyPlanGeneratorScreen from "@/screens/DailyPlanGeneratorScreen";
import LifeAreaAssessmentScreen from "@/screens/LifeAreaAssessmentScreen";
import LifeAreaProfileEditScreen from "@/screens/LifeAreaProfileEditScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { LifeCategory, Task, LifeAreaProfile } from "@/types";
import { NavigatorScreenParams } from "@react-navigation/native";
import { MainTabParamList } from "@/navigation/MainTabNavigator";

const PENDING_ONBOARDING_KEY = "@pending_onboarding";
const appIcon = require("../../assets/images/icon.png");

export type EntryContext = {
  id: string;
  title: string;
  type: "task" | "event" | "habit";
  entryType?: string;
  bubbleName?: string;
  bubbleId?: string;
  parentTitle?: string;
  parentId?: string;
  description?: string;
};

export type LifeAreaContextProfile = Pick<
  LifeAreaProfile,
  | "primaryGoal"
  | "currentFocus"
  | "knownObstacles"
  | "currentState"
  | "motivations"
  | "successCriteria"
>;

export type LifeAreaContext = {
  categoryId: string;
  name: string;
  description?: string;
  profile?: LifeAreaContextProfile;
};

export type CategoryDetailTab = "entries" | "calendar" | "coach" | "people" | "habits";

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  CategoryDetail: {
    category?: LifeCategory;
    categoryId?: string;
    initialTaskId?: string;
    initialEventId?: string;
    initialTab?: CategoryDetailTab;
  };
  AddCategory: { category?: LifeCategory; scrollToPreferredTimes?: boolean };
  AddTask: {
    categoryId?: string;
    parentTaskId?: string;
    task?: Task;
    initialPeopleIds?: string[];
    initialCategoryId?: string;
  };
  Notifications: undefined;
  CentralDashboard: { initialTab?: "profile" | "wheel" | "bin" | "dashboard" } | undefined;
  AssistantChat: {
    entryContext?: EntryContext;
    lifeAreaContext?: LifeAreaContext;
    openPlanningSession?: boolean;
    initialPrompt?: string;
  };
  DailyPlanGenerator: { initialDate?: string };
  LifeAreaAssessment: { categoryId: string; isRetake?: boolean };
  LifeAreaProfileEdit: { categoryId: string; fromAssessment?: boolean };
};

export type PostSignUpStackParamList = {
  OnboardingIntro: undefined;
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const PostSignUpStack = createNativeStackNavigator<PostSignUpStackParamList>();

function MainAppNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CategoryDetail"
        component={CategoryDetailScreen}
        options={{ headerTitle: "Category" }}
      />
      <Stack.Screen
        name="AddCategory"
        component={AddCategoryScreen}
        options={{
          presentation: "modal",
          headerTitle: "Add Category",
        }}
      />
      <Stack.Screen
        name="AddTask"
        component={AddTaskScreen}
        options={{
          presentation: "modal",
          headerTitle: "Add Task",
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerTitle: "Notifications",
        }}
      />
      <Stack.Screen
        name="CentralDashboard"
        component={CentralDashboardScreen}
        options={{
          headerTitle: "My Dashboard",
        }}
      />
      <Stack.Screen
        name="AssistantChat"
        component={AssistantChatScreen}
        options={{
          headerTitle: "Life Coach",
        }}
      />
      <Stack.Screen
        name="DailyPlanGenerator"
        component={DailyPlanGeneratorScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="LifeAreaAssessment"
        component={LifeAreaAssessmentScreen}
        options={{
          headerTitle: "Assessment",
        }}
      />
      <Stack.Screen
        name="LifeAreaProfileEdit"
        component={LifeAreaProfileEditScreen}
        options={{
          headerTitle: "Coach Profile",
        }}
      />
    </Stack.Navigator>
  );
}

function PostSignUpNavigator() {
  const screenOptions = useScreenOptions();
  return (
    <PostSignUpStack.Navigator
      screenOptions={screenOptions}
      initialRouteName="OnboardingIntro"
    >
      <PostSignUpStack.Screen
        name="OnboardingIntro"
        component={OnboardingIntroScreen}
        options={{ headerShown: false }}
      />
      <PostSignUpStack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <PostSignUpStack.Screen
        name="Main"
        component={MainAppNavigator}
        options={{ headerShown: false }}
      />
    </PostSignUpStack.Navigator>
  );
}

export default function RootStackNavigator() {
  const { session, isLoading } = useAuth();
  const { theme } = useTheme();
  const [pendingOnboarding, setPendingOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setPendingOnboarding(null);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(PENDING_ONBOARDING_KEY).then((value) => {
      if (!cancelled) setPendingOnboarding(value === "true");
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Image source={appIcon} style={styles.loadingIcon} />
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!session) {
    return <AuthNavigator />;
  }

  if (pendingOnboarding === null) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Image source={appIcon} style={styles.loadingIcon} />
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (pendingOnboarding) {
    return <PostSignUpNavigator />;
  }

  return <MainAppNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIcon: {
    width: 100,
    height: 100,
    borderRadius: 22,
  },
});

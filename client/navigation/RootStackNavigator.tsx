import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthNavigator from "@/navigation/AuthNavigator";
import CategoryDetailScreen from "@/screens/CategoryDetailScreen";
import AddCategoryScreen from "@/screens/AddCategoryScreen";
import AddTaskScreen from "@/screens/AddTaskScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import CentralDashboardScreen from "@/screens/CentralDashboardScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import AssistantChatScreen from "@/screens/AssistantChatScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { LifeCategory, Task } from "@/types";

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

export type RootStackParamList = {
  Main: undefined;
  CategoryDetail: { category?: LifeCategory; categoryId?: string; initialTaskId?: string; initialEventId?: string };
  AddCategory: { category?: LifeCategory };
  AddTask: { categoryId?: string; parentTaskId?: string; task?: Task };
  Notifications: undefined;
  CentralDashboard: undefined;
  Profile: undefined;
  AssistantChat: { entryContext?: EntryContext };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="AssistantChat"
        component={AssistantChatScreen}
        options={{
          headerTitle: "Life Coach",
        }}
      />
    </Stack.Navigator>
  );
}

export default function RootStackNavigator() {
  const { session, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return session ? <MainAppNavigator /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthNavigator from "@/navigation/AuthNavigator";
import CategoryDetailScreen from "@/screens/CategoryDetailScreen";
import AddCategoryScreen from "@/screens/AddCategoryScreen";
import AddTaskScreen from "@/screens/AddTaskScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { LifeCategory, Task } from "@/types";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  CategoryDetail: { category: LifeCategory };
  AddCategory: { category?: LifeCategory };
  AddTask: { categoryId?: string; parentTaskId?: string; task?: Task };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
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
        </>
      ) : (
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

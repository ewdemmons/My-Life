import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import CategoryDetailScreen from "@/screens/CategoryDetailScreen";
import AddCategoryScreen from "@/screens/AddCategoryScreen";
import AddTaskScreen from "@/screens/AddTaskScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { LifeCategory, Task } from "@/types";

export type RootStackParamList = {
  Main: undefined;
  CategoryDetail: { category: LifeCategory };
  AddCategory: { category?: LifeCategory };
  AddTask: { categoryId?: string; parentTaskId?: string; task?: Task };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
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
    </Stack.Navigator>
  );
}

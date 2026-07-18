import React, { useRef, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import TasksScreen from "@/screens/TasksScreen";
import CalendarScreen from "@/screens/CalendarScreen";
import PeopleScreen from "@/screens/PeopleScreen";
import HabitsScreen from "@/screens/HabitsScreen";
import { FAB, FABHandle } from "@/components/FAB";
import { SchedulingModal } from "@/components/SchedulingModal";
import { AddPersonModal } from "@/components/AddPersonModal";
import { AddHabitModal } from "@/components/AddHabitModal";
import { NotificationBell } from "@/components/NotificationBell";
import { useTheme } from "@/hooks/useTheme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useApp } from "@/context/AppContext";

export type MainTabParamList = {
  HomeTab: { scrollToAgenda?: boolean; refreshTimestamp?: number } | undefined;
  TasksTab: undefined;
  CalendarTab: undefined;
  PeopleTab: undefined;
  HabitsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { categories } = useApp();
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const fabRef = useRef<FABHandle>(null);
  const [isHomeTab, setIsHomeTab] = useState(true);

  const handleAddCategory = () => {
    navigation.navigate("AddCategory", {});
  };

  const handleAddTask = () => {
    navigation.navigate("AddTask", {});
  };

  const handleAddEvent = () => {
    setShowSchedulingModal(true);
  };

  const handleAddPerson = () => {
    setShowAddPersonModal(true);
  };

  const handleAddHabit = () => {
    setShowAddHabitModal(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenListeners={{
          state: (e) => {
            const state = e.data.state;
            const route = state.routes[state.index];
            setIsHomeTab(route.name === "HomeTab");
          },
        }}
        screenOptions={{
          headerTitleAlign: "center",
          headerTransparent: true,
          headerTintColor: theme.text,
          headerStyle: {
            backgroundColor: "transparent",
          },
          headerRight: () => (
            <View style={{ marginRight: 16 }}>
              <NotificationBell />
            </View>
          ),
          tabBarActiveTintColor: theme.tabIconSelected,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: Platform.select({
              ios: "transparent",
              android: theme.backgroundRoot,
            }),
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          options={{
            title: "Home",
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        >
          {() => (
            <HomeScreen onOpenCapture={() => fabRef.current?.openMenu()} />
          )}
        </Tab.Screen>
        <Tab.Screen
          name="TasksTab"
          component={TasksScreen}
          options={{
            title: "Entries",
            headerTitle: "Entries",
            tabBarIcon: ({ color, size }) => (
              <Feather name="list" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="CalendarTab"
          component={CalendarScreen}
          options={{
            title: "Calendar",
            headerTitle: "Calendar",
            tabBarIcon: ({ color, size }) => (
              <Feather name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="PeopleTab"
          component={PeopleScreen}
          options={{
            title: "People",
            headerTitle: "People",
            tabBarIcon: ({ color, size }) => (
              <Feather name="users" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="HabitsTab"
          component={HabitsScreen}
          options={{
            title: "Habits",
            headerTitle: "Habits",
            tabBarIcon: ({ color, size }) => (
              <Feather name="activity" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <FAB
        ref={fabRef}
        hideFloatingButton={true}
        onAddCategory={handleAddCategory}
        onAddTask={handleAddTask}
        onAddEvent={handleAddEvent}
        onAddPerson={handleAddPerson}
        onAddHabit={handleAddHabit}
      />
      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => setShowSchedulingModal(false)}
      />
      <AddPersonModal
        visible={showAddPersonModal}
        onClose={() => setShowAddPersonModal(false)}
      />
      {categories.length > 0 ? (
        <AddHabitModal
          visible={showAddHabitModal}
          onClose={() => setShowAddHabitModal(false)}
          categoryId={categories[0].id}
        />
      ) : null}
    </View>
  );
}

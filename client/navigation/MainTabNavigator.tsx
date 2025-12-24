import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import TasksScreen from "@/screens/TasksScreen";
import CalendarScreen from "@/screens/CalendarScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import { FAB } from "@/components/FAB";
import { SchedulingModal } from "@/components/SchedulingModal";
import { useTheme } from "@/hooks/useTheme";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderTitle } from "@/components/HeaderTitle";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export type MainTabParamList = {
  HomeTab: undefined;
  TasksTab: undefined;
  CalendarTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const screenOptions = useScreenOptions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);

  const handleAddCategory = () => {
    navigation.navigate("AddCategory", {});
  };

  const handleAddTask = () => {
    navigation.navigate("AddTask", {});
  };

  const handleAddEvent = () => {
    setShowSchedulingModal(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={{
          ...screenOptions,
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
          component={HomeScreen}
          options={{
            title: "Home",
            headerTitle: () => <HeaderTitle title="My Life" />,
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="TasksTab"
          component={TasksScreen}
          options={{
            title: "Tasks",
            headerTitle: "Tasks",
            tabBarIcon: ({ color, size }) => (
              <Feather name="check-square" size={size} color={color} />
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
          name="ProfileTab"
          component={ProfileScreen}
          options={{
            title: "Profile",
            headerTitle: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <FAB 
        onAddCategory={handleAddCategory} 
        onAddTask={handleAddTask} 
        onAddEvent={handleAddEvent}
      />
      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => setShowSchedulingModal(false)}
      />
    </View>
  );
}

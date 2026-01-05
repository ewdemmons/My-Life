import React, { useEffect, useRef } from "react";
import { StyleSheet, Platform } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { savePendingInviteCode } from "@/lib/pendingInvites";
import { requestNotificationPermissions } from "@/utils/notifications";
import { NotificationType } from "@/types";

function handleDeepLink(url: string) {
  try {
    const parsed = Linking.parse(url);
    if (parsed.queryParams?.code) {
      const inviteCode = parsed.queryParams.code as string;
      savePendingInviteCode(inviteCode);
      console.log("Saved invite code from deep link:", inviteCode);
    }
  } catch (error) {
    console.error("Error parsing deep link:", error);
  }
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    if (!data) return;

    const notificationType = data.type as NotificationType;
    const bubbleId = data.bubbleId as string | undefined;
    const eventId = data.eventId as string | undefined;
    const taskId = data.taskId as string | undefined;

    if (!navigationRef.current) return;

    try {
      switch (notificationType) {
        case "event_reminder":
          if (bubbleId) {
            navigationRef.current.navigate("Main", {
              screen: "CategoryDetail",
              params: { categoryId: bubbleId, initialTab: "calendar" },
            });
          } else {
            navigationRef.current.navigate("Main", { screen: "Calendar" });
          }
          break;
        case "bubble_shared":
          if (bubbleId) {
            navigationRef.current.navigate("Main", {
              screen: "CategoryDetail",
              params: { categoryId: bubbleId },
            });
          }
          break;
        case "task_assigned":
          if (bubbleId) {
            navigationRef.current.navigate("Main", {
              screen: "CategoryDetail",
              params: { categoryId: bubbleId, initialTab: "tasks" },
            });
          }
          break;
        default:
          navigationRef.current.navigate("Main", { screen: "Home" });
      }
    } catch (error) {
      console.error("Error navigating from notification:", error);
    }
  };

  useEffect(() => {
    if (Platform.OS === "web") return;

    requestNotificationPermissions();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received:", notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <NotificationProvider>
            <QueryClientProvider client={queryClient}>
              <SafeAreaProvider>
                <GestureHandlerRootView style={styles.root}>
                  <KeyboardProvider>
                    <NavigationContainer ref={navigationRef}>
                      <RootStackNavigator />
                    </NavigationContainer>
                    <StatusBar style="auto" />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SafeAreaProvider>
            </QueryClientProvider>
          </NotificationProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

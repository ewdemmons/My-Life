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

interface DeepLinkResult {
  type: "invite" | "bubble" | "task" | "event" | "people" | "notifications" | null;
  bubbleId?: string;
  taskId?: string;
  eventId?: string;
  inviteCode?: string;
}

function parseDeepLink(url: string): DeepLinkResult {
  try {
    const parsed = Linking.parse(url);
    
    if (parsed.queryParams?.code) {
      return { 
        type: "invite", 
        inviteCode: parsed.queryParams.code as string 
      };
    }
    
    const path = parsed.path || "";
    const pathParts = path.split("/").filter(Boolean);
    
    if (pathParts[0] === "bubble" && pathParts[1]) {
      const bubbleId = pathParts[1];
      
      if (pathParts[2] === "task" && pathParts[3]) {
        return { type: "task", bubbleId, taskId: pathParts[3] };
      }
      if (pathParts[2] === "event" && pathParts[3]) {
        return { type: "event", bubbleId, eventId: pathParts[3] };
      }
      
      return { type: "bubble", bubbleId };
    }
    
    if (pathParts[0] === "task" && pathParts[1]) {
      return { type: "task", taskId: pathParts[1] };
    }
    if (pathParts[0] === "event" && pathParts[1]) {
      return { type: "event", eventId: pathParts[1] };
    }
    if (pathParts[0] === "people") {
      return { type: "people" };
    }
    if (pathParts[0] === "notifications") {
      return { type: "notifications" };
    }
    
    return { type: null };
  } catch (error) {
    console.error("Error parsing deep link:", error);
    return { type: null };
  }
}

let pendingDeepLink: DeepLinkResult | null = null;

function handleDeepLink(url: string): DeepLinkResult | null {
  const result = parseDeepLink(url);
  
  if (result.type === "invite" && result.inviteCode) {
    savePendingInviteCode(result.inviteCode);
    console.log("Saved invite code from deep link:", result.inviteCode);
  }
  
  return result.type ? result : null;
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const isNavigationReady = useRef(false);

  const processPendingDeepLink = () => {
    if (pendingDeepLink && isNavigationReady.current && navigationRef.current) {
      navigateToDeepLink(pendingDeepLink);
      pendingDeepLink = null;
    }
  };

  const navigateToDeepLink = (result: DeepLinkResult) => {
    if (!navigationRef.current) return;
    
    const { type, bubbleId, taskId, eventId } = result;
    
    if (type === "people") {
      navigationRef.current.navigate("Main", { screen: "PeopleTab" });
      return;
    }
    
    if (type === "notifications") {
      navigationRef.current.navigate("Notifications");
      return;
    }
    
    if (!bubbleId) {
      navigationRef.current.navigate("Main", { screen: "HomeTab" });
      return;
    }
    
    navigationRef.current.navigate("CategoryDetail", {
      category: { id: bubbleId } as any,
      initialTaskId: taskId,
      initialEventId: eventId,
    });
  };

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        const result = handleDeepLink(url);
        if (result && result.type !== "invite") {
          pendingDeepLink = result;
          processPendingDeepLink();
        }
      }
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      const result = handleDeepLink(url);
      if (result && result.type !== "invite") {
        if (isNavigationReady.current && navigationRef.current) {
          navigateToDeepLink(result);
        } else {
          pendingDeepLink = result;
        }
      }
    });

    return () => subscription.remove();
  }, []);

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    if (!data) return;

    if (data.url) {
      const result = parseDeepLink(data.url as string);
      if (result.type) {
        navigateToDeepLink(result);
        return;
      }
    }

    const notificationType = data.type as NotificationType;
    const bubbleId = data.bubbleId as string | undefined;
    const itemId = data.itemId as string | undefined;
    const eventId = data.eventId as string | undefined;
    const taskId = data.taskId as string | undefined;

    if (!navigationRef.current) return;

    try {
      switch (notificationType) {
        case "event_reminder":
          if (bubbleId) {
            navigationRef.current.navigate("CategoryDetail", {
              category: { id: bubbleId } as any,
              initialEventId: eventId,
            });
          } else {
            navigationRef.current.navigate("Main", { screen: "CalendarTab" });
          }
          break;
        case "bubble_shared":
          if (bubbleId) {
            navigationRef.current.navigate("CategoryDetail", {
              category: { id: bubbleId } as any,
            });
          }
          break;
        case "task_assigned":
          if (bubbleId) {
            navigationRef.current.navigate("CategoryDetail", {
              category: { id: bubbleId } as any,
              initialTaskId: itemId || taskId,
            });
          }
          break;
        default:
          navigationRef.current.navigate("Main", { screen: "HomeTab" });
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
        <NotificationProvider>
          <AppProvider>
            <QueryClientProvider client={queryClient}>
              <SafeAreaProvider>
                <GestureHandlerRootView style={styles.root}>
                  <KeyboardProvider>
                    <NavigationContainer 
                      ref={navigationRef}
                      onReady={() => {
                        isNavigationReady.current = true;
                        processPendingDeepLink();
                      }}
                    >
                      <RootStackNavigator />
                    </NavigationContainer>
                    <StatusBar style="auto" />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SafeAreaProvider>
            </QueryClientProvider>
          </AppProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

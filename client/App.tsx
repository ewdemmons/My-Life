import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { savePendingInviteCode } from "@/lib/pendingInvites";

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

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
              <GestureHandlerRootView style={styles.root}>
                <KeyboardProvider>
                  <NavigationContainer>
                    <RootStackNavigator />
                  </NavigationContainer>
                  <StatusBar style="auto" />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </QueryClientProvider>
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

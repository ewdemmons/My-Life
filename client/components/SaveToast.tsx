import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Animated,
  ActivityIndicator,
  Pressable,
  Text,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";

const TAB_BAR_HEIGHT = 56;

export interface SaveToastProps {
  state: "saving" | "success" | "error" | "hidden";
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function SaveToast({
  state,
  message,
  onRetry,
  onDismiss,
}: SaveToastProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === "hidden") {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.timing(translateY, {
        toValue: 20,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }).start();
      Animated.spring(opacity, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [state, translateY, opacity]);

  const isVisible = state !== "hidden";

  const containerStyle = (() => {
    switch (state) {
      case "saving":
        return {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
        };
      case "success":
        return {
          backgroundColor: "#10B98122",
          borderColor: "#10B98144",
        };
      case "error":
        return {
          backgroundColor: "#EF444422",
          borderColor: "#EF444444",
        };
      default:
        return {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
        };
    }
  })();

  const textColor = (() => {
    switch (state) {
      case "saving":
        return theme.textSecondary;
      case "success":
        return "#10B981";
      case "error":
        return "#EF4444";
      default:
        return theme.textSecondary;
    }
  })();

  const displayMessage = (() => {
    if (message) return message;
    switch (state) {
      case "saving":
        return "Saving...";
      case "success":
        return "Saved";
      case "error":
        return "Save failed";
      default:
        return "";
    }
  })();

  return (
    <Animated.View
      pointerEvents={isVisible ? "auto" : "none"}
      style={[
        styles.container,
        {
          bottom: TAB_BAR_HEIGHT + insets.bottom + 12,
          opacity,
          transform: [{ translateY }],
          ...containerStyle,
        },
      ]}
    >
      {state === "saving" && (
        <ActivityIndicator size={14} color={theme.textSecondary} />
      )}
      {state === "success" && (
        <Feather name="check" size={14} color="#10B981" />
      )}
      {state === "error" && (
        <Feather name="x" size={14} color="#EF4444" />
      )}
      {isVisible && (
        <Text style={[styles.text, { color: textColor }]}>
          {displayMessage}
        </Text>
      )}
      {state === "error" && onRetry && (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  text: {
    fontSize: 13,
  },
  retryText: {
    color: "#EF4444",
    fontWeight: "600",
    fontSize: 13,
    marginLeft: 8,
  },
});

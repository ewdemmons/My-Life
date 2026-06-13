import React, { useLayoutEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ProfileTab } from "@/screens/ProfileTab";
import { WheelTab } from "@/screens/WheelTab";
import { BinTab } from "@/screens/BinTab";
import { DashboardTab } from "@/screens/DashboardTab";

type DashboardTab = "profile" | "wheel" | "bin" | "dashboard";

const TAB_CONFIG: {
  key: DashboardTab;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
}[] = [
  { key: "profile", label: "Profile", icon: "user", title: "My Profile" },
  { key: "wheel", label: "Wheel", icon: "circle", title: "Life Wheel" },
  { key: "bin", label: "Bin", icon: "trash-2", title: "Recycle Bin" },
  { key: "dashboard", label: "Dashboard", icon: "list", title: "My Dashboard" },
];

export default function CentralDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<DashboardTab>("profile");

  const activeTitle =
    TAB_CONFIG.find((tab) => tab.key === activeTab)?.title ?? "My Profile";

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor: theme.backgroundRoot,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <ThemedText style={[styles.backButtonText, { color: theme.primary }]}>
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>{activeTitle}</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.backgroundDefault }]}>
        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.key;
          const color = isActive ? theme.primary : theme.textSecondary;

          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                isActive && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Feather name={tab.icon} size={20} color={color} />
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color },
                  isActive && { fontWeight: "600" },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "wheel" && <WheelTab />}
        {activeTab === "bin" && <BinTab />}
        {activeTab === "dashboard" && <DashboardTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "300",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 44,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    height: 65,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    gap: 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
});

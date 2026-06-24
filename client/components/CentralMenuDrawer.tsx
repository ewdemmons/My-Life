import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Image,
  Text,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const DRAWER_WIDTH = 280;

interface CentralMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  avatarUrl: string | null;
  displayName: string;
  email: string;
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

function SectionLabel({ title, color }: { title: string; color: string }) {
  return <Text style={[styles.sectionLabel, { color }]}>{title}</Text>;
}

function MenuItem({
  icon,
  label,
  iconBg,
  textColor,
  chevronColor,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  iconBg: string;
  textColor: string;
  chevronColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconWrap, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={15} color={textColor} />
      </View>
      <Text style={[styles.menuLabel, { color: textColor }]}>{label}</Text>
      <Feather name="chevron-right" size={14} color={chevronColor} />
    </Pressable>
  );
}

export function CentralMenuDrawer({
  visible,
  onClose,
  avatarUrl,
  displayName,
  email,
  navigation,
}: CentralMenuDrawerProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { signOut } = useAuth();
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : DRAWER_WIDTH,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible, slideAnim]);

  const navigateAndClose = (action: () => void) => {
    onClose();
    action();
  };

  const navigateToDashboardTab = (initialTab: "profile" | "wheel" | "bin" | "dashboard") => {
    navigateAndClose(() => {
      navigation.navigate("CentralDashboard", { initialTab });
    });
  };

  const navigateToPeopleTab = () => {
    navigateAndClose(() => {
      (navigation as { navigate: (name: string) => void }).navigate("PeopleTab");
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              backgroundColor: theme.backgroundRoot,
              borderLeftColor: theme.border,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={[styles.drawerHeader, { borderBottomColor: theme.border }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.drawerAvatar} />
            ) : (
              <View
                style={[
                  styles.drawerAvatar,
                  styles.drawerAvatarPlaceholder,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text style={styles.drawerInitial}>
                  {displayName?.[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
            )}

            <View style={styles.drawerHeaderInfo}>
              <Text style={[styles.drawerName, { color: theme.text }]}>
                {displayName || "My Life"}
              </Text>
              <Text
                style={[styles.drawerEmail, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {email}
              </Text>
            </View>

            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <SectionLabel title="Profile" color={theme.textSecondary} />
            <MenuItem
              icon="user"
              label="Profile & Settings"
              iconBg={theme.primary + "20"}
              textColor={theme.text}
              chevronColor={theme.textSecondary}
              onPress={() => navigateToDashboardTab("profile")}
            />

            <SectionLabel title="App" color={theme.textSecondary} />
            <MenuItem
              icon="star"
              label="Master List"
              iconBg={theme.warning + "20"}
              textColor={theme.text}
              chevronColor={theme.textSecondary}
              onPress={() => navigateToDashboardTab("dashboard")}
            />
            <MenuItem
              icon="sliders"
              label="Customize"
              iconBg={theme.link + "20"}
              textColor={theme.text}
              chevronColor={theme.textSecondary}
              onPress={() => navigateToDashboardTab("wheel")}
            />
            <MenuItem
              icon="share-2"
              label="Connect"
              iconBg={theme.secondary + "20"}
              textColor={theme.text}
              chevronColor={theme.textSecondary}
              onPress={navigateToPeopleTab}
            />
            <MenuItem
              icon="trash-2"
              label="Recycle Bin"
              iconBg={theme.error + "20"}
              textColor={theme.text}
              chevronColor={theme.textSecondary}
              onPress={() => navigateToDashboardTab("bin")}
            />

            <SectionLabel title="AI" color={theme.textSecondary} />
            <MenuItem
              icon="zap"
              label="Start a Conversation"
              iconBg={theme.warning + "20"}
              textColor={theme.text}
              chevronColor={theme.textSecondary}
              onPress={() =>
                navigateAndClose(() => {
                  navigation.navigate("AssistantChat", {});
                })
              }
            />
            <MenuItem
              icon="calendar"
              label="Generate Daily Plan"
              iconBg={theme.primary + "20"}
              textColor={theme.text}
              chevronColor={theme.textSecondary}
              onPress={() =>
                navigateAndClose(() => {
                  navigation.navigate("DailyPlanGenerator", {});
                })
              }
            />

            <Pressable
              style={[styles.signOutBtn, { borderTopColor: theme.border }]}
              onPress={() => {
                onClose();
                void signOut();
              }}
            >
              <Feather name="log-out" size={15} color="#EF4444" />
              <Text style={styles.signOutLabel}>Sign Out</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderBottomWidth: 1,
  },
  drawerHeaderInfo: {
    flex: 1,
  },
  drawerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  drawerAvatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  drawerInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  drawerName: {
    fontSize: 14,
    fontWeight: "600",
  },
  drawerEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },
  signOutLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#EF4444",
  },
});

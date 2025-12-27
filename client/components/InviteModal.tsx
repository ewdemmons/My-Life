import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  Platform,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as MailComposer from "expo-mail-composer";
import * as SMS from "expo-sms";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Person, LifeCategory, SharePermission, SHARE_PERMISSIONS, CategoryInvite } from "@/types";

interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  person: Person;
  preSelectedCategoryIds?: string[];
}

export function InviteModal({ visible, onClose, person, preSelectedCategoryIds }: InviteModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { categories, updatePerson } = useApp();

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [accessRight, setAccessRight] = useState<SharePermission>("view");
  const [showAccessPicker, setShowAccessPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      const initialIds = preSelectedCategoryIds || person.categoryIds || [];
      setSelectedCategoryIds(initialIds);
      setAccessRight("view");
    }
  }, [visible, preSelectedCategoryIds, person.categoryIds]);

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSendInvite = async (method: "email" | "sms") => {
    if (selectedCategoryIds.length === 0) {
      Alert.alert("Select Categories", "Please select at least one Life Category to share.");
      return;
    }

    const categoryNames = selectedCategoryIds
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");

    const accessLabel = SHARE_PERMISSIONS.find((p) => p.value === accessRight)?.label || "View Only";
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const message = `Hi ${person.name}!\n\nYou've been invited to collaborate on: ${categoryNames}\n\nAccess Level: ${accessLabel}\nInvite Code: ${inviteCode}\n\nDownload the app to join!`;

    try {
      if (method === "email") {
        if (!person.email) {
          Alert.alert("No Email", "This person doesn't have an email address.");
          return;
        }
        const isAvailable = await MailComposer.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert("Email Not Available", "Email is not configured on this device.");
          return;
        }
        await MailComposer.composeAsync({
          recipients: [person.email],
          subject: `Invitation to collaborate on ${categoryNames}`,
          body: message,
        });
      } else {
        if (!person.phone) {
          Alert.alert("No Phone", "This person doesn't have a phone number.");
          return;
        }
        const isAvailable = await SMS.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert("SMS Not Available", "SMS is not available on this device.");
          return;
        }
        await SMS.sendSMSAsync([person.phone], message);
      }

      const newInvites: CategoryInvite[] = selectedCategoryIds.map((catId) => ({
        categoryId: catId,
        permission: accessRight,
        status: "pending",
        invitedAt: Date.now(),
      }));

      const existingInvites = person.categoryInvites || [];
      const updatedInvites = [
        ...existingInvites.filter((inv) => !selectedCategoryIds.includes(inv.categoryId)),
        ...newInvites,
      ];

      await updatePerson(person.id, {
        categoryInvites: updatedInvites,
        inviteCode,
        inviteSentAt: Date.now(),
      });

      Alert.alert("Invite Sent", `Invitation sent to ${person.name} via ${method === "email" ? "email" : "SMS"}.`);
      onClose();
    } catch (error) {
      console.error("Error sending invite:", error);
      Alert.alert("Error", "Failed to send invitation. Please try again.");
    }
  };

  const getAccessInfo = () => {
    return SHARE_PERMISSIONS.find((p) => p.value === accessRight) || SHARE_PERMISSIONS[0];
  };

  const currentAccess = getAccessInfo();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose}>
            <ThemedText style={[styles.cancelButton, { color: theme.textSecondary }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Invite {person.name}</ThemedText>
          <View style={{ width: 50 }} />
        </View>

        <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Access Level</ThemedText>
            <Pressable
              style={[
                styles.selector,
                { backgroundColor: theme.backgroundRoot, borderColor: theme.border },
              ]}
              onPress={() => setShowAccessPicker(true)}
            >
              <Feather name={currentAccess.icon as any} size={18} color={theme.primary} />
              <View style={styles.selectorContent}>
                <ThemedText style={[styles.selectorText, { color: theme.text }]}>
                  {currentAccess.label}
                </ThemedText>
                <ThemedText style={[styles.selectorSubtext, { color: theme.textSecondary }]}>
                  {currentAccess.description}
                </ThemedText>
              </View>
              <Feather name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Share Categories</ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Select the Life Categories you want to share
            </ThemedText>
            {categories.length === 0 ? (
              <View style={styles.emptyCategories}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  No categories to share
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.categoryOption,
                      selectedCategoryIds.includes(item.id) && { backgroundColor: item.color + "15" },
                      { borderColor: theme.border },
                    ]}
                    onPress={() => toggleCategorySelection(item.id)}
                  >
                    <View style={[styles.categoryColorDot, { backgroundColor: item.color }]} />
                    <ThemedText style={[styles.categoryName, { flex: 1 }]}>{item.name}</ThemedText>
                    {selectedCategoryIds.includes(item.id) ? (
                      <Feather name="check-circle" size={20} color={item.color} />
                    ) : (
                      <Feather name="circle" size={20} color={theme.border} />
                    )}
                  </Pressable>
                )}
                style={styles.categoryList}
                scrollEnabled={false}
              />
            )}
          </View>

          <View style={styles.sendSection}>
            <ThemedText style={[styles.sendLabel, { color: theme.textSecondary }]}>
              Send invite via:
            </ThemedText>
            <View style={styles.sendButtons}>
              <Pressable
                style={[styles.sendButton, { backgroundColor: theme.primary }]}
                onPress={() => handleSendInvite("email")}
              >
                <Feather name="mail" size={20} color="#FFFFFF" />
                <ThemedText style={styles.sendButtonText}>Email</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.sendButton, { backgroundColor: "#25D366" }]}
                onPress={() => handleSendInvite("sms")}
              >
                <Feather name="message-circle" size={20} color="#FFFFFF" />
                <ThemedText style={styles.sendButtonText}>SMS</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>

        <Modal
          visible={showAccessPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAccessPicker(false)}
        >
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => setShowAccessPicker(false)}
          >
            <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.pickerTitle}>Access Level</ThemedText>
              {SHARE_PERMISSIONS.map((perm) => (
                <Pressable
                  key={perm.value}
                  style={[
                    styles.pickerOption,
                    accessRight === perm.value && { backgroundColor: theme.primary + "15" },
                  ]}
                  onPress={() => {
                    setAccessRight(perm.value);
                    setShowAccessPicker(false);
                  }}
                >
                  <Feather name={perm.icon as any} size={20} color={theme.primary} />
                  <View style={styles.pickerOptionContent}>
                    <ThemedText style={styles.pickerOptionText}>{perm.label}</ThemedText>
                    <ThemedText style={[styles.pickerOptionDesc, { color: theme.textSecondary }]}>
                      {perm.description}
                    </ThemedText>
                  </View>
                  {accessRight === perm.value ? (
                    <Feather name="check" size={18} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  cancelButton: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  selector: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  selectorContent: {
    flex: 1,
  },
  selectorText: {
    fontSize: 16,
    fontWeight: "500",
  },
  selectorSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryList: {
    maxHeight: 250,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  categoryColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 15,
  },
  emptyCategories: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  sendSection: {
    marginTop: "auto",
  },
  sendLabel: {
    fontSize: 14,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  sendButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  sendButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerContainer: {
    width: "85%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  pickerOptionContent: {
    flex: 1,
  },
  pickerOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  pickerOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});

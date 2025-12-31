import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as MailComposer from "expo-mail-composer";
import * as SMS from "expo-sms";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  LifeCategory,
  Person,
  SharePermission,
  SHARE_PERMISSIONS,
  RELATIONSHIP_TYPES,
} from "@/types";

interface BubbleShareModalProps {
  visible: boolean;
  onClose: () => void;
  category: LifeCategory;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-\+\(\)]{7,}$/;

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function detectContactType(input: string): "email" | "phone" | null {
  const trimmed = input.trim();
  if (EMAIL_REGEX.test(trimmed)) return "email";
  if (PHONE_REGEX.test(trimmed)) return "phone";
  return null;
}

export function BubbleShareModal({
  visible,
  onClose,
  category,
}: BubbleShareModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { people, addPerson } = useApp();
  const { user } = useAuth();

  const [contactInput, setContactInput] = useState("");
  const [permission, setPermission] = useState<SharePermission>("view");
  const [showPermissionPicker, setShowPermissionPicker] = useState(false);
  const [showPeopleSearch, setShowPeopleSearch] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  useEffect(() => {
    if (visible) {
      setContactInput("");
      setPermission("view");
      setSelectedPerson(null);
      setShowPeopleSearch(false);
      setShowPermissionPicker(false);
    }
  }, [visible]);

  const detectedType = useMemo(() => detectContactType(contactInput), [contactInput]);

  const matchingPeople = useMemo(() => {
    if (!contactInput.trim()) return [];
    const query = contactInput.toLowerCase();
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.email && p.email.toLowerCase().includes(query)) ||
        (p.phone && p.phone.includes(query))
    );
  }, [contactInput, people]);

  const findExistingPerson = (): Person | null => {
    const trimmed = contactInput.trim().toLowerCase();
    return (
      people.find(
        (p) =>
          (p.email && p.email.toLowerCase() === trimmed) ||
          (p.phone && p.phone.replace(/\D/g, "") === trimmed.replace(/\D/g, ""))
      ) || null
    );
  };

  const getPermissionInfo = () => {
    return SHARE_PERMISSIONS.find((p) => p.value === permission) || SHARE_PERMISSIONS[0];
  };

  const getRelationshipInfo = (type: string) => {
    return RELATIONSHIP_TYPES.find((r) => r.value === type) || RELATIONSHIP_TYPES[5];
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person);
    setContactInput(person.email || person.phone || person.name);
    setShowPeopleSearch(false);
  };

  const checkExistingAppUser = async (email: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !data) return null;
    return data.id;
  };

  const createPendingShare = async (contactType: "email" | "phone", contactValue: string) => {
    const inviteCode = generateInviteCode();
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user?.id)
      .single();

    const senderName = profileData?.display_name || profileData?.email?.split("@")[0] || "Someone";

    const { error } = await supabase.from("pending_shares").insert({
      user_id: user?.id,
      bubble_id: category.id,
      invite_code: inviteCode,
      contact_type: contactType,
      contact_value: contactValue.toLowerCase(),
      permission,
      status: "pending",
      sender_name: senderName,
      bubble_name: category.name,
    });

    if (error) {
      console.error("Error creating pending share:", error);
      throw error;
    }

    return { inviteCode, senderName };
  };

  const createDirectShare = async (sharedWithId: string) => {
    const { error } = await supabase.from("bubble_shares").upsert(
      {
        bubble_id: category.id,
        owner_id: user?.id,
        shared_with_id: sharedWithId,
        permission,
      },
      { onConflict: "bubble_id,shared_with_id" }
    );

    if (error) {
      console.error("Error creating direct share:", error);
      throw error;
    }
  };

  const sendEmailInvite = async (email: string, inviteCode: string, senderName: string) => {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Email Not Available", "Email is not configured on this device. The invite has been saved and will be activated when the recipient joins.");
      return;
    }

    const appLink = `mylife://invite?code=${inviteCode}`;
    const message = `Hi there!\n\n${senderName} has invited you to collaborate on "${category.name}" in the My Life app.\n\nAccess Level: ${getPermissionInfo().label}\n\nTo accept this invitation:\n1. Download the My Life app\n2. Sign up or log in\n3. Use invite code: ${inviteCode}\n\nOr click here to join: ${appLink}\n\nSee you there!`;

    await MailComposer.composeAsync({
      recipients: [email],
      subject: `${senderName} invited you to "${category.name}" in My Life`,
      body: message,
    });
  };

  const sendSMSInvite = async (phone: string, inviteCode: string, senderName: string) => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("SMS Not Available", "SMS is not available on this device. The invite has been saved and will be activated when the recipient joins.");
      return;
    }

    const message = `${senderName} invited you to collaborate on "${category.name}" in My Life app! Download the app and use invite code: ${inviteCode}`;

    await SMS.sendSMSAsync([phone], message);
  };

  const handleSendInvite = async () => {
    const trimmedInput = contactInput.trim();

    if (!trimmedInput) {
      Alert.alert("Enter Contact", "Please enter an email address or phone number.");
      return;
    }

    const contactType = detectedType;
    if (!contactType) {
      Alert.alert("Invalid Format", "Please enter a valid email address or phone number.");
      return;
    }

    setIsSending(true);

    try {
      if (contactType === "email") {
        const existingUserId = await checkExistingAppUser(trimmedInput);
        if (existingUserId) {
          await createDirectShare(existingUserId);
          Alert.alert("Shared!", `"${category.name}" has been shared directly with this user.`);
          onClose();
          return;
        }
      }

      const existingPerson = selectedPerson || findExistingPerson();

      const { inviteCode, senderName } = await createPendingShare(contactType, trimmedInput);

      if (!existingPerson) {
        await addPerson({
          name: trimmedInput.split("@")[0] || trimmedInput,
          relationship: "other",
          email: contactType === "email" ? trimmedInput : undefined,
          phone: contactType === "phone" ? trimmedInput : undefined,
          categoryIds: [category.id],
        });
      }

      if (contactType === "email") {
        await sendEmailInvite(trimmedInput, inviteCode, senderName);
      } else {
        await sendSMSInvite(trimmedInput, inviteCode, senderName);
      }

      Alert.alert(
        "Invite Sent!",
        `Invitation sent via ${contactType === "email" ? "email" : "SMS"}. They can use code ${inviteCode} to join.`
      );
      onClose();
    } catch (error) {
      console.error("Error sending invite:", error);
      Alert.alert("Error", "Failed to send invitation. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const currentPermission = getPermissionInfo();

  const renderPersonItem = ({ item }: { item: Person }) => {
    const relationshipInfo = getRelationshipInfo(item.relationship);
    return (
      <Pressable
        style={[styles.personItem, { backgroundColor: theme.backgroundSecondary }]}
        onPress={() => handleSelectPerson(item)}
      >
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={styles.personAvatar} />
        ) : (
          <View style={[styles.personAvatar, { backgroundColor: theme.primary + "30" }]}>
            <ThemedText style={[styles.personInitials, { color: theme.primary }]}>
              {getInitials(item.name)}
            </ThemedText>
          </View>
        )}
        <View style={styles.personInfo}>
          <ThemedText style={[styles.personName, { color: theme.text }]}>{item.name}</ThemedText>
          <ThemedText style={[styles.personContact, { color: theme.textSecondary }]}>
            {item.email || item.phone || relationshipInfo.label}
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <ThemedText style={[styles.cancelButton, { color: theme.textSecondary }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Share "{category.name}"</ThemedText>
          <Pressable
            onPress={handleSendInvite}
            disabled={isSending || !contactInput.trim()}
            hitSlop={12}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <ThemedText
                style={[
                  styles.sendButton,
                  { color: contactInput.trim() ? theme.primary : theme.textSecondary },
                ]}
              >
                Send
              </ThemedText>
            )}
          </Pressable>
        </View>

        <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Invite via Email or Phone</ThemedText>
            <View style={[styles.inputContainer, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}>
              <Feather
                name={detectedType === "email" ? "mail" : detectedType === "phone" ? "phone" : "user"}
                size={20}
                color={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Email address or phone number"
                placeholderTextColor={theme.textSecondary}
                value={contactInput}
                onChangeText={setContactInput}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setShowPeopleSearch(true)}
              />
              {contactInput.length > 0 && (
                <Pressable onPress={() => setContactInput("")} hitSlop={8}>
                  <Feather name="x-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>

            {detectedType && (
              <View style={styles.detectedBadge}>
                <Feather
                  name={detectedType === "email" ? "mail" : "phone"}
                  size={12}
                  color={theme.primary}
                />
                <ThemedText style={[styles.detectedText, { color: theme.primary }]}>
                  Will send via {detectedType === "email" ? "Email" : "SMS"}
                </ThemedText>
              </View>
            )}
          </View>

          {showPeopleSearch && matchingPeople.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Select from your contacts
              </ThemedText>
              <FlatList
                data={matchingPeople.slice(0, 5)}
                renderItem={renderPersonItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                style={styles.peopleList}
              />
            </View>
          )}

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Access Level</ThemedText>
            <Pressable
              style={[styles.selector, { backgroundColor: theme.backgroundRoot, borderColor: theme.border }]}
              onPress={() => setShowPermissionPicker(true)}
            >
              <Feather name={currentPermission.icon as any} size={18} color={theme.primary} />
              <View style={styles.selectorContent}>
                <ThemedText style={[styles.selectorText, { color: theme.text }]}>
                  {currentPermission.label}
                </ThemedText>
                <ThemedText style={[styles.selectorSubtext, { color: theme.textSecondary }]}>
                  {currentPermission.description}
                </ThemedText>
              </View>
              <Feather name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              {detectedType === "email"
                ? "If this email belongs to an existing user, they'll get instant access. Otherwise, an invite will be sent."
                : "An SMS invite with a code will be sent. The recipient can join using this code after signing up."}
            </ThemedText>
          </View>
        </View>

        <Modal
          visible={showPermissionPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPermissionPicker(false)}
        >
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => setShowPermissionPicker(false)}
          >
            <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.pickerTitle}>Select Access Level</ThemedText>
              {SHARE_PERMISSIONS.map((perm) => (
                <Pressable
                  key={perm.value}
                  style={[
                    styles.pickerOption,
                    { backgroundColor: permission === perm.value ? theme.primary + "20" : "transparent" },
                  ]}
                  onPress={() => {
                    setPermission(perm.value);
                    setShowPermissionPicker(false);
                  }}
                >
                  <Feather
                    name={perm.icon as any}
                    size={20}
                    color={permission === perm.value ? theme.primary : theme.textSecondary}
                  />
                  <View style={styles.pickerOptionContent}>
                    <ThemedText
                      style={[
                        styles.pickerOptionText,
                        { color: permission === perm.value ? theme.primary : theme.text },
                      ]}
                    >
                      {perm.label}
                    </ThemedText>
                    <ThemedText style={[styles.pickerOptionDesc, { color: theme.textSecondary }]}>
                      {perm.description}
                    </ThemedText>
                  </View>
                  {permission === perm.value && (
                    <Feather name="check" size={20} color={theme.primary} />
                  )}
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
    alignItems: "center",
    justifyContent: "space-between",
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
  sendButton: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  detectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  detectedText: {
    fontSize: 12,
    fontWeight: "500",
  },
  peopleList: {
    marginTop: Spacing.xs,
  },
  personItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  personInitials: {
    fontSize: 14,
    fontWeight: "600",
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 15,
    fontWeight: "500",
  },
  personContact: {
    fontSize: 13,
    marginTop: 2,
  },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  selectorContent: {
    flex: 1,
  },
  selectorText: {
    fontSize: 15,
    fontWeight: "500",
  },
  selectorSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  pickerContainer: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  pickerOptionContent: {
    flex: 1,
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: "500",
  },
  pickerOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});

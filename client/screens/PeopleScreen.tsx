import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  FlatList,
  TextInput,
  Modal,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import * as MailComposer from "expo-mail-composer";
import * as SMS from "expo-sms";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Person, RelationshipType, RELATIONSHIP_TYPES } from "@/types";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { people, addPerson, updatePerson, deletePerson } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<RelationshipType>("friend");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [notes, setNotes] = useState("");
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const generateInviteCode = () => {
    return 'MYLIFE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSendEmailInvite = async () => {
    if (!editingPerson) return;
    
    const personEmail = editingPerson.email || email;
    if (!personEmail) {
      Alert.alert("No Email", "Please add an email address to send an invite.");
      return;
    }

    const inviteCode = generateInviteCode();
    const isAvailable = await MailComposer.isAvailableAsync();

    if (!isAvailable) {
      if (Platform.OS === "web") {
        Alert.alert(
          "Not Available",
          "Email composer is only available in Expo Go on your mobile device."
        );
      } else {
        const mailtoUrl = `mailto:${personEmail}?subject=${encodeURIComponent("Join me on My Life!")}&body=${encodeURIComponent(
          `Hi ${editingPerson.name},\n\nI'd like to share my life organization with you using the My Life app!\n\nDownload the app and use this invite code to connect with me:\n\n${inviteCode}\n\nLooking forward to organizing together!`
        )}`;
        await Linking.openURL(mailtoUrl);
      }
      setShowInviteModal(false);
      return;
    }

    try {
      await MailComposer.composeAsync({
        recipients: [personEmail],
        subject: "Join me on My Life!",
        body: `Hi ${editingPerson.name},\n\nI'd like to share my life organization with you using the My Life app!\n\nDownload the app and use this invite code to connect with me:\n\n${inviteCode}\n\nLooking forward to organizing together!`,
      });

      await updatePerson(editingPerson.id, {
        inviteCode,
        inviteSentAt: Date.now(),
      });

      Alert.alert("Invite Sent", `An invite has been sent to ${editingPerson.name}.`);
    } catch (error) {
      Alert.alert("Error", "Failed to send invite. Please try again.");
    }
    setShowInviteModal(false);
  };

  const handleSendSMSInvite = async () => {
    if (!editingPerson) return;
    
    const personPhone = editingPerson.phone || phone;
    if (!personPhone) {
      Alert.alert("No Phone", "Please add a phone number to send an SMS invite.");
      return;
    }

    const inviteCode = generateInviteCode();
    
    if (Platform.OS === "web") {
      Alert.alert(
        "Not Available",
        "SMS is only available in Expo Go on your mobile device."
      );
      return;
    }

    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("SMS Not Available", "SMS is not available on this device.");
      return;
    }

    try {
      await SMS.sendSMSAsync(
        [personPhone],
        `Hi ${editingPerson.name}! I'd like to share my life organization with you using the My Life app. Download it and use invite code: ${inviteCode} to connect with me!`
      );

      await updatePerson(editingPerson.id, {
        inviteCode,
        inviteSentAt: Date.now(),
      });

      Alert.alert("Invite Sent", `An SMS invite has been sent to ${editingPerson.name}.`);
    } catch (error) {
      Alert.alert("Error", "Failed to send SMS. Please try again.");
    }
    setShowInviteModal(false);
  };

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const query = searchQuery.toLowerCase();
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.relationship.toLowerCase().includes(query) ||
        (p.email && p.email.toLowerCase().includes(query)) ||
        (p.notes && p.notes.toLowerCase().includes(query))
    );
  }, [people, searchQuery]);

  const resetForm = () => {
    setName("");
    setRelationship("friend");
    setEmail("");
    setPhone("");
    setPhotoUri("");
    setNotes("");
    setEditingPerson(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (person: Person) => {
    setEditingPerson(person);
    setName(person.name);
    setRelationship(person.relationship);
    setEmail(person.email || "");
    setPhone(person.phone || "");
    setPhotoUri(person.photoUri || "");
    setNotes(person.notes || "");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a name");
      return;
    }

    const personData = {
      name: name.trim(),
      relationship,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      photoUri: photoUri || undefined,
      notes: notes.trim() || undefined,
    };

    if (editingPerson) {
      await updatePerson(editingPerson.id, personData);
    } else {
      await addPerson(personData);
    }

    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (person: Person) => {
    Alert.alert(
      "Delete Person",
      `Are you sure you want to remove "${person.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deletePerson(person.id),
        },
      ]
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const getRelationshipInfo = (type: RelationshipType) => {
    return RELATIONSHIP_TYPES.find((r) => r.value === type) || RELATIONSHIP_TYPES[5];
  };

  const getInitials = (personName: string) => {
    const parts = personName.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return personName.slice(0, 2).toUpperCase();
  };

  const renderPersonItem = ({ item }: { item: Person }) => {
    const relInfo = getRelationshipInfo(item.relationship);

    return (
      <Pressable
        style={[styles.personCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => openEditModal(item)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.personRow}>
          {item.photoUri ? (
            <Image
              source={{ uri: item.photoUri }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + "30" }]}>
              <ThemedText style={[styles.avatarInitials, { color: theme.primary }]}>
                {getInitials(item.name)}
              </ThemedText>
            </View>
          )}
          <View style={styles.personInfo}>
            <ThemedText style={styles.personName}>{item.name}</ThemedText>
            <View style={styles.relationshipRow}>
              <Feather name={relInfo.icon as any} size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.relationshipText, { color: theme.textSecondary }]}>
                {relInfo.label}
              </ThemedText>
            </View>
            {(item.email || item.phone) ? (
              <ThemedText style={[styles.contactText, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.email || item.phone}
              </ThemedText>
            ) : null}
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </Pressable>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyState}>
      <Feather name="users" size={48} color={theme.textSecondary} />
      <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No people added yet
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Tap the + button to add family, friends, colleagues, or pets
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search people..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          data={filteredPeople}
          keyExtractor={(item) => item.id}
          renderItem={renderPersonItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl + 60 },
          ]}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={false}
        />

        <Pressable
          style={[styles.fab, { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.lg }]}
          onPress={openAddModal}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => {
              setModalVisible(false);
              resetForm();
            }}>
              <ThemedText style={[styles.cancelButton, { color: theme.primary }]}>Cancel</ThemedText>
            </Pressable>
            <ThemedText style={styles.modalTitle}>
              {editingPerson ? "Edit Person" : "Add Person"}
            </ThemedText>
            <Pressable onPress={handleSave}>
              <ThemedText style={[styles.saveButton, { color: theme.primary }]}>Save</ThemedText>
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}
          >
            <Pressable style={styles.photoSection} onPress={pickImage}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="camera" size={32} color={theme.textSecondary} />
                  <ThemedText style={[styles.photoHint, { color: theme.textSecondary }]}>
                    Add Photo
                  </ThemedText>
                </View>
              )}
            </Pressable>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Name *</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Enter name"
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Relationship</ThemedText>
              <Pressable
                style={[styles.pickerButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={() => setShowRelationshipPicker(true)}
              >
                <View style={styles.pickerContent}>
                  <Feather name={getRelationshipInfo(relationship).icon as any} size={18} color={theme.primary} />
                  <ThemedText style={styles.pickerText}>{getRelationshipInfo(relationship).label}</ThemedText>
                </View>
                <Feather name="chevron-down" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Enter email (optional)"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Phone</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Enter phone (optional)"
                placeholderTextColor={theme.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Notes</ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                placeholder="Add notes (optional)"
                placeholderTextColor={theme.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {editingPerson ? (
              <View style={styles.actionButtons}>
                <Pressable
                  style={[styles.inviteButton, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}
                  onPress={() => setShowInviteModal(true)}
                >
                  <Feather name="send" size={18} color={theme.primary} />
                  <ThemedText style={[styles.inviteButtonText, { color: theme.primary }]}>
                    {editingPerson.inviteSentAt ? "Resend Invite" : "Invite to App"}
                  </ThemedText>
                </Pressable>
                {editingPerson.inviteSentAt ? (
                  <ThemedText style={[styles.inviteStatus, { color: theme.textSecondary }]}>
                    Invite sent on {new Date(editingPerson.inviteSentAt).toLocaleDateString()}
                  </ThemedText>
                ) : null}
                <Pressable
                  style={[styles.deleteButton, { borderColor: theme.error }]}
                  onPress={() => {
                    setModalVisible(false);
                    handleDelete(editingPerson);
                    resetForm();
                  }}
                >
                  <Feather name="trash-2" size={18} color={theme.error} />
                  <ThemedText style={[styles.deleteButtonText, { color: theme.error }]}>
                    Remove Person
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </KeyboardAwareScrollViewCompat>
        </View>

        <Modal
          visible={showRelationshipPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRelationshipPicker(false)}
        >
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => setShowRelationshipPicker(false)}
          >
            <View style={[styles.pickerModal, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.pickerTitle}>Select Relationship</ThemedText>
              {RELATIONSHIP_TYPES.map((rel) => (
                <Pressable
                  key={rel.value}
                  style={[
                    styles.pickerOption,
                    relationship === rel.value && { backgroundColor: theme.primary + "20" },
                  ]}
                  onPress={() => {
                    setRelationship(rel.value);
                    setShowRelationshipPicker(false);
                  }}
                >
                  <Feather name={rel.icon as any} size={20} color={relationship === rel.value ? theme.primary : theme.text} />
                  <ThemedText
                    style={[
                      styles.pickerOptionText,
                      relationship === rel.value && { color: theme.primary },
                    ]}
                  >
                    {rel.label}
                  </ThemedText>
                  {relationship === rel.value ? (
                    <Feather name="check" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={showInviteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowInviteModal(false)}
        >
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => setShowInviteModal(false)}
          >
            <View style={[styles.inviteModalContent, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.inviteModalTitle}>
                Invite {editingPerson?.name}
              </ThemedText>
              <ThemedText style={[styles.inviteModalSubtitle, { color: theme.textSecondary }]}>
                Send an invite to join My Life and collaborate with you
              </ThemedText>

              <Pressable
                style={[styles.inviteOption, { backgroundColor: theme.backgroundRoot }]}
                onPress={handleSendEmailInvite}
              >
                <View style={[styles.inviteOptionIcon, { backgroundColor: "#3B82F6" + "20" }]}>
                  <Feather name="mail" size={22} color="#3B82F6" />
                </View>
                <View style={styles.inviteOptionInfo}>
                  <ThemedText style={styles.inviteOptionTitle}>Send Email</ThemedText>
                  <ThemedText style={[styles.inviteOptionDesc, { color: theme.textSecondary }]}>
                    {editingPerson?.email || "No email added"}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>

              <Pressable
                style={[styles.inviteOption, { backgroundColor: theme.backgroundRoot }]}
                onPress={handleSendSMSInvite}
              >
                <View style={[styles.inviteOptionIcon, { backgroundColor: "#22C55E" + "20" }]}>
                  <Feather name="message-circle" size={22} color="#22C55E" />
                </View>
                <View style={styles.inviteOptionInfo}>
                  <ThemedText style={styles.inviteOptionTitle}>Send SMS</ThemedText>
                  <ThemedText style={[styles.inviteOptionDesc, { color: theme.textSecondary }]}>
                    {editingPerson?.phone || "No phone added"}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>

              <Pressable
                style={[styles.inviteCancelButton]}
                onPress={() => setShowInviteModal(false)}
              >
                <ThemedText style={[styles.inviteCancelText, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  personCard: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "600",
  },
  personInfo: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: 16,
    fontWeight: "600",
  },
  relationshipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  relationshipText: {
    fontSize: 13,
  },
  contactText: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  cancelButton: {
    fontSize: 16,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  photoSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
  },
  photoHint: {
    fontSize: 12,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  pickerButton: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pickerText: {
    fontSize: 16,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  pickerModal: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.md,
  },
  pickerOptionText: {
    fontSize: 16,
    flex: 1,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionButtons: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  inviteStatus: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  inviteModalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  inviteModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  inviteModalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  inviteOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  inviteOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteOptionInfo: {
    flex: 1,
  },
  inviteOptionTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  inviteOptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  inviteCancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  inviteCancelText: {
    fontSize: 16,
  },
});

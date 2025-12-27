import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Modal,
  Platform,
  FlatList,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Contacts from "expo-contacts";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { RelationshipType, RELATIONSHIP_TYPES, LifeCategory } from "@/types";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

interface AddPersonModalProps {
  visible: boolean;
  onClose: () => void;
  preSelectedCategoryId?: string;
}

interface ContactItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  imageUri?: string;
}

export function AddPersonModal({ visible, onClose, preSelectedCategoryId }: AddPersonModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { addPerson, categories, updatePerson } = useApp();

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<RelationshipType>("friend");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  React.useEffect(() => {
    if (visible && preSelectedCategoryId) {
      setSelectedCategoryIds((prev) => 
        prev.includes(preSelectedCategoryId) ? prev : [...prev, preSelectedCategoryId]
      );
    }
  }, [visible, preSelectedCategoryId]);

  const resetForm = () => {
    setName("");
    setRelationship("friend");
    setEmail("");
    setPhone("");
    setPhotoUri("");
    setNotes("");
    setSelectedCategoryIds([]);
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
      categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
    };

    await addPerson(personData);
    resetForm();
    onClose();
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getSelectedCategoriesDisplay = () => {
    if (selectedCategoryIds.length === 0) return "None selected";
    if (selectedCategoryIds.length === 1) {
      const cat = categories.find((c) => c.id === selectedCategoryIds[0]);
      return cat?.name || "1 selected";
    }
    return `${selectedCategoryIds.length} selected`;
  };

  const handleClose = () => {
    resetForm();
    onClose();
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

  const handleImportFromContacts = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Not Available",
        "Contact import is only available in Expo Go on your mobile device. Please scan the QR code to test this feature."
      );
      return;
    }

    setLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== "granted") {
        const canAskAgain = await Contacts.getPermissionsAsync();
        if (!canAskAgain.canAskAgain) {
          Alert.alert(
            "Permission Required",
            "Please enable Contacts access in Settings to import contacts.",
            [
              { text: "Cancel", style: "cancel" },
              { 
                text: "Open Settings", 
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (e) {
                    // Settings not available
                  }
                }
              },
            ]
          );
        } else {
          Alert.alert("Permission Denied", "Contacts permission is required to import contacts.");
        }
        setLoadingContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.Emails,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Image,
        ],
      });

      const formattedContacts: ContactItem[] = data
        .filter((c) => c.name)
        .map((contact) => ({
          id: contact.id || Math.random().toString(),
          name: contact.name || "",
          email: contact.emails?.[0]?.email,
          phone: contact.phoneNumbers?.[0]?.number,
          imageUri: contact.image?.uri,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setContacts(formattedContacts);
      setShowContactPicker(true);
    } catch (error) {
      Alert.alert("Error", "Failed to load contacts. Please try again.");
    }
    setLoadingContacts(false);
  };

  const selectContact = (contact: ContactItem) => {
    setName(contact.name);
    if (contact.email) setEmail(contact.email);
    if (contact.phone) setPhone(contact.phone);
    if (contact.imageUri) setPhotoUri(contact.imageUri);
    setShowContactPicker(false);
    setContactSearch("");
  };

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone?.includes(contactSearch)
  );

  const getRelationshipInfo = (rel: RelationshipType) => {
    return RELATIONSHIP_TYPES.find((r) => r.value === rel) || RELATIONSHIP_TYPES[1];
  };

  const currentRelInfo = getRelationshipInfo(relationship);

  const renderContactItem = ({ item }: { item: ContactItem }) => (
    <Pressable
      style={[styles.contactItem, { borderBottomColor: theme.border }]}
      onPress={() => selectContact(item)}
    >
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.contactAvatar} contentFit="cover" />
      ) : (
        <View style={[styles.contactAvatarPlaceholder, { backgroundColor: theme.primary + "20" }]}>
          <ThemedText style={[styles.contactInitials, { color: theme.primary }]}>
            {item.name.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
      )}
      <View style={styles.contactInfo}>
        <ThemedText style={styles.contactName}>{item.name}</ThemedText>
        {item.email ? (
          <ThemedText style={[styles.contactDetail, { color: theme.textSecondary }]}>
            {item.email}
          </ThemedText>
        ) : item.phone ? (
          <ThemedText style={[styles.contactDetail, { color: theme.textSecondary }]}>
            {item.phone}
          </ThemedText>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={handleClose}>
            <ThemedText style={[styles.cancelButton, { color: theme.textSecondary }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Add Person</ThemedText>
          <Pressable onPress={handleSave}>
            <ThemedText style={[styles.saveButton, { color: theme.primary }]}>
              Save
            </ThemedText>
          </Pressable>
        </View>

        <KeyboardAwareScrollViewCompat
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={[styles.importButton, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}
            onPress={handleImportFromContacts}
            disabled={loadingContacts}
          >
            {loadingContacts ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Feather name="download" size={20} color={theme.primary} />
            )}
            <ThemedText style={[styles.importButtonText, { color: theme.primary }]}>
              {loadingContacts ? "Loading Contacts..." : "Import from Contacts"}
            </ThemedText>
          </Pressable>

          <View style={styles.dividerContainer}>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>
              or enter manually
            </ThemedText>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          </View>

          <Pressable style={styles.photoContainer} onPress={pickImage}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="camera" size={32} color={theme.primary} />
              </View>
            )}
            <ThemedText style={[styles.photoHint, { color: theme.textSecondary }]}>
              Tap to add photo
            </ThemedText>
          </Pressable>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Name *</ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Relationship</ThemedText>
            <Pressable
              style={[
                styles.selector,
                { backgroundColor: theme.backgroundRoot, borderColor: theme.border },
              ]}
              onPress={() => setShowRelationshipPicker(true)}
            >
              <Feather name={currentRelInfo.icon as any} size={18} color={theme.primary} />
              <ThemedText style={[styles.selectorText, { color: theme.text }]}>
                {currentRelInfo.label}
              </ThemedText>
              <Feather name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Phone</ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
              ]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Notes</ThemedText>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this person..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Life Categories</ThemedText>
            <Pressable
              style={[
                styles.selector,
                { backgroundColor: theme.backgroundRoot, borderColor: theme.border },
              ]}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Feather name="grid" size={18} color={theme.primary} />
              <ThemedText style={[styles.selectorText, { color: theme.text }]}>
                {getSelectedCategoriesDisplay()}
              </ThemedText>
              <Feather name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>
            {selectedCategoryIds.length > 0 ? (
              <View style={styles.selectedCategoriesContainer}>
                {selectedCategoryIds.map((catId) => {
                  const cat = categories.find((c) => c.id === catId);
                  if (!cat) return null;
                  return (
                    <Pressable
                      key={catId}
                      style={[styles.categoryChip, { backgroundColor: cat.color + "20" }]}
                      onPress={() => toggleCategorySelection(catId)}
                    >
                      <View style={[styles.categoryChipDot, { backgroundColor: cat.color }]} />
                      <ThemedText style={[styles.categoryChipText, { color: cat.color }]}>
                        {cat.name}
                      </ThemedText>
                      <Feather name="x" size={14} color={cat.color} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </KeyboardAwareScrollViewCompat>

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
            <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.pickerTitle}>Select Relationship</ThemedText>
              {RELATIONSHIP_TYPES.map((rel) => (
                <Pressable
                  key={rel.value}
                  style={[
                    styles.pickerOption,
                    relationship === rel.value && { backgroundColor: theme.primary + "15" },
                  ]}
                  onPress={() => {
                    setRelationship(rel.value);
                    setShowRelationshipPicker(false);
                  }}
                >
                  <Feather name={rel.icon as any} size={20} color={theme.primary} />
                  <ThemedText style={styles.pickerOptionText}>{rel.label}</ThemedText>
                  {relationship === rel.value ? (
                    <Feather name="check" size={18} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={showCategoryPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCategoryPicker(false)}
        >
          <Pressable
            style={styles.pickerOverlay}
            onPress={() => setShowCategoryPicker(false)}
          >
            <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundDefault, maxHeight: 400 }]}>
              <ThemedText style={styles.pickerTitle}>Select Life Categories</ThemedText>
              <ThemedText style={[styles.pickerSubtitle, { color: theme.textSecondary }]}>
                Tag this person to categories
              </ThemedText>
              {categories.length === 0 ? (
                <View style={styles.emptyCategories}>
                  <ThemedText style={{ color: theme.textSecondary }}>
                    No categories created yet
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  data={categories}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.pickerOption,
                        selectedCategoryIds.includes(item.id) && { backgroundColor: item.color + "15" },
                      ]}
                      onPress={() => toggleCategorySelection(item.id)}
                    >
                      <View style={[styles.categoryColorDot, { backgroundColor: item.color }]} />
                      <ThemedText style={styles.pickerOptionText}>{item.name}</ThemedText>
                      {selectedCategoryIds.includes(item.id) ? (
                        <Feather name="check" size={18} color={item.color} />
                      ) : null}
                    </Pressable>
                  )}
                  style={{ maxHeight: 280 }}
                />
              )}
              <Pressable
                style={[styles.pickerDoneButton, { backgroundColor: theme.primary }]}
                onPress={() => setShowCategoryPicker(false)}
              >
                <ThemedText style={styles.pickerDoneText}>Done</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={showContactPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowContactPicker(false);
            setContactSearch("");
          }}
        >
          <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => {
                setShowContactPicker(false);
                setContactSearch("");
              }}>
                <ThemedText style={[styles.cancelButton, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.headerTitle}>Select Contact</ThemedText>
              <View style={{ width: 50 }} />
            </View>

            <View style={[styles.searchContainer, { borderBottomColor: theme.border }]}>
              <Feather name="search" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                value={contactSearch}
                onChangeText={setContactSearch}
                placeholder="Search contacts..."
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
              {contactSearch.length > 0 ? (
                <Pressable onPress={() => setContactSearch("")}>
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              renderItem={renderContactItem}
              contentContainerStyle={{ paddingBottom: insets.bottom }}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <ThemedText style={{ color: theme.textSecondary }}>
                    {contactSearch ? "No contacts found" : "No contacts available"}
                  </ThemedText>
                </View>
              }
            />
          </View>
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
  saveButton: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    padding: Spacing.lg,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: Spacing.md,
    fontSize: 13,
  },
  photoContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  photoHint: {
    marginTop: Spacing.sm,
    fontSize: 13,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  selector: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
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
  pickerOptionText: {
    flex: 1,
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  contactAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInitials: {
    fontSize: 18,
    fontWeight: "600",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
  },
  contactDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyList: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  selectedCategoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  categoryChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  categoryColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pickerSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  emptyCategories: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  pickerDoneButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  pickerDoneText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

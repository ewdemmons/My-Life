import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { RelationshipType, RELATIONSHIP_TYPES } from "@/types";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

interface AddPersonModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddPersonModal({ visible, onClose }: AddPersonModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { addPerson } = useApp();

  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<RelationshipType>("friend");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [notes, setNotes] = useState("");
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);

  const resetForm = () => {
    setName("");
    setRelationship("friend");
    setEmail("");
    setPhone("");
    setPhotoUri("");
    setNotes("");
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

    await addPerson(personData);
    resetForm();
    onClose();
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

  const getRelationshipInfo = (rel: RelationshipType) => {
    return RELATIONSHIP_TYPES.find((r) => r.value === rel) || RELATIONSHIP_TYPES[1];
  };

  const currentRelInfo = getRelationshipInfo(relationship);

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
});

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import {
  Person,
  ShareRecord,
  SharePermission,
  SHARE_PERMISSIONS,
  RELATIONSHIP_TYPES,
} from "@/types";

interface SharePeopleModalProps {
  visible: boolean;
  onClose: () => void;
  sharedWith: ShareRecord[];
  onUpdateSharing: (shares: ShareRecord[]) => Promise<void>;
  itemTitle: string;
}

export function SharePeopleModal({
  visible,
  onClose,
  sharedWith,
  onUpdateSharing,
  itemTitle,
}: SharePeopleModalProps) {
  const { theme } = useTheme();
  const { people } = useApp();
  const [localShares, setLocalShares] = useState<ShareRecord[]>(sharedWith);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showPermissionPicker, setShowPermissionPicker] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<SharePermission>("view");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocalShares(sharedWith);
    }
  }, [visible, sharedWith]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRelationshipInfo = (type: string) => {
    return RELATIONSHIP_TYPES.find((r) => r.value === type) || RELATIONSHIP_TYPES[5];
  };

  const getPersonById = (id: string): Person | undefined => {
    return people.find((p) => p.id === id);
  };

  const isPersonShared = (personId: string): boolean => {
    return localShares.some((s) => s.personId === personId);
  };

  const handleAddPerson = (personId: string) => {
    if (isPersonShared(personId)) {
      Alert.alert("Already Shared", "This person already has access.");
      return;
    }
    setSelectedPersonId(personId);
    setShowAddPerson(false);
    setShowPermissionPicker(true);
  };

  const handleConfirmShare = () => {
    if (!selectedPersonId) return;

    const newShare: ShareRecord = {
      personId: selectedPersonId,
      permission: selectedPermission,
      sharedAt: Date.now(),
    };

    setLocalShares([...localShares, newShare]);
    setShowPermissionPicker(false);
    setSelectedPersonId(null);
    setSelectedPermission("view");
  };

  const handleRemoveShare = (personId: string) => {
    const person = getPersonById(personId);
    Alert.alert(
      "Remove Access",
      `Remove ${person?.name || "this person"}'s access to "${itemTitle}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setLocalShares(localShares.filter((s) => s.personId !== personId));
          },
        },
      ]
    );
  };

  const handleUpdatePermission = (personId: string, permission: SharePermission) => {
    setLocalShares(
      localShares.map((s) =>
        s.personId === personId ? { ...s, permission } : s
      )
    );
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onUpdateSharing(localShares);
      onClose();
    } catch (error) {
      Alert.alert("Error", "Failed to save sharing settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const availablePeople = people.filter((p) => !isPersonShared(p.id));

  const renderSharedPerson = ({ item }: { item: ShareRecord }) => {
    const person = getPersonById(item.personId);
    if (!person) return null;

    const permInfo = SHARE_PERMISSIONS.find((p) => p.value === item.permission) || SHARE_PERMISSIONS[0];

    return (
      <View style={[styles.sharedPersonRow, { backgroundColor: theme.backgroundSecondary }]}>
        {person.photoUri ? (
          <Image source={{ uri: person.photoUri }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + "30" }]}>
            <ThemedText style={[styles.avatarInitials, { color: theme.primary }]}>
              {getInitials(person.name)}
            </ThemedText>
          </View>
        )}
        <View style={styles.personInfo}>
          <ThemedText style={styles.personName}>{person.name}</ThemedText>
          <View style={styles.permissionRow}>
            <Feather name={permInfo.icon as any} size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.permissionText, { color: theme.textSecondary }]}>
              {permInfo.label}
            </ThemedText>
          </View>
        </View>
        <Pressable
          style={styles.permissionButton}
          onPress={() => {
            const currentIndex = SHARE_PERMISSIONS.findIndex((p) => p.value === item.permission);
            const nextIndex = (currentIndex + 1) % SHARE_PERMISSIONS.length;
            handleUpdatePermission(item.personId, SHARE_PERMISSIONS[nextIndex].value);
          }}
        >
          <Feather name="chevron-down" size={16} color={theme.textSecondary} />
        </Pressable>
        <Pressable style={styles.removeButton} onPress={() => handleRemoveShare(item.personId)}>
          <Feather name="x" size={18} color={theme.error} />
        </Pressable>
      </View>
    );
  };

  const renderAvailablePerson = ({ item }: { item: Person }) => {
    const relInfo = getRelationshipInfo(item.relationship);

    return (
      <Pressable
        style={[styles.availablePersonRow, { backgroundColor: theme.backgroundSecondary }]}
        onPress={() => handleAddPerson(item.id)}
      >
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={styles.avatar} contentFit="cover" />
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
        </View>
        <Feather name="plus" size={20} color={theme.primary} />
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose}>
            <ThemedText style={[styles.headerButton, { color: theme.primary }]}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>Share</ThemedText>
          <Pressable onPress={handleSave}>
            <ThemedText style={[styles.headerButton, styles.saveButton, { color: theme.primary }]}>
              Done
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.itemPreview}>
            <Feather name="share-2" size={20} color={theme.primary} />
            <ThemedText style={styles.itemTitle} numberOfLines={1}>
              {itemTitle}
            </ThemedText>
          </View>

          {localShares.length > 0 ? (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                Shared With
              </ThemedText>
              <FlatList
                data={localShares}
                keyExtractor={(item) => item.personId}
                renderItem={renderSharedPerson}
                scrollEnabled={false}
              />
            </View>
          ) : null}

          <Pressable
            style={[styles.addButton, { backgroundColor: theme.primary + "15" }]}
            onPress={() => setShowAddPerson(true)}
          >
            <Feather name="user-plus" size={18} color={theme.primary} />
            <ThemedText style={[styles.addButtonText, { color: theme.primary }]}>
              Add People
            </ThemedText>
          </Pressable>
        </View>

        <Modal
          visible={showAddPerson}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddPerson(false)}
        >
          <Pressable style={styles.overlay} onPress={() => setShowAddPerson(false)}>
            <View style={[styles.pickerModal, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.pickerTitle}>Add People</ThemedText>
              {availablePeople.length > 0 ? (
                <FlatList
                  data={availablePeople}
                  keyExtractor={(item) => item.id}
                  renderItem={renderAvailablePerson}
                  style={styles.personList}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Feather name="users" size={32} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    All your contacts already have access
                  </ThemedText>
                </View>
              )}
              <Pressable style={styles.closeButton} onPress={() => setShowAddPerson(false)}>
                <ThemedText style={[styles.closeButtonText, { color: theme.textSecondary }]}>
                  Close
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={showPermissionPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPermissionPicker(false)}
        >
          <Pressable style={styles.overlay} onPress={() => setShowPermissionPicker(false)}>
            <View style={[styles.pickerModal, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={styles.pickerTitle}>Choose Permission</ThemedText>
              {SHARE_PERMISSIONS.map((perm) => (
                <Pressable
                  key={perm.value}
                  style={[
                    styles.permissionOption,
                    selectedPermission === perm.value && { backgroundColor: theme.primary + "20" },
                  ]}
                  onPress={() => setSelectedPermission(perm.value)}
                >
                  <Feather
                    name={perm.icon as any}
                    size={20}
                    color={selectedPermission === perm.value ? theme.primary : theme.text}
                  />
                  <View style={styles.permissionOptionInfo}>
                    <ThemedText
                      style={[
                        styles.permissionOptionTitle,
                        selectedPermission === perm.value && { color: theme.primary },
                      ]}
                    >
                      {perm.label}
                    </ThemedText>
                    <ThemedText style={[styles.permissionOptionDesc, { color: theme.textSecondary }]}>
                      {perm.description}
                    </ThemedText>
                  </View>
                  {selectedPermission === perm.value ? (
                    <Feather name="check" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
              <Pressable
                style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                onPress={handleConfirmShare}
              >
                <ThemedText style={styles.confirmButtonText}>Add with Access</ThemedText>
              </Pressable>
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
    marginTop: 50,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
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
  headerButton: {
    fontSize: 16,
  },
  saveButton: {
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  itemPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  sharedPersonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  availablePersonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
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
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  permissionText: {
    fontSize: 12,
  },
  relationshipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  relationshipText: {
    fontSize: 12,
  },
  permissionButton: {
    padding: Spacing.xs,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  pickerModal: {
    width: "100%",
    maxWidth: 340,
    maxHeight: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  personList: {
    maxHeight: 250,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  closeButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  closeButtonText: {
    fontSize: 16,
  },
  permissionOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  permissionOptionInfo: {
    flex: 1,
  },
  permissionOptionTitle: {
    fontSize: 15,
    fontWeight: "500",
  },
  permissionOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

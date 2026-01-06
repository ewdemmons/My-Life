import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { Person, RELATIONSHIP_TYPES } from "@/types";

interface PeopleSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
}

export function PeopleSelector({
  selectedIds,
  onSelectionChange,
  label = "People",
  placeholder = "Select people...",
}: PeopleSelectorProps) {
  const { theme } = useTheme();
  const { people } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedPeople = useMemo(
    () => people.filter((p) => selectedIds.includes(p.id)),
    [people, selectedIds]
  );

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const query = searchQuery.toLowerCase();
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.relationship.toLowerCase().includes(query)
    );
  }, [people, searchQuery]);

  const togglePerson = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRelationshipInfo = (rel: string) => {
    return RELATIONSHIP_TYPES.find((r) => r.value === rel) || RELATIONSHIP_TYPES[5];
  };

  const renderPersonItem = ({ item }: { item: Person }) => {
    const isSelected = selectedIds.includes(item.id);
    const relInfo = getRelationshipInfo(item.relationship);
    const isLinked = item.linkedUserId && item.linkedConsentStatus === "approved";

    return (
      <Pressable
        style={[
          styles.personItem,
          { backgroundColor: isSelected ? theme.primary + "20" : "transparent" },
        ]}
        onPress={() => togglePerson(item.id)}
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
          <View style={styles.nameRow}>
            <ThemedText style={styles.personName}>{item.name}</ThemedText>
            {isLinked ? (
              <View style={[styles.linkedIndicator, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="link" size={8} color={theme.primary} />
              </View>
            ) : null}
          </View>
          <View style={styles.relationshipRow}>
            <Feather name={relInfo.icon as any} size={10} color={theme.textSecondary} />
            <ThemedText style={[styles.relationshipText, { color: theme.textSecondary }]}>
              {relInfo.label}
            </ThemedText>
            {isLinked ? (
              <ThemedText style={[styles.linkedText, { color: theme.primary }]}>
                Will notify
              </ThemedText>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.checkbox,
            { borderColor: isSelected ? theme.primary : theme.border },
            isSelected && { backgroundColor: theme.primary },
          ]}
        >
          {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}

      <Pressable
        style={[styles.selector, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
        onPress={() => setModalVisible(true)}
      >
        {selectedPeople.length > 0 ? (
          <View style={styles.selectedContainer}>
            <View style={styles.avatarStack}>
              {selectedPeople.slice(0, 4).map((person, index) => (
                <View key={person.id} style={[styles.stackedAvatar, { left: index * 20 }]}>
                  {person.photoUri ? (
                    <Image source={{ uri: person.photoUri }} style={styles.smallAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.smallAvatarPlaceholder, { backgroundColor: theme.primary + "30" }]}>
                      <ThemedText style={[styles.smallInitials, { color: theme.primary }]}>
                        {getInitials(person.name)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <ThemedText style={[styles.selectedCount, { marginLeft: selectedPeople.slice(0, 4).length * 20 + 10 }]}>
              {selectedPeople.length} {selectedPeople.length === 1 ? "person" : "people"}
            </ThemedText>
          </View>
        ) : (
          <ThemedText style={[styles.placeholder, { color: theme.textSecondary }]}>
            {placeholder}
          </ThemedText>
        )}
        <Feather name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable
            style={[styles.modal, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.modalTitle}>Select People</ThemedText>
              <Pressable onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="search" size={16} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {people.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="users" size={32} color={theme.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No people added yet.{"\n"}Go to the People tab to add someone.
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={filteredPeople}
                keyExtractor={(item) => item.id}
                renderItem={renderPersonItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}

            <Pressable
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
              onPress={() => setModalVisible(false)}
            >
              <ThemedText style={styles.doneButtonText}>Done</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function PeopleAvatars({
  personIds,
  maxDisplay = 3,
  size = 24,
}: {
  personIds: string[];
  maxDisplay?: number;
  size?: number;
}) {
  const { theme } = useTheme();
  const { people } = useApp();

  const selectedPeople = useMemo(
    () => people.filter((p) => personIds.includes(p.id)),
    [people, personIds]
  );

  if (selectedPeople.length === 0) return null;

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const displayPeople = selectedPeople.slice(0, maxDisplay);
  const extraCount = selectedPeople.length - maxDisplay;

  return (
    <View style={styles.avatarsContainer}>
      {displayPeople.map((person, index) => (
        <View
          key={person.id}
          style={[
            styles.avatarWrapper,
            { width: size, height: size, borderRadius: size / 2, marginLeft: index > 0 ? -size / 3 : 0 },
          ]}
        >
          {person.photoUri ? (
            <Image
              source={{ uri: person.photoUri }}
              style={{ width: size, height: size, borderRadius: size / 2 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={[
                styles.miniAvatarPlaceholder,
                { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.primary + "30" },
              ]}
            >
              <ThemedText style={[styles.miniInitials, { color: theme.primary, fontSize: size * 0.4 }]}>
                {getInitials(person.name)}
              </ThemedText>
            </View>
          )}
        </View>
      ))}
      {extraCount > 0 ? (
        <View
          style={[
            styles.extraCount,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 3, backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <ThemedText style={[styles.extraCountText, { fontSize: size * 0.35, color: theme.textSecondary }]}>
            +{extraCount}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  selector: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  placeholder: {
    fontSize: 16,
  },
  selectedContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarStack: {
    flexDirection: "row",
    position: "relative",
    height: 28,
  },
  stackedAvatar: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "white",
    borderRadius: 14,
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  smallAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  smallInitials: {
    fontSize: 10,
    fontWeight: "600",
  },
  selectedCount: {
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
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
    fontSize: 18,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  personItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: "600",
  },
  personInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  personName: {
    fontSize: 15,
    fontWeight: "500",
  },
  linkedIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  linkedText: {
    fontSize: 10,
    fontWeight: "500",
    marginLeft: 4,
  },
  relationshipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  relationshipText: {
    fontSize: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  doneButton: {
    margin: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  avatarsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    borderWidth: 1,
    borderColor: "white",
    overflow: "hidden",
  },
  miniAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  miniInitials: {
    fontWeight: "600",
  },
  extraCount: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "white",
  },
  extraCountText: {
    fontWeight: "600",
  },
});

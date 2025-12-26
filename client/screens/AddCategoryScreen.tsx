import React, { useState, useLayoutEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { HeaderButton, useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CategoryColors } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { PeopleSelector } from "@/components/PeopleSelector";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const ICONS = [
  "heart", "activity", "briefcase", "star", "dollar-sign", "book",
  "home", "users", "target", "coffee", "music", "camera",
  "globe", "sun", "moon", "zap", "award", "gift", "smile", "feather",
];

type RouteParams = RouteProp<RootStackParamList, "AddCategory">;

export default function AddCategoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { addCategory, updateCategory } = useApp();

  const editingCategory = route.params?.category;
  const isEditing = !!editingCategory;

  const [name, setName] = useState(editingCategory?.name || "");
  const [description, setDescription] = useState(editingCategory?.description || "");
  const [color, setColor] = useState(editingCategory?.color || CategoryColors[0]);
  const [icon, setIcon] = useState(editingCategory?.icon || ICONS[0]);
  const [peopleIds, setPeopleIds] = useState<string[]>(editingCategory?.peopleIds || []);

  const isValid = name.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    
    if (isEditing && editingCategory) {
      await updateCategory(editingCategory.id, {
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
        peopleIds,
      });
    } else {
      await addCategory({
        name: name.trim(),
        description: description.trim(),
        color,
        icon,
        peopleIds,
      });
    }
    navigation.goBack();
  }, [name, description, color, icon, peopleIds, isEditing, editingCategory, addCategory, updateCategory, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: isEditing ? "Edit Category" : "Add Category",
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.goBack()}>
          <ThemedText style={{ color: theme.primary }}>Cancel</ThemedText>
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton
          onPress={handleSave}
          disabled={!isValid}
        >
          <ThemedText style={{ color: isValid ? theme.primary : theme.textSecondary, fontWeight: "600" }}>
            Save
          </ThemedText>
        </HeaderButton>
      ),
    });
  }, [navigation, isEditing, isValid, theme, handleSave]);

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.section}>
        <ThemedText style={styles.label}>Name</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="e.g., Family, Health, Work"
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={setName}
          autoFocus
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Description (Optional)</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Describe this life category..."
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Color</ThemedText>
        <View style={styles.colorGrid}>
          {CategoryColors.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.colorOption,
                { backgroundColor: c },
                color === c && styles.colorSelected,
              ]}
              onPress={() => setColor(c)}
            >
              {color === c ? (
                <Feather name="check" size={20} color="#FFFFFF" />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Icon</ThemedText>
        <View style={styles.iconGrid}>
          {ICONS.map((i) => (
            <Pressable
              key={i}
              style={[
                styles.iconOption,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                icon === i && { borderColor: color, borderWidth: 2 },
              ]}
              onPress={() => setIcon(i)}
            >
              <Feather
                name={i as any}
                size={24}
                color={icon === i ? color : theme.textSecondary}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <PeopleSelector
        selectedIds={peopleIds}
        onSelectionChange={setPeopleIds}
        label="Tag People (Optional)"
        placeholder="Tag family, friends, or teammates..."
      />

      <View style={[styles.preview, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={[styles.previewLabel, { color: theme.textSecondary }]}>
          Preview
        </ThemedText>
        <View style={[styles.previewBubble, { borderColor: color }]}>
          <Feather name={icon as any} size={28} color={color} />
          <ThemedText style={styles.previewName} numberOfLines={1}>
            {name || "Category"}
          </ThemedText>
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  input: {
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  previewLabel: {
    fontSize: 12,
    marginBottom: Spacing.md,
  },
  previewBubble: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xs,
  },
  previewName: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: Spacing.xs,
    textAlign: "center",
  },
});

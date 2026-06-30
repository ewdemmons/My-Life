import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { AssessmentQAPair, LifeAreaProfile } from "@/types";

type LifeAreaProfileFormProps = {
  profile: Partial<LifeAreaProfile>;
  onChange: (updates: Partial<LifeAreaProfile>) => void;
  readOnly?: boolean;
  accentColor?: string;
};

function ChipEditor({
  label,
  values,
  onChange,
  readOnly,
  accentColor,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  readOnly?: boolean;
  accentColor: string;
  placeholder: string;
}) {
  const { theme } = useTheme();
  const [input, setInput] = useState("");

  const addChip = () => {
    const trimmed = input.trim();
    if (!trimmed || values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInput("");
  };

  const removeChip = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.fieldBlock}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <View style={styles.chipWrap}>
        {values.map((value, index) => (
          <View key={`${value}-${index}`} style={[styles.chip, { backgroundColor: accentColor }]}>
            <ThemedText style={styles.chipText}>{value}</ThemedText>
            {!readOnly ? (
              <Pressable onPress={() => removeChip(index)} hitSlop={8}>
                <Feather name="x" size={14} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
      {!readOnly ? (
        <View style={styles.chipInputRow}>
          <TextInput
            style={[
              styles.input,
              styles.chipInput,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text },
            ]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={addChip}
            returnKeyType="done"
          />
          <Pressable
            onPress={addChip}
            style={[styles.addChipBtn, { backgroundColor: accentColor }]}
          >
            <Feather name="plus" size={16} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function LifeAreaProfileForm({
  profile,
  onChange,
  readOnly = false,
  accentColor,
}: LifeAreaProfileFormProps) {
  const { theme } = useTheme();
  const color = accentColor ?? theme.primary;

  const updateField = <K extends keyof LifeAreaProfile>(key: K, value: LifeAreaProfile[K]) => {
    onChange({ [key]: value });
  };

  const rawAnswers = profile.rawAnswers ?? [];

  const updateRawAnswer = (index: number, field: keyof AssessmentQAPair, value: string) => {
    const next = rawAnswers.map((pair, i) =>
      i === index ? { ...pair, [field]: value } : pair,
    );
    updateField("rawAnswers", next);
  };

  return (
    <View style={styles.container}>
      <View style={styles.fieldBlock}>
        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Primary Goal</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text },
          ]}
          value={profile.primaryGoal ?? ""}
          onChangeText={(text) => updateField("primaryGoal", text)}
          placeholder="What are you working toward in this Life Area?"
          placeholderTextColor={theme.textSecondary}
          multiline
          editable={!readOnly}
        />
      </View>

      <ChipEditor
        label="Current Focus"
        values={profile.currentFocus ?? []}
        onChange={(values) => updateField("currentFocus", values)}
        readOnly={readOnly}
        accentColor={color}
        placeholder="Add a focus area..."
      />

      <ChipEditor
        label="Known Obstacles"
        values={profile.knownObstacles ?? []}
        onChange={(values) => updateField("knownObstacles", values)}
        readOnly={readOnly}
        accentColor={color}
        placeholder="Add an obstacle..."
      />

      <View style={styles.fieldBlock}>
        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Current State</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text },
          ]}
          value={profile.currentState ?? ""}
          onChangeText={(text) => updateField("currentState", text)}
          placeholder="Where are you now?"
          placeholderTextColor={theme.textSecondary}
          multiline
          editable={!readOnly}
        />
      </View>

      <View style={styles.fieldBlock}>
        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Motivations</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text },
          ]}
          value={profile.motivations ?? ""}
          onChangeText={(text) => updateField("motivations", text)}
          placeholder="Why does this Life Area matter to you?"
          placeholderTextColor={theme.textSecondary}
          multiline
          editable={!readOnly}
        />
      </View>

      <View style={styles.fieldBlock}>
        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Success Criteria</ThemedText>
        <TextInput
          style={[
            styles.input,
            styles.multiline,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text },
          ]}
          value={profile.successCriteria ?? ""}
          onChangeText={(text) => updateField("successCriteria", text)}
          placeholder="What does success look like?"
          placeholderTextColor={theme.textSecondary}
          multiline
          editable={!readOnly}
        />
      </View>

      {rawAnswers.length > 0 ? (
        <View style={styles.fieldBlock}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Assessment Answers</ThemedText>
          {rawAnswers.map((pair, index) => (
            <View
              key={`qa-${index}`}
              style={[styles.qaCard, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
            >
              <ThemedText style={[styles.qaIndex, { color: theme.textSecondary }]}>
                Question {index + 1}
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.multiline,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text },
                ]}
                value={pair.question}
                onChangeText={(text) => updateRawAnswer(index, "question", text)}
                multiline
                editable={!readOnly}
              />
              <ThemedText style={[styles.qaIndex, { color: theme.textSecondary }]}>Your answer</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.multiline,
                  { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text },
                ]}
                value={pair.answer}
                onChangeText={(text) => updateRawAnswer(index, "answer", text)}
                multiline
                editable={!readOnly}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
  },
  fieldBlock: {
    gap: Spacing.sm,
  },
  fieldLabel: {
    ...Typography.caption,
    fontWeight: "600",
  },
  sectionTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  chipText: {
    ...Typography.caption,
    color: "#fff",
  },
  chipInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  chipInput: {
    flex: 1,
    minHeight: Spacing.inputHeight,
  },
  addChipBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  qaCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  qaIndex: {
    ...Typography.caption,
  },
});

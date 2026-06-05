import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import NoteEditorModal from "@/components/NoteEditorModal";
import { useTheme } from "@/hooks/useTheme";
import {
  NOTE_ACCENT,
  parseMarkdownPreview,
  InlineSegment,
  PreviewBlock,
} from "@/utils/noteMarkdown";

export interface MarkdownPreviewProps {
  value: string;
  placeholder?: string;
  maxLines?: number;
  onChange: (text: string) => void;
  editorTitle?: string;
}

const LINE_HEIGHT = 20;
const EDIT_ICON = "✎";

function renderInlineSegments(
  segments: InlineSegment[],
  theme: { text: string },
): React.ReactNode[] {
  return segments.map((seg, i) => {
    if (seg.type === "bold") {
      return (
        <Text key={i} style={{ fontWeight: "700", color: theme.text }}>
          {seg.text}
        </Text>
      );
    }
    if (seg.type === "italic") {
      return (
        <Text key={i} style={{ fontStyle: "italic", color: theme.text }}>
          {seg.text}
        </Text>
      );
    }
    return (
      <Text
        key={i}
        style={{ fontSize: 13, color: theme.text, lineHeight: LINE_HEIGHT }}
      >
        {seg.text}
      </Text>
    );
  });
}

function renderBlock(
  block: PreviewBlock,
  index: number,
  theme: { text: string },
): React.ReactNode {
  switch (block.type) {
    case "divider":
      return (
        <View
          key={index}
          style={[styles.divider, { borderBottomColor: theme.text + "33" }]}
        />
      );
    case "heading":
      return (
        <Text
          key={index}
          style={[
            styles.heading,
            { color: theme.text },
          ]}
        >
          {renderInlineSegments(block.segments, theme)}
        </Text>
      );
    case "bullet":
      return (
        <View key={index} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletContent}>
            {renderInlineSegments(block.segments, theme)}
          </Text>
        </View>
      );
    case "numbered":
      return (
        <View key={index} style={styles.bulletRow}>
          <Text style={[styles.numberPrefix, { color: theme.text }]}>
            {block.number}.{" "}
          </Text>
          <Text style={styles.bulletContent}>
            {renderInlineSegments(block.segments, theme)}
          </Text>
        </View>
      );
    default:
      return (
        <Text key={index} style={[styles.paragraph, { color: theme.text }]}>
          {renderInlineSegments(block.segments, theme)}
        </Text>
      );
  }
}

function MarkdownPreview({
  value,
  placeholder = "Add notes...",
  maxLines = 4,
  onChange,
  editorTitle,
}: MarkdownPreviewProps) {
  const { theme } = useTheme();
  const [editorVisible, setEditorVisible] = useState(false);

  const hasContent = value.trim().length > 0;
  const maxHeight = maxLines * LINE_HEIGHT;
  const blocks = hasContent ? parseMarkdownPreview(value) : [];
  const showFade = useMemo(() => {
    if (!hasContent) return false;
    const lineCount = value.split("\n").length;
    return blocks.length > maxLines || lineCount > maxLines;
  }, [hasContent, value, blocks.length, maxLines]);

  const handleConfirm = useCallback(
    (text: string) => {
      onChange(text);
      setEditorVisible(false);
    },
    [onChange],
  );

  const handleCancel = useCallback(() => {
    setEditorVisible(false);
  }, []);

  return (
    <>
      <Pressable
        onPress={() => setEditorVisible(true)}
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
          },
        ]}
      >
        {!hasContent ? (
          <Text style={[styles.placeholder, { color: theme.textSecondary }]}>
            {placeholder}
          </Text>
        ) : (
          <View style={styles.contentWrapper}>
            <View style={[styles.contentClip, { maxHeight }]}>
              {blocks.map((block, i) => renderBlock(block, i, theme))}
            </View>
            {showFade && (
              <LinearGradient
                colors={["transparent", theme.backgroundDefault]}
                style={styles.fadeGradient}
                pointerEvents="none"
              />
            )}
          </View>
        )}
        <Text style={[styles.editIcon, { color: theme.textSecondary }]}>
          {EDIT_ICON}
        </Text>
      </Pressable>

      <NoteEditorModal
        visible={editorVisible}
        value={value}
        title={editorTitle}
        placeholder={placeholder}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

export default MarkdownPreview;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 60,
    position: "relative",
  },
  placeholder: {
    fontSize: 13,
    fontStyle: "italic",
  },
  contentWrapper: {
    position: "relative",
    paddingRight: 16,
  },
  contentClip: {
    overflow: "hidden",
  },
  paragraph: {
    fontSize: 13,
    lineHeight: LINE_HEIGHT,
    marginBottom: 2,
  },
  heading: {
    fontWeight: "700",
    fontSize: 15,
    lineHeight: LINE_HEIGHT,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  bulletDot: {
    color: NOTE_ACCENT,
    fontSize: 13,
    lineHeight: LINE_HEIGHT,
    marginRight: 6,
    width: 12,
  },
  bulletContent: {
    flex: 1,
    fontSize: 13,
    lineHeight: LINE_HEIGHT,
  },
  numberPrefix: {
    fontSize: 13,
    lineHeight: LINE_HEIGHT,
    marginRight: 2,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 6,
    height: 1,
  },
  fadeGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
  },
  editIcon: {
    position: "absolute",
    right: 10,
    bottom: 8,
    fontSize: 12,
  },
});

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BriefToast } from "@/components/BriefToast";
import { useTheme } from "@/hooks/useTheme";
import {
  NOTE_ACCENT,
  NOTE_ACCENT_BG,
  NOTE_TOOLBAR_BG,
  TextSelection,
  ActiveFormats,
  formatCharacterCount,
  getActiveFormats,
  wrapWithMarkers,
  toggleLinePrefix,
  insertNumberedPrefix,
  insertAtCursor,
  stripAllFormatting,
} from "@/utils/noteMarkdown";

export interface NoteEditorModalProps {
  visible: boolean;
  value: string;
  title?: string;
  placeholder?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

type ToolbarAction =
  | "bold"
  | "italic"
  | "bullet"
  | "numbered"
  | "divider"
  | "heading"
  | "clear";

const TOOLBAR_ITEMS: { action: ToolbarAction; label: string }[] = [
  { action: "bold", label: "B" },
  { action: "italic", label: "I" },
  { action: "bullet", label: "•≡" },
  { action: "numbered", label: "1.≡" },
  { action: "divider", label: "——" },
  { action: "heading", label: "H" },
];

function NoteEditorModal({
  visible,
  value,
  title = "Note",
  placeholder = "Add notes...",
  onConfirm,
  onCancel,
}: NoteEditorModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [draft, setDraft] = useState(value);
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    bullet: false,
    numbered: false,
    heading: false,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").height),
  ).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateActiveFormats = useCallback((text: string, sel: TextSelection) => {
    setActiveFormats(getActiveFormats(text, sel));
  }, []);

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setSelection({ start: value.length, end: value.length });
      updateActiveFormats(value, { start: value.length, end: value.length });
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(Dimensions.get("window").height);
    }
  }, [visible, value, slideAnim, updateActiveFormats]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      setToastMessage(null);
    }, 2000);
  }, []);

  const applyEdit = useCallback(
    (result: { text: string; selection: TextSelection }) => {
      setDraft(result.text);
      setSelection(result.selection);
      updateActiveFormats(result.text, result.selection);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [updateActiveFormats],
  );

  const handleToolbarPress = useCallback(
    (action: ToolbarAction) => {
      let result: { text: string; selection: TextSelection };

      switch (action) {
        case "bold":
          result = wrapWithMarkers(draft, selection, "**", "**");
          break;
        case "italic":
          result = wrapWithMarkers(draft, selection, "_", "_");
          break;
        case "bullet":
          result = toggleLinePrefix(draft, selection, "• ");
          break;
        case "numbered":
          result = insertNumberedPrefix(draft, selection);
          break;
        case "divider":
          result = insertAtCursor(draft, selection, "\n---\n");
          break;
        case "heading":
          result = toggleLinePrefix(draft, selection, "## ");
          break;
        case "clear": {
          const stripped = stripAllFormatting(draft);
          result = {
            text: stripped,
            selection: { start: stripped.length, end: stripped.length },
          };
          showToast("Formatting cleared");
          break;
        }
        default:
          return;
      }

      applyEdit(result);
    },
    [draft, selection, applyEdit, showToast],
  );

  const isToolbarActive = (action: ToolbarAction): boolean => {
    switch (action) {
      case "bold":
        return activeFormats.bold;
      case "italic":
        return activeFormats.italic;
      case "bullet":
        return activeFormats.bullet;
      case "numbered":
        return activeFormats.numbered;
      case "heading":
        return activeFormats.heading;
      default:
        return false;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onCancel}
    >
      <Animated.View
        style={[
          styles.fullScreen,
          {
            backgroundColor: theme.backgroundRoot,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top,
              borderBottomColor: theme.border,
              backgroundColor: theme.backgroundRoot,
            },
          ]}
        >
          <Pressable onPress={onCancel} hitSlop={8} style={styles.headerSide}>
            <Text style={styles.headerAction}>‹ Back</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
          <Pressable
            onPress={() => onConfirm(draft)}
            hitSlop={8}
            style={styles.headerSide}
          >
            <Text style={[styles.headerAction, styles.headerDone]}>Done</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                { color: theme.text },
              ]}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                updateActiveFormats(text, selection);
              }}
              onSelectionChange={(e) => {
                const sel = e.nativeEvent.selection;
                setSelection(sel);
                updateActiveFormats(draft, sel);
              }}
              selection={selection}
              multiline
              autoFocus
              scrollEnabled={false}
              placeholder={placeholder}
              placeholderTextColor={theme.textSecondary}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: theme.textSecondary }]}>
              {formatCharacterCount(draft.length)}
            </Text>
          </ScrollView>

          <View
            style={[
              styles.toolbar,
              {
                backgroundColor: NOTE_TOOLBAR_BG,
                borderTopColor: theme.border,
                paddingBottom: Math.max(insets.bottom, 8),
              },
            ]}
          >
            {TOOLBAR_ITEMS.map((item) => {
              const active = isToolbarActive(item.action);
              return (
                <Pressable
                  key={item.action}
                  onPress={() => handleToolbarPress(item.action)}
                  style={[
                    styles.toolbarButton,
                    active && styles.toolbarButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.toolbarButtonText,
                      { color: theme.textSecondary },
                      active && styles.toolbarButtonTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            <Pressable
              onPress={() => handleToolbarPress("clear")}
              style={styles.toolbarButton}
            >
              <Text
                style={[styles.toolbarButtonText, { color: theme.textSecondary }]}
              >
                Aa
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        <BriefToast message={toastMessage} visible={toastVisible} />
      </Animated.View>
    </Modal>
  );
}

export default NoteEditorModal;

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  headerSide: {
    minWidth: 64,
  },
  headerAction: {
    color: NOTE_ACCENT,
    fontSize: 16,
  },
  headerDone: {
    fontWeight: "700",
    textAlign: "right",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  textInput: {
    width: "100%",
    minHeight: 400,
    fontSize: 15,
    lineHeight: 24,
    padding: 16,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    gap: 4,
  },
  toolbarButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarButtonActive: {
    backgroundColor: NOTE_ACCENT_BG,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  toolbarButtonTextActive: {
    color: NOTE_ACCENT,
  },
  separator: {
    width: 1,
    height: 24,
    marginHorizontal: 4,
  },
});

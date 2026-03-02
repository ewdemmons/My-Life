import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { redeemInviteCode } from "@/lib/pendingInvites";

interface InviteCodeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteCodeModal({
  visible,
  onClose,
  onSuccess,
}: InviteCodeModalProps) {
  const { theme } = useTheme();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (code.trim().length === 0) {
      setError("Please enter an invite code");
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await redeemInviteCode(code);

    setIsLoading(false);

    if (result.success) {
      Alert.alert(
        "Success",
        `You now have access to "${result.bubbleName}"${result.senderName ? ` shared by ${result.senderName}` : ""}.`,
        [
          {
            text: "OK",
            onPress: () => {
              setCode("");
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } else {
      setError(result.error || "Invalid or expired invite code");
    }
  };

  const handleClose = () => {
    setCode("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.modal, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Enter Invite Code</ThemedText>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
            Enter the 8-character code from your invitation to access a Shared Life Area.
          </ThemedText>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: error ? theme.error : theme.border,
              },
            ]}
            value={code}
            onChangeText={(text) => {
              setCode(text.toUpperCase());
              setError(null);
            }}
            placeholder="e.g. 6LQANQGE"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            editable={!isLoading}
          />

          {error ? (
            <ThemedText style={[styles.errorText, { color: theme.error }]}>
              {error}
            </ThemedText>
          ) : null}

          <Pressable
            style={[
              styles.submitButton,
              {
                backgroundColor: theme.primary,
                opacity: isLoading || code.trim().length === 0 ? 0.6 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={isLoading || code.trim().length === 0}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.submitText}>Redeem Code</ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modal: {
    width: "85%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.h2.fontSize,
    fontWeight: "600",
  },
  description: {
    fontSize: Typography.caption.fontSize,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  input: {
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.h2.fontSize,
    fontWeight: "600",
    letterSpacing: 4,
    textAlign: "center",
  },
  errorText: {
    fontSize: Typography.caption.fontSize,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  submitButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  submitText: {
    color: "#fff",
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
});

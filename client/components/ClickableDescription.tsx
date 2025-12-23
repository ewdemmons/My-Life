import React, { useMemo, useCallback } from "react";
import { Text, Linking, Alert, StyleSheet, TextStyle, StyleProp } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface ClickableDescriptionProps {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;

export function ClickableDescription({ text, style, numberOfLines }: ClickableDescriptionProps) {
  const { theme } = useTheme();

  const handleLinkPress = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Cannot Open Link", `Unable to open: ${url}`);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open the link");
    }
  }, []);

  const parts = useMemo(() => {
    if (!text) return [];
    
    const result: { text: string; isLink: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    const regex = new RegExp(URL_REGEX.source, "gi");
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index), isLink: false });
      }
      result.push({ text: match[0], isLink: true });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), isLink: false });
    }
    
    return result;
  }, [text]);

  if (!text) return null;

  if (parts.length === 0) {
    return (
      <Text style={[styles.text, { color: theme.textSecondary }, style]} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={[styles.text, { color: theme.textSecondary }, style]} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.isLink ? (
          <Text
            key={index}
            style={[styles.link, { color: theme.primary }]}
            onPress={() => handleLinkPress(part.text)}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={index}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    textDecorationLine: "underline",
  },
});

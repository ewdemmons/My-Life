import React from "react";
import { Text } from "react-native";
import { Feather } from "@expo/vector-icons";

export function isEmoji(icon: string): boolean {
  if (!icon) return false;
  // Feather icon names are lowercase letters and hyphens only
  // Anything else is treated as emoji
  return !/^[a-z-]+$/.test(icon);
}

export function renderIcon(
  icon: string,
  size: number,
  color: string,
): React.ReactElement {
  if (isEmoji(icon)) {
    return (
      <Text style={{ fontSize: size, lineHeight: size * 1.2 }}>
        {icon}
      </Text>
    );
  }
  return (
    <Feather
      name={icon as keyof typeof Feather.glyphMap}
      size={size}
      color={color}
    />
  );
}

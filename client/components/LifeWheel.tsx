import React from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { LifeCategory } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface LifeWheelProps {
  categories: LifeCategory[];
  onCategoryPress: (category: LifeCategory) => void;
  onCategoryLongPress: (category: LifeCategory) => void;
}

const { width: screenWidth } = Dimensions.get("window");
const WHEEL_SIZE = Math.min(screenWidth - Spacing.lg * 2, 340);
const CENTER_SIZE = 60;
const BUBBLE_SIZE = 70;

export function LifeWheel({ categories, onCategoryPress, onCategoryLongPress }: LifeWheelProps) {
  const { theme, isDark } = useTheme();
  const centerRadius = WHEEL_SIZE / 2;

  const getBubblePosition = (index: number, total: number) => {
    const angleStep = (2 * Math.PI) / Math.max(total, 1);
    const angle = angleStep * index - Math.PI / 2;
    const radius = centerRadius - BUBBLE_SIZE / 2 - 20;
    return {
      x: centerRadius + radius * Math.cos(angle) - BUBBLE_SIZE / 2,
      y: centerRadius + radius * Math.sin(angle) - BUBBLE_SIZE / 2,
    };
  };

  return (
    <View style={[styles.container, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
      <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} style={StyleSheet.absoluteFill}>
        <Circle
          cx={centerRadius}
          cy={centerRadius}
          r={centerRadius - 10}
          stroke={theme.border}
          strokeWidth={1}
          fill="none"
          strokeDasharray="4,4"
        />
        {categories.map((_, index) => {
          const pos = getBubblePosition(index, categories.length);
          return (
            <Line
              key={index}
              x1={centerRadius}
              y1={centerRadius}
              x2={pos.x + BUBBLE_SIZE / 2}
              y2={pos.y + BUBBLE_SIZE / 2}
              stroke={theme.border}
              strokeWidth={1}
              strokeDasharray="2,4"
            />
          );
        })}
      </Svg>

      <View style={[styles.center, { backgroundColor: theme.primary }]}>
        <Feather name="target" size={28} color="#FFFFFF" />
      </View>

      {categories.map((category, index) => {
        const pos = getBubblePosition(index, categories.length);
        return (
          <CategoryBubble
            key={category.id}
            category={category}
            position={pos}
            onPress={() => onCategoryPress(category)}
            onLongPress={() => onCategoryLongPress(category)}
          />
        );
      })}
    </View>
  );
}

interface CategoryBubbleProps {
  category: LifeCategory;
  position: { x: number; y: number };
  onPress: () => void;
  onLongPress: () => void;
}

function CategoryBubble({ category, position, onPress, onLongPress }: CategoryBubbleProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      style={[
        styles.bubble,
        animatedStyle,
        {
          left: position.x,
          top: position.y,
          backgroundColor: theme.backgroundDefault,
          borderColor: category.color,
        },
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Feather
        name={category.icon as any}
        size={24}
        color={category.color}
      />
      <ThemedText
        style={styles.bubbleText}
        numberOfLines={1}
      >
        {category.name}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    position: "relative",
  },
  center: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    marginTop: -CENTER_SIZE / 2,
    marginLeft: -CENTER_SIZE / 2,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    position: "absolute",
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xs,
  },
  bubbleText: {
    fontSize: 9,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 2,
  },
});

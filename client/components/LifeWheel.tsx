import React from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import Svg, { Circle, Line, Defs, RadialGradient, Stop } from "react-native-svg";
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
  enlarged?: boolean;
  onCenterPress?: () => void;
}

const { width: screenWidth } = Dimensions.get("window");
const BASE_WHEEL_SIZE = Math.min(screenWidth - Spacing.lg * 2, 340);
const BASE_CENTER_SIZE = 60;
const BASE_BUBBLE_SIZE = 70;

export function LifeWheel({ 
  categories, 
  onCategoryPress, 
  onCategoryLongPress,
  enlarged = false,
  onCenterPress,
}: LifeWheelProps) {
  const { theme } = useTheme();
  
  const scale = enlarged ? 1.1 : 1;
  const WHEEL_SIZE = BASE_WHEEL_SIZE * scale;
  const CENTER_SIZE = BASE_CENTER_SIZE * scale;
  const BUBBLE_SIZE = BASE_BUBBLE_SIZE * scale;
  
  const centerRadius = WHEEL_SIZE / 2;

  const getBubblePosition = (index: number, total: number) => {
    const angleStep = (2 * Math.PI) / Math.max(total, 1);
    const angle = angleStep * index - Math.PI / 2;
    const radius = centerRadius - BUBBLE_SIZE / 2 - 20 * scale;
    return {
      x: centerRadius + radius * Math.cos(angle) - BUBBLE_SIZE / 2,
      y: centerRadius + radius * Math.sin(angle) - BUBBLE_SIZE / 2,
    };
  };

  return (
    <View style={[styles.container, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
      <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={theme.primary} stopOpacity="1" />
            <Stop offset="70%" stopColor={theme.primary} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={theme.primary} stopOpacity="0.4" />
          </RadialGradient>
        </Defs>
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
        <Circle
          cx={centerRadius}
          cy={centerRadius}
          r={CENTER_SIZE / 2 + 8}
          fill="url(#centerGlow)"
          opacity={0.3}
        />
      </Svg>

      <Pressable 
        style={[
          styles.center, 
          { 
            backgroundColor: theme.primary,
            width: CENTER_SIZE,
            height: CENTER_SIZE,
            marginTop: -CENTER_SIZE / 2,
            marginLeft: -CENTER_SIZE / 2,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 8,
          }
        ]}
        onPress={onCenterPress}
      >
        <Feather name="target" size={28 * scale} color="#FFFFFF" />
      </Pressable>

      {categories.map((category, index) => {
        const pos = getBubblePosition(index, categories.length);
        return (
          <CategoryBubble
            key={category.id}
            category={category}
            position={pos}
            bubbleSize={BUBBLE_SIZE}
            scale={scale}
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
  bubbleSize: number;
  scale: number;
  onPress: () => void;
  onLongPress: () => void;
}

function CategoryBubble({ category, position, bubbleSize, scale, onPress, onLongPress }: CategoryBubbleProps) {
  const { theme } = useTheme();
  const animScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animScale.value }],
  }));

  const handlePressIn = () => {
    animScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    animScale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      style={[
        styles.bubble,
        animatedStyle,
        {
          left: position.x,
          top: position.y,
          width: bubbleSize,
          height: bubbleSize,
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
        size={24 * scale}
        color={category.color}
      />
      <ThemedText
        style={[styles.bubbleText, { fontSize: 9 * scale }]}
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
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    position: "absolute",
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xs,
  },
  bubbleText: {
    fontWeight: "500",
    textAlign: "center",
    marginTop: 2,
  },
});

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  NativeSyntheticEvent,
  TextLayoutEventData,
  LayoutChangeEvent,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import ReanimatedAnimated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { LifeCategory } from "@/types";

const AnimatedPressable = ReanimatedAnimated.createAnimatedComponent(Pressable);

interface LifeWheelProps {
  categories: LifeCategory[];
  onCategoryPress: (category: LifeCategory) => void;
  onCategoryLongPress: (category: LifeCategory) => void;
  enlarged?: boolean;
  onCenterPress?: () => void;
}

const REFERENCE_WHEEL_SIZE = 399;
const BASE_CENTER_SIZE = 60;
const BUBBLE_BORDER_WIDTH = 2.75;
const MIN_LABEL_FONT_SIZE = 7;
const ORBIT_RADIUS_RATIO = 0.38;
const WHEEL_EDGE_INSET = 8;

function getTargetBubbleDiameter(totalCategories: number): number {
  if (totalCategories <= 4) return 96;
  if (totalCategories <= 6) return 88;
  if (totalCategories <= 8) return 80;
  if (totalCategories <= 10) return 72;
  return 64;
}

function getBubbleSizeForOrbit(categoryCount: number, orbitRadius: number): number {
  const baseSize = getTargetBubbleDiameter(Math.max(categoryCount, 1));
  if (categoryCount <= 1) {
    return baseSize;
  }

  const angleStep = (2 * Math.PI) / categoryCount;
  const chordAtOrbit = 2 * orbitRadius * Math.sin(angleStep / 2);
  const proximitySize = chordAtOrbit - 4;

  if (proximitySize > baseSize) {
    return Math.min(proximitySize, baseSize * 1.25);
  }
  return baseSize;
}

function splitBubbleLabelAtWords(name: string, maxLines = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  if (words.length === 2) return words.join("\n");
  const lines: string[] = [];
  let wordIndex = 0;
  for (let line = 0; line < maxLines && wordIndex < words.length; line++) {
    const linesLeft = maxLines - line;
    const wordsLeft = words.length - wordIndex;
    const wordsOnLine = Math.ceil(wordsLeft / linesLeft);
    lines.push(words.slice(wordIndex, wordIndex + wordsOnLine).join(" "));
    wordIndex += wordsOnLine;
  }
  return lines.join("\n");
}

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return hex;
  }
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function LifeWheel({
  categories,
  onCategoryPress,
  onCategoryLongPress,
  enlarged = false,
  onCenterPress,
}: LifeWheelProps) {
  const { theme } = useTheme();
  const centerPulse = useRef(new Animated.Value(1)).current;
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const scale = enlarged ? 1.05 : 1;

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setContainerSize({ width, height });
    }
  };

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(centerPulse, {
          toValue: 1.06,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(centerPulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [centerPulse]);

  const smallerDim = Math.min(containerSize.width, containerSize.height);
  if (smallerDim < 50) {
    return <View style={styles.fillContainer} onLayout={handleContainerLayout} />;
  }

  const WHEEL_SIZE = smallerDim * scale;
  const wheelRadius = WHEEL_SIZE / 2;
  const centerRadius = wheelRadius;
  const categoryCount = categories.length;
  const orbitRadiusTarget = smallerDim * ORBIT_RADIUS_RATIO * scale;
  const centerSizeRatio = BASE_CENTER_SIZE / REFERENCE_WHEEL_SIZE;
  const CENTER_SIZE = Math.max(44, WHEEL_SIZE * centerSizeRatio);
  const BUBBLE_SIZE = getBubbleSizeForOrbit(categoryCount, orbitRadiusTarget);

  const minOrbitRadius = CENTER_SIZE / 2 + BUBBLE_SIZE / 2 + WHEEL_EDGE_INSET;
  const maxOrbitRadius = wheelRadius - BUBBLE_SIZE / 2 - WHEEL_EDGE_INSET;
  const safeOrbitRadius = Math.max(
    minOrbitRadius,
    Math.min(maxOrbitRadius, orbitRadiusTarget),
  );

  const getBubblePosition = (index: number, total: number) => {
    const angleStep = (2 * Math.PI) / Math.max(total, 1);
    const angle = angleStep * index - Math.PI / 2;
    return {
      x: centerRadius + safeOrbitRadius * Math.cos(angle) - BUBBLE_SIZE / 2,
      y: centerRadius + safeOrbitRadius * Math.sin(angle) - BUBBLE_SIZE / 2,
    };
  };

  const centerIconSize = Math.max(20, Math.round(28 * (WHEEL_SIZE / REFERENCE_WHEEL_SIZE)));

  return (
    <View style={styles.fillContainer} onLayout={handleContainerLayout}>
      <View style={[styles.container, { width: WHEEL_SIZE, height: WHEEL_SIZE }]}>
        <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={theme.primary} stopOpacity="1" />
              <Stop offset="70%" stopColor={theme.primary} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={theme.primary} stopOpacity="0.4" />
            </RadialGradient>
            {categories.map((category, index) => {
              const pos = getBubblePosition(index, categories.length);
              const bubbleCenterX = pos.x + BUBBLE_SIZE / 2;
              const bubbleCenterY = pos.y + BUBBLE_SIZE / 2;
              return (
                <LinearGradient
                  key={`spoke-gradient-${category.id}`}
                  id={`spoke-gradient-${category.id}`}
                  x1={bubbleCenterX}
                  y1={bubbleCenterY}
                  x2={centerRadius}
                  y2={centerRadius}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%" stopColor={category.color} stopOpacity={0.8} />
                  <Stop offset="100%" stopColor={theme.buttonText} stopOpacity={0.08} />
                </LinearGradient>
              );
            })}
          </Defs>
          {categories.map((category, index) => {
            const pos = getBubblePosition(index, categories.length);
            return (
              <Line
                key={`spoke-${category.id}`}
                x1={centerRadius}
                y1={centerRadius}
                x2={pos.x + BUBBLE_SIZE / 2}
                y2={pos.y + BUBBLE_SIZE / 2}
                stroke={`url(#spoke-gradient-${category.id})`}
                strokeOpacity={0.6}
                strokeWidth={1.5}
              />
            );
          })}
          <Circle
            cx={centerRadius}
            cy={centerRadius}
            r={CENTER_SIZE / 2 + 8 * (WHEEL_SIZE / REFERENCE_WHEEL_SIZE)}
            fill="url(#centerGlow)"
            opacity={0.3}
          />
        </Svg>

        <Animated.View
          style={[
            styles.centerPulseWrapper,
            {
              width: CENTER_SIZE,
              height: CENTER_SIZE,
              marginTop: -CENTER_SIZE / 2,
              marginLeft: -CENTER_SIZE / 2,
              transform: [{ scale: centerPulse }],
            },
          ]}
        >
          <Pressable
            style={[
              styles.center,
              {
                backgroundColor: theme.primary,
                width: CENTER_SIZE,
                height: CENTER_SIZE,
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 12,
                elevation: 8,
              },
            ]}
            onPress={onCenterPress}
          >
            <Feather name="target" size={centerIconSize} color={theme.buttonText} />
          </Pressable>
        </Animated.View>

        {categories.map((category, index) => {
          const pos = getBubblePosition(index, categories.length);
          return (
            <CategoryBubble
              key={category.id}
              category={category}
              position={pos}
              bubbleSize={BUBBLE_SIZE}
              wheelScale={WHEEL_SIZE / REFERENCE_WHEEL_SIZE}
              onPress={() => onCategoryPress(category)}
              onLongPress={() => onCategoryLongPress(category)}
            />
          );
        })}
      </View>
    </View>
  );
}

interface CategoryBubbleProps {
  category: LifeCategory;
  position: { x: number; y: number };
  bubbleSize: number;
  wheelScale: number;
  onPress: () => void;
  onLongPress: () => void;
}

function CategoryBubble({
  category,
  position,
  bubbleSize,
  wheelScale,
  onPress,
  onLongPress,
}: CategoryBubbleProps) {
  const { theme } = useTheme();
  const animScale = useSharedValue(1);
  const baseLabelSize = Math.round(11 * wheelScale);
  const [labelFontSize, setLabelFontSize] = useState(baseLabelSize);
  const prevNameRef = useRef(category.name);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animScale.value }],
  }));

  const handlePressIn = () => {
    animScale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    animScale.value = withSpring(1);
  };

  if (prevNameRef.current !== category.name) {
    prevNameRef.current = category.name;
    if (labelFontSize !== baseLabelSize) {
      setLabelFontSize(baseLabelSize);
    }
  }

  const iconSize = Math.max(14, Math.round(bubbleSize * 0.24));
  const bubbleContentSize = bubbleSize - BUBBLE_BORDER_WIDTH * 2;
  const textWidth = Math.max(bubbleSize * 0.8, bubbleContentSize * 0.8);
  const labelText = splitBubbleLabelAtWords(category.name);

  const handleLabelLayout = (
    event: NativeSyntheticEvent<TextLayoutEventData>,
  ) => {
    const lines = event?.nativeEvent?.lines as Array<{ width: number }> | undefined;
    if (!lines || lines.length === 0) return;
    const hasOverflow = lines.length > 2 || lines.some((line) => line.width > textWidth + 1);
    if (hasOverflow && labelFontSize > MIN_LABEL_FONT_SIZE) {
      setLabelFontSize((prev) => Math.max(MIN_LABEL_FONT_SIZE, prev - 0.5));
    }
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
          borderWidth: BUBBLE_BORDER_WIDTH,
          shadowColor: category.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 4,
        },
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {category.isShared ? (
        <View
          style={[
            styles.sharedBadge,
            {
              backgroundColor: "rgba(18,18,28,0.72)",
              borderColor: colorWithAlpha(category.color, 0.9),
            },
          ]}
        >
          <Feather name="users" size={10} color={theme.buttonText} />
        </View>
      ) : null}
      <View style={styles.bubbleContent}>
        <View
          style={[
            styles.bubbleInnerGlow,
            {
              backgroundColor: colorWithAlpha(category.color, 0.18),
              borderColor: colorWithAlpha(category.color, 0.25),
            },
          ]}
          pointerEvents="none"
        />
        <Feather
          name={category.icon as keyof typeof Feather.glyphMap}
          size={iconSize}
          color={category.color}
        />
        <ThemedText
          style={[
            styles.bubbleText,
            {
              fontSize: labelFontSize,
              width: textWidth,
              textAlign: "center",
            },
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
          lineBreakMode="tail"
          onTextLayout={handleLabelLayout}
        >
          {labelText}
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fillContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    position: "relative",
  },
  centerPulseWrapper: {
    position: "absolute",
    top: "50%",
    left: "50%",
  },
  center: {
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    position: "absolute",
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  bubbleContent: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xs,
    paddingTop: 4,
    paddingBottom: 2,
    overflow: "hidden",
  },
  bubbleInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  bubbleText: {
    fontWeight: "500",
    textAlign: "center",
    marginTop: 2,
    lineHeight: 12,
  },
  sharedBadge: {
    position: "absolute",
    top: 6,
    alignSelf: "center",
    left: "50%",
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    elevation: 6,
  },
});

import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Habit, Occurrence } from "@/types";

interface HabitProgressChartProps {
  habit: Habit;
  occurrences: Occurrence[];
  viewMode: "week" | "month" | "year";
  onBarPress?: (dateKey: string, count: number) => void;
}

export function HabitProgressChart({
  habit,
  occurrences,
  viewMode,
  onBarPress,
}: HabitProgressChartProps) {
  const { theme } = useTheme();

  const chartData = useMemo(() => {
    const now = new Date();
    const data: { key: string; label: string; count: number; goal: number }[] = [];

    if (viewMode === "week") {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const count = occurrences.filter((o) => o.occurredDate === dateStr).length;
        const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        
        let dailyGoal: number;
        switch (habit.goalFrequency) {
          case "daily": dailyGoal = habit.goalCount; break;
          case "weekly": dailyGoal = habit.goalCount / 7; break;
          case "monthly": dailyGoal = habit.goalCount / 30; break;
          default: dailyGoal = habit.goalCount;
        }
        
        data.push({
          key: dateStr,
          label: dayLabels[date.getDay()],
          count,
          goal: dailyGoal,
        });
      }
    } else if (viewMode === "month") {
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        let count = 0;
        occurrences.forEach((o) => {
          const occDate = parseLocalDate(o.occurredDate);
          if (occDate >= weekStart && occDate <= weekEnd) {
            count++;
          }
        });

        const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        
        let weeklyGoal: number;
        switch (habit.goalFrequency) {
          case "daily": weeklyGoal = habit.goalCount * 7; break;
          case "weekly": weeklyGoal = habit.goalCount; break;
          case "monthly": weeklyGoal = habit.goalCount / 4.33; break;
          default: weeklyGoal = habit.goalCount;
        }
        
        data.push({
          key: `week-${i}`,
          label: weekLabel,
          count,
          goal: weeklyGoal,
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        const weeksInMonth = daysInMonth / 7;
        
        const count = occurrences.filter((o) => o.occurredDate.startsWith(monthKey)).length;
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        let monthlyGoal: number;
        switch (habit.goalFrequency) {
          case "daily": monthlyGoal = habit.goalCount * daysInMonth; break;
          case "weekly": monthlyGoal = habit.goalCount * weeksInMonth; break;
          case "monthly": monthlyGoal = habit.goalCount; break;
          default: monthlyGoal = habit.goalCount;
        }
        
        data.push({
          key: monthKey,
          label: monthLabels[monthDate.getMonth()],
          count,
          goal: monthlyGoal,
        });
      }
    }

    return data;
  }, [habit, occurrences, viewMode]);

  const maxValue = useMemo(() => {
    const maxCount = Math.max(...chartData.map((d) => d.count), 1);
    const maxGoal = Math.max(...chartData.map((d) => d.goal), 1);
    return Math.max(maxCount, maxGoal) * 1.2;
  }, [chartData]);

  const chartWidth = viewMode === "year" ? 320 : 280;
  const chartHeight = 120;
  const barWidth = viewMode === "year" ? 18 : viewMode === "month" ? 50 : 32;
  const barSpacing = viewMode === "year" ? 8 : viewMode === "month" ? 16 : 8;
  const paddingLeft = 30;
  const paddingBottom = 24;

  const isPositive = habit.habitType === "positive";
  
  const getBarColor = () => {
    return isPositive ? theme.success : theme.error;
  };

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        {chartData.map((item, index) => {
          const barHeight = (item.count / maxValue) * (chartHeight - paddingBottom - 10);
          const goalLineY = chartHeight - paddingBottom - (item.goal / maxValue) * (chartHeight - paddingBottom - 10);
          const x = paddingLeft + index * (barWidth + barSpacing);

          return (
            <React.Fragment key={item.key}>
              <Rect
                x={x}
                y={chartHeight - paddingBottom - barHeight}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={4}
                fill={getBarColor()}
                onPress={() => onBarPress?.(item.key, item.count)}
              />
              <Line
                x1={x - 2}
                y1={goalLineY}
                x2={x + barWidth + 2}
                y2={goalLineY}
                stroke={theme.textSecondary}
                strokeWidth={1.5}
                strokeDasharray="4,2"
              />
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - 6}
                fontSize={9}
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            </React.Fragment>
          );
        })}
        {[0, 0.5, 1].map((ratio) => (
          <React.Fragment key={ratio}>
            <Line
              x1={paddingLeft - 5}
              y1={chartHeight - paddingBottom - ratio * (chartHeight - paddingBottom - 10)}
              x2={paddingLeft - 2}
              y2={chartHeight - paddingBottom - ratio * (chartHeight - paddingBottom - 10)}
              stroke={theme.textSecondary}
              strokeWidth={1}
            />
            <SvgText
              x={paddingLeft - 8}
              y={chartHeight - paddingBottom - ratio * (chartHeight - paddingBottom - 10) + 3}
              fontSize={8}
              fill={theme.textSecondary}
              textAnchor="end"
            >
              {Math.round(maxValue * ratio)}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
});

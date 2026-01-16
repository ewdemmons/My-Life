import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

export interface PlanTask {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  dueOffset?: number;
}

export interface PlanProject {
  name: string;
  tasks: PlanTask[];
}

export interface PlanObjective {
  name: string;
  projects: PlanProject[];
}

export interface Plan {
  goal: string;
  advice: string;
  suggestedBubble: string;
  objectives: PlanObjective[];
}

interface PlanPreviewProps {
  plan: Plan;
  onImplement: () => void;
  isImplementing: boolean;
}

export function PlanPreview({ plan, onImplement, isImplementing }: PlanPreviewProps) {
  const { theme } = useTheme();
  const [expandedObjectives, setExpandedObjectives] = useState<Set<number>>(new Set([0]));
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(["0-0"]));

  const toggleObjective = (index: number) => {
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleProject = (key: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return theme.error;
      case "low": return theme.success;
      default: return theme.warning;
    }
  };

  const totalTasks = plan.objectives.reduce((acc, obj) => 
    acc + obj.projects.reduce((pacc, proj) => pacc + proj.tasks.length, 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.header}>
        <View style={[styles.goalIcon, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="target" size={20} color={theme.primary} />
        </View>
        <View style={styles.headerText}>
          <ThemedText style={styles.goalTitle}>{plan.goal}</ThemedText>
          <View style={styles.metaRow}>
            <View style={[styles.bubbleBadge, { backgroundColor: theme.secondary + "20" }]}>
              <Feather name="circle" size={12} color={theme.secondary} />
              <ThemedText style={[styles.bubbleText, { color: theme.secondary }]}>
                {plan.suggestedBubble}
              </ThemedText>
            </View>
            <ThemedText style={[styles.taskCount, { color: theme.textSecondary }]}>
              {totalTasks} tasks
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={[styles.adviceBox, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
        <Feather name="info" size={16} color={theme.primary} style={styles.adviceIcon} />
        <ThemedText style={[styles.adviceText, { color: theme.text }]}>
          {plan.advice}
        </ThemedText>
      </View>

      <View style={styles.hierarchyContainer}>
        {plan.objectives.map((objective, objIndex) => (
          <View key={objIndex} style={styles.objectiveContainer}>
            <Pressable 
              style={styles.objectiveHeader}
              onPress={() => toggleObjective(objIndex)}
            >
              <View style={styles.objectiveLeft}>
                <Feather 
                  name={expandedObjectives.has(objIndex) ? "chevron-down" : "chevron-right"} 
                  size={16} 
                  color={theme.textSecondary} 
                />
                <View style={[styles.typeIcon, { backgroundColor: "#F59E0B" + "20" }]}>
                  <Feather name="flag" size={14} color="#F59E0B" />
                </View>
                <ThemedText style={styles.objectiveName}>{objective.name}</ThemedText>
              </View>
              <ThemedText style={[styles.itemCount, { color: theme.textSecondary }]}>
                {objective.projects.length} projects
              </ThemedText>
            </Pressable>

            {expandedObjectives.has(objIndex) && objective.projects.map((project, projIndex) => {
              const projectKey = `${objIndex}-${projIndex}`;
              return (
                <View key={projIndex} style={styles.projectContainer}>
                  <Pressable 
                    style={styles.projectHeader}
                    onPress={() => toggleProject(projectKey)}
                  >
                    <View style={styles.projectLeft}>
                      <Feather 
                        name={expandedProjects.has(projectKey) ? "chevron-down" : "chevron-right"} 
                        size={14} 
                        color={theme.textSecondary} 
                      />
                      <View style={[styles.typeIcon, styles.smallIcon, { backgroundColor: "#8B5CF6" + "20" }]}>
                        <Feather name="folder" size={12} color="#8B5CF6" />
                      </View>
                      <ThemedText style={styles.projectName}>{project.name}</ThemedText>
                    </View>
                    <ThemedText style={[styles.itemCount, { color: theme.textSecondary }]}>
                      {project.tasks.length} tasks
                    </ThemedText>
                  </Pressable>

                  {expandedProjects.has(projectKey) && (
                    <View style={styles.taskList}>
                      {project.tasks.map((task, taskIndex) => (
                        <View key={taskIndex} style={styles.taskItem}>
                          <View style={[styles.taskDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                          <View style={styles.taskContent}>
                            <ThemedText style={styles.taskTitle}>{task.title}</ThemedText>
                            {task.description ? (
                              <ThemedText style={[styles.taskDescription, { color: theme.textSecondary }]} numberOfLines={1}>
                                {task.description}
                              </ThemedText>
                            ) : null}
                          </View>
                          {task.dueOffset ? (
                            <ThemedText style={[styles.dueText, { color: theme.textSecondary }]}>
                              +{task.dueOffset}d
                            </ThemedText>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable
        style={[
          styles.implementButton,
          { backgroundColor: theme.primary },
          isImplementing && { opacity: 0.7 },
        ]}
        onPress={onImplement}
        disabled={isImplementing}
      >
        {isImplementing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Feather name="check-circle" size={18} color="#FFFFFF" />
            <ThemedText style={styles.implementText}>Implement Plan</ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );
}

export function parsePlanFromMessage(message: string): Plan | null {
  try {
    const jsonMatch = message.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return null;

    const jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);

    if (!parsed.goal || !parsed.objectives || !Array.isArray(parsed.objectives)) {
      return null;
    }

    return {
      goal: parsed.goal,
      advice: parsed.advice || "",
      suggestedBubble: parsed.suggestedBubble || "General",
      objectives: parsed.objectives.map((obj: any) => ({
        name: obj.name,
        projects: (obj.projects || []).map((proj: any) => ({
          name: proj.name,
          tasks: (proj.tasks || []).map((task: any) => ({
            title: task.title,
            description: task.description || "",
            priority: task.priority || "medium",
            dueOffset: task.dueOffset,
          })),
        })),
      })),
    };
  } catch (error) {
    console.error("Failed to parse plan:", error);
    return null;
  }
}

export function extractTextFromMessage(message: string): string {
  return message.replace(/```json[\s\S]*?```/g, "").trim();
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  bubbleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: "500",
  },
  taskCount: {
    fontSize: 12,
  },
  adviceBox: {
    flexDirection: "row",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  adviceIcon: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  adviceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  hierarchyContainer: {
    marginBottom: Spacing.md,
  },
  objectiveContainer: {
    marginBottom: Spacing.sm,
  },
  objectiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  objectiveLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.xs,
  },
  smallIcon: {
    width: 24,
    height: 24,
  },
  objectiveName: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  itemCount: {
    fontSize: 12,
  },
  projectContainer: {
    marginLeft: Spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(139, 92, 246, 0.3)",
    paddingLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  projectLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  projectName: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  taskList: {
    marginLeft: Spacing.md,
    marginTop: Spacing.xs,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: Spacing.sm,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  taskDescription: {
    fontSize: 11,
    marginTop: 1,
  },
  dueText: {
    fontSize: 11,
    marginLeft: Spacing.sm,
  },
  implementButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  implementText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});

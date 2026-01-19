import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Plan, PlanObjective, PlanProject, PlanTask } from "@/components/PlanPreview";

interface PlanPreviewModalProps {
  visible: boolean;
  plan: Plan;
  onClose: () => void;
  onImplement: () => void;
  onRefine: () => void;
  isImplementing: boolean;
}

interface TreeNodeProps {
  type: "goal" | "objective" | "project" | "task";
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  childCount?: number;
  depth: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

function TreeNode({ 
  type, 
  title, 
  description, 
  priority, 
  childCount, 
  depth, 
  isExpanded, 
  onToggle, 
  children 
}: TreeNodeProps) {
  const { theme } = useTheme();
  
  const getTypeConfig = () => {
    switch (type) {
      case "goal":
        return { icon: "target", color: theme.primary, bg: theme.primary + "20" };
      case "objective":
        return { icon: "flag", color: "#F59E0B", bg: "#F59E0B20" };
      case "project":
        return { icon: "folder", color: "#8B5CF6", bg: "#8B5CF620" };
      case "task":
        return { icon: "check-square", color: "#3B82F6", bg: "#3B82F620" };
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "high": return theme.error;
      case "low": return theme.success;
      default: return theme.warning;
    }
  };

  const config = getTypeConfig();
  const hasChildren = children && React.Children.count(children) > 0;
  const isLeaf = type === "task";
  const leftPadding = depth * 20;

  return (
    <View style={styles.treeNode}>
      <Pressable 
        style={[styles.nodeHeader, { paddingLeft: leftPadding }]}
        onPress={onToggle}
        disabled={isLeaf}
      >
        {!isLeaf && hasChildren ? (
          <Feather 
            name={isExpanded ? "chevron-down" : "chevron-right"} 
            size={18} 
            color={theme.textSecondary}
            style={styles.chevron}
          />
        ) : (
          <View style={styles.chevronPlaceholder} />
        )}
        
        <View style={[styles.typeIcon, { backgroundColor: config.bg }]}>
          <Feather name={config.icon as any} size={type === "goal" ? 18 : 14} color={config.color} />
        </View>
        
        <View style={styles.nodeContent}>
          <View style={styles.titleRow}>
            <ThemedText 
              style={[
                styles.nodeTitle, 
                type === "goal" && styles.goalTitle,
                type === "objective" && styles.objectiveTitle,
              ]}
              numberOfLines={2}
            >
              {title}
            </ThemedText>
            
            {priority && (
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(priority) }]} />
            )}
          </View>
          
          {description ? (
            <ThemedText 
              style={[styles.nodeDescription, { color: theme.textSecondary }]} 
              numberOfLines={2}
            >
              {description}
            </ThemedText>
          ) : null}
          
          {childCount !== undefined && childCount > 0 && (
            <ThemedText style={[styles.childCount, { color: theme.textSecondary }]}>
              {childCount} {type === "objective" ? "projects" : type === "project" ? "tasks" : "items"}
            </ThemedText>
          )}
        </View>
      </Pressable>
      
      {isExpanded && children ? (
        <View style={styles.childrenContainer}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function PlanPreviewModal({ 
  visible, 
  plan, 
  onClose, 
  onImplement, 
  onRefine,
  isImplementing 
}: PlanPreviewModalProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [expandedObjectives, setExpandedObjectives] = useState<Set<number>>(new Set([0]));
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(["0-0"]));

  const toggleObjective = useCallback((index: number) => {
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleProject = useCallback((key: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allObjectives = new Set(plan.objectives.map((_, i) => i));
    const allProjects = new Set<string>();
    plan.objectives.forEach((obj, objIdx) => {
      (obj.projects || []).forEach((_, projIdx) => {
        allProjects.add(`${objIdx}-${projIdx}`);
      });
    });
    setExpandedObjectives(allObjectives);
    setExpandedProjects(allProjects);
  }, [plan]);

  const collapseAll = useCallback(() => {
    setExpandedObjectives(new Set());
    setExpandedProjects(new Set());
  }, []);

  const totalTasks = plan.objectives.reduce((acc, obj) => {
    const projectTasks = (obj.projects || []).reduce((pacc, proj) => pacc + proj.tasks.length, 0);
    const directTasks = (obj.tasks || []).length;
    return acc + projectTasks + directTasks;
  }, 0);

  const totalProjects = plan.objectives.reduce((acc, obj) => acc + (obj.projects || []).length, 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: isDark ? "#1a1a1a" : "#f5f5f5" }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.headerTitle}>Plan Preview</ThemedText>
          </View>
          <Pressable 
            style={[styles.refineButton, { backgroundColor: theme.primary + "20" }]}
            onPress={onRefine}
          >
            <Feather name="edit-3" size={16} color={theme.primary} />
            <ThemedText style={[styles.refineButtonText, { color: theme.primary }]}>Refine</ThemedText>
          </Pressable>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={true}
        >
          <View style={[styles.goalCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.goalIcon, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="target" size={28} color={theme.primary} />
            </View>
            <View style={styles.goalContent}>
              <ThemedText style={styles.goalLabel}>GOAL</ThemedText>
              <ThemedText style={styles.goalText}>{plan.goal}</ThemedText>
              <View style={styles.goalMeta}>
                <View style={[styles.bubbleBadge, { backgroundColor: theme.secondary + "20" }]}>
                  <Feather name="circle" size={12} color={theme.secondary} />
                  <ThemedText style={[styles.bubbleText, { color: theme.secondary }]}>
                    {plan.suggestedBubble}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.statsText, { color: theme.textSecondary }]}>
                  {plan.objectives.length} objectives  {totalProjects} projects  {totalTasks} tasks
                </ThemedText>
              </View>
            </View>
          </View>

          {plan.advice ? (
            <View style={[styles.adviceCard, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
              <Feather name="info" size={18} color={theme.primary} />
              <ThemedText style={[styles.adviceText, { color: theme.text }]}>
                {plan.advice}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.toolbarRow}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Plan Structure
            </ThemedText>
            <View style={styles.expandButtons}>
              <Pressable style={[styles.expandBtn, { backgroundColor: theme.backgroundDefault }]} onPress={expandAll}>
                <Feather name="maximize-2" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.expandBtnText, { color: theme.textSecondary }]}>Expand All</ThemedText>
              </Pressable>
              <Pressable style={[styles.expandBtn, { backgroundColor: theme.backgroundDefault }]} onPress={collapseAll}>
                <Feather name="minimize-2" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.expandBtnText, { color: theme.textSecondary }]}>Collapse</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.treeContainer, { backgroundColor: theme.backgroundDefault }]}>
            {plan.objectives.map((objective, objIndex) => {
              const hasProjects = objective.projects && objective.projects.length > 0;
              const hasDirectTasks = objective.tasks && objective.tasks.length > 0;
              const childCount = hasProjects 
                ? objective.projects!.length 
                : hasDirectTasks 
                  ? objective.tasks!.length 
                  : 0;
              
              return (
                <TreeNode
                  key={objIndex}
                  type="objective"
                  title={objective.name}
                  childCount={childCount}
                  depth={0}
                  isExpanded={expandedObjectives.has(objIndex)}
                  onToggle={() => toggleObjective(objIndex)}
                >
                  {hasProjects && objective.projects!.map((project, projIndex) => {
                    const projectKey = `${objIndex}-${projIndex}`;
                    return (
                      <TreeNode
                        key={projIndex}
                        type="project"
                        title={project.name}
                        childCount={project.tasks.length}
                        depth={1}
                        isExpanded={expandedProjects.has(projectKey)}
                        onToggle={() => toggleProject(projectKey)}
                      >
                        {project.tasks.map((task, taskIndex) => (
                          <TreeNode
                            key={taskIndex}
                            type="task"
                            title={task.title}
                            description={task.description}
                            priority={task.priority}
                            depth={2}
                          />
                        ))}
                      </TreeNode>
                    );
                  })}
                  {hasDirectTasks && objective.tasks!.map((task, taskIndex) => (
                    <TreeNode
                      key={`direct-${taskIndex}`}
                      type="task"
                      title={task.title}
                      description={task.description}
                      priority={task.priority}
                      depth={1}
                    />
                  ))}
                </TreeNode>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundDefault }]}>
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
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <ThemedText style={styles.implementText}>Implementing...</ThemedText>
              </>
            ) : (
              <>
                <Feather name="check-circle" size={20} color="#FFFFFF" />
                <ThemedText style={styles.implementText}>Implement Plan</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface PlanPreviewButtonProps {
  plan: Plan;
  onPress: () => void;
}

export function PlanPreviewButton({ plan, onPress }: PlanPreviewButtonProps) {
  const { theme } = useTheme();
  
  const totalTasks = plan.objectives.reduce((acc, obj) => {
    const projectTasks = (obj.projects || []).reduce((pacc, proj) => pacc + proj.tasks.length, 0);
    const directTasks = (obj.tasks || []).length;
    return acc + projectTasks + directTasks;
  }, 0);

  return (
    <Pressable 
      style={[styles.previewCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
      onPress={onPress}
    >
      <View style={styles.previewHeader}>
        <View style={[styles.previewIcon, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="target" size={20} color={theme.primary} />
        </View>
        <View style={styles.previewContent}>
          <ThemedText style={styles.previewTitle} numberOfLines={1}>{plan.goal}</ThemedText>
          <ThemedText style={[styles.previewMeta, { color: theme.textSecondary }]}>
            {plan.objectives.length} objectives  {totalTasks} tasks
          </ThemedText>
        </View>
        <View style={[styles.viewButton, { backgroundColor: theme.primary }]}>
          <Feather name="eye" size={16} color="#FFFFFF" />
          <ThemedText style={styles.viewButtonText}>View</ThemedText>
        </View>
      </View>
      
      <View style={styles.previewSummary}>
        {plan.objectives.slice(0, 3).map((obj, i) => (
          <View key={i} style={styles.previewItem}>
            <View style={[styles.previewDot, { backgroundColor: "#F59E0B" }]} />
            <ThemedText style={[styles.previewItemText, { color: theme.textSecondary }]} numberOfLines={1}>
              {obj.name}
            </ThemedText>
          </View>
        ))}
        {plan.objectives.length > 3 && (
          <ThemedText style={[styles.previewMore, { color: theme.primary }]}>
            +{plan.objectives.length - 3} more objectives
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  refineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  refineButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  goalCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  goalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  goalContent: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    opacity: 0.6,
    marginBottom: 4,
  },
  goalText: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
    marginBottom: Spacing.xs,
  },
  goalMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.sm,
  },
  bubbleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statsText: {
    fontSize: 12,
  },
  adviceCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  adviceText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  expandButtons: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  expandBtnText: {
    fontSize: 12,
  },
  treeContainer: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    overflow: "hidden",
  },
  treeNode: {
    marginBottom: 2,
  },
  nodeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
  },
  chevron: {
    marginTop: 2,
    marginRight: 4,
  },
  chevronPlaceholder: {
    width: 22,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  nodeContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  nodeTitle: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  objectiveTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  childCount: {
    fontSize: 12,
    marginTop: 2,
  },
  childrenContainer: {
    borderLeftWidth: 2,
    borderLeftColor: "rgba(139, 92, 246, 0.2)",
    marginLeft: 10,
    paddingLeft: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  implementButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  implementText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  previewCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    marginVertical: Spacing.sm,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  previewContent: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  previewMeta: {
    fontSize: 12,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  viewButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  previewSummary: {
    paddingLeft: 48,
  },
  previewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewItemText: {
    fontSize: 13,
    flex: 1,
  },
  previewMore: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
});

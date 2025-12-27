import React, { useState, useLayoutEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, Pressable, ScrollView, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useApp } from "@/context/AppContext";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { HierarchicalTaskList } from "@/components/HierarchicalTaskList";
import { SchedulingModal } from "@/components/SchedulingModal";
import { RecurringEventModal } from "@/components/RecurringEventModal";
import { SharePeopleModal } from "@/components/SharePeopleModal";
import { AddPersonModal } from "@/components/AddPersonModal";
import { TASK_TYPES, TaskType, EVENT_TYPES, CalendarEvent, ShareRecord, Person, Task } from "@/types";
import { isRecurringEvent } from "@/utils/recurrence";

const TASK_TYPE_COLORS: Record<TaskType, string> = {
  goal: "#FF6B6B",
  objective: "#4ECDC4",
  project: "#45B7D1",
  task: "#96CEB4",
  subtask: "#88D8B0",
  appointment: "#FFEAA7",
  idea: "#DDA0DD",
  list: "#98D8C8",
  item: "#B8B8B8",
  resource: "#87CEEB",
};

type RouteParams = RouteProp<RootStackParamList, "CategoryDetail">;
type TabType = "entries" | "calendar" | "dashboard" | "people";

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: "entries", label: "Entries", icon: "list" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "dashboard", label: "Dashboard", icon: "pie-chart" },
  { key: "people", label: "People", icon: "users" },
];

export default function CategoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { getTasksByCategory, events, deleteEvent, deleteEventSeries, updateCategory, categories, people } = useApp();

  const categoryFromState = categories.find(c => c.id === route.params.category.id) || route.params.category;
  const category = categoryFromState;
  const [activeTab, setActiveTab] = useState<TabType>("entries");
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingAsInstance, setEditingAsInstance] = useState(false);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const categoryTasks = getTasksByCategory(category.id);

  const handleUpdateSharing = async (shares: ShareRecord[]) => {
    await updateCategory(category.id, { sharedWith: shares });
  };

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find(e => e.value === type) || EVENT_TYPES[0];
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleEventPress = (event: CalendarEvent) => {
    setEditingEvent(event);
    if (isRecurringEvent(event)) {
      setShowRecurringModal(true);
    } else {
      setShowSchedulingModal(true);
    }
  };

  const handleEditInstance = () => {
    setShowRecurringModal(false);
    setEditingAsInstance(true);
    setShowSchedulingModal(true);
  };

  const handleEditSeries = () => {
    setShowRecurringModal(false);
    setEditingAsInstance(false);
    setShowSchedulingModal(true);
  };

  const handleDeleteInstance = async () => {
    if (editingEvent) {
      await deleteEvent(editingEvent.id);
      setShowRecurringModal(false);
      setEditingEvent(null);
    }
  };

  const handleDeleteSeriesEvent = async () => {
    if (editingEvent?.seriesId) {
      await deleteEventSeries(editingEvent.seriesId);
      setShowRecurringModal(false);
      setEditingEvent(null);
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setShowSchedulingModal(true);
  };

  const categoryEvents = useMemo(() => 
    events.filter(e => e.categoryId === category.id),
    [events, category.id]
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, { marked: boolean; dotColor: string }> = {};
    categoryEvents.forEach((event) => {
      marks[event.startDate] = {
        marked: true,
        dotColor: category.color,
      };
    });
    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: category.color,
      } as any;
    }
    return marks;
  }, [categoryEvents, category.color, selectedDate]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerRight: () => (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <HeaderButton onPress={() => setShowShareModal(true)}>
            <Feather name="share-2" size={20} color={theme.primary} />
          </HeaderButton>
          <HeaderButton onPress={() => navigation.navigate("AddCategory", { category })}>
            <Feather name="edit-2" size={20} color={theme.primary} />
          </HeaderButton>
        </View>
      ),
    });
  }, [navigation, category, theme]);

  const linkedPeople = useMemo(() => {
    const personIds = new Set<string>();
    if (category.peopleIds) {
      category.peopleIds.forEach(id => personIds.add(id));
    }
    categoryTasks.forEach(task => {
      if (task.assigneeIds) {
        task.assigneeIds.forEach(id => personIds.add(id));
      }
    });
    categoryEvents.forEach(event => {
      if (event.attendeeIds) {
        event.attendeeIds.forEach(id => personIds.add(id));
      }
    });
    return people.filter(p => personIds.has(p.id));
  }, [category.peopleIds, categoryTasks, categoryEvents, people]);

  const getPersonLinkedItems = useCallback((personId: string) => {
    const tasks = categoryTasks.filter(t => t.assigneeIds?.includes(personId));
    const evts = categoryEvents.filter(e => e.attendeeIds?.includes(personId));
    return { tasks, events: evts };
  }, [categoryTasks, categoryEvents]);

  const dashboardStats = useMemo(() => {
    return TASK_TYPES.map(type => {
      const tasksOfType = categoryTasks.filter(t => t.type === type.value);
      const openTasks = tasksOfType.filter(t => t.status !== "completed");
      const completedTasks = tasksOfType.filter(t => t.status === "completed");
      const inProgressTasks = tasksOfType.filter(t => t.status === "in_progress");
      const typeColor = TASK_TYPE_COLORS[type.value];
      const completionRate = tasksOfType.length > 0 
        ? Math.round((completedTasks.length / tasksOfType.length) * 100) 
        : 0;

      return {
        type,
        typeColor,
        total: tasksOfType.length,
        open: openTasks.length,
        completed: completedTasks.length,
        inProgress: inProgressTasks.length,
        completionRate,
      };
    }).filter(s => s.total > 0);
  }, [categoryTasks]);

  const handleDashboardTypePress = (type: TaskType) => {
    setSelectedType(type);
    setActiveTab("entries");
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRelationshipLabel = (rel: string) => {
    const labels: Record<string, string> = {
      family: "Family",
      friend: "Friend",
      colleague: "Colleague",
      pet: "Pet",
      teammate: "Teammate",
      other: "Other",
    };
    return labels[rel] || rel;
  };

  const renderEntriesTab = () => (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeFilters}
        contentContainerStyle={styles.typeFiltersContent}
      >
        <Pressable
          style={[
            styles.typeChip,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            !selectedType && { borderColor: category.color },
          ]}
          onPress={() => setSelectedType(null)}
        >
          <ThemedText style={[styles.typeChipText, !selectedType && { color: category.color }]}>
            All
          </ThemedText>
        </Pressable>
        {TASK_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[
              styles.typeChip,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
              selectedType === t.value && { borderColor: category.color, backgroundColor: category.color + "15" },
            ]}
            onPress={() => setSelectedType(selectedType === t.value ? null : t.value)}
          >
            <Feather name={t.icon as any} size={14} color={selectedType === t.value ? category.color : theme.textSecondary} />
            <ThemedText style={[styles.typeChipText, selectedType === t.value && { color: category.color }]}>
              {t.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        style={styles.taskList}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
      >
        <HierarchicalTaskList tasks={categoryTasks} filterType={selectedType} />
      </ScrollView>
    </>
  );

  const renderCalendarTab = () => (
    <ScrollView
      style={styles.calendarContainer}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
    >
      <Calendar
        theme={{
          backgroundColor: theme.backgroundRoot,
          calendarBackground: theme.backgroundRoot,
          textSectionTitleColor: theme.textSecondary,
          selectedDayBackgroundColor: category.color,
          selectedDayTextColor: "#FFFFFF",
          todayTextColor: category.color,
          dayTextColor: theme.text,
          textDisabledColor: theme.textSecondary,
          monthTextColor: theme.text,
          arrowColor: category.color,
        }}
        markedDates={markedDates}
        onDayPress={(day: { dateString: string }) => {
          setSelectedDate(selectedDate === day.dateString ? null : day.dateString);
        }}
      />
      {selectedDate ? (
        <View style={styles.selectedDateSection}>
          <ThemedText style={styles.selectedDateTitle}>Events for {selectedDate}</ThemedText>
          {categoryEvents.filter(e => e.startDate === selectedDate).length > 0 ? (
            <View style={styles.eventsList}>
              {categoryEvents.filter(e => e.startDate === selectedDate).map(event => {
                const eventTypeInfo = getEventTypeInfo(event.eventType);
                const isTimedEvent = event.eventType === "appointment" || event.eventType === "meeting";
                return (
                  <Pressable 
                    key={event.id} 
                    style={[styles.eventCard, { backgroundColor: theme.backgroundDefault }]}
                    onPress={() => handleEventPress(event)}
                  >
                    <View style={[styles.eventTimeBar, { backgroundColor: eventTypeInfo.color }]} />
                    <View style={styles.eventCardContent}>
                      <View style={styles.eventHeader}>
                        <View style={styles.eventBadgeRow}>
                          <View style={[styles.eventTypeBadge, { backgroundColor: eventTypeInfo.color + "20" }]}>
                            <Feather name={eventTypeInfo.icon as any} size={12} color={eventTypeInfo.color} />
                            <ThemedText style={[styles.eventTypeText, { color: eventTypeInfo.color }]}>
                              {eventTypeInfo.label}
                            </ThemedText>
                          </View>
                          {isRecurringEvent(event) ? (
                            <View style={[styles.repeatBadge, { backgroundColor: theme.success + "20" }]}>
                              <Feather name="repeat" size={10} color={theme.success} />
                            </View>
                          ) : null}
                        </View>
                        {isTimedEvent ? (
                          <ThemedText style={[styles.eventTimeText, { color: theme.textSecondary }]}>
                            {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </ThemedText>
                        ) : (
                          <ThemedText style={[styles.eventTimeText, { color: theme.textSecondary }]}>
                            {formatTime(event.startTime)}
                          </ThemedText>
                        )}
                      </View>
                      <ThemedText style={styles.eventCardTitle} numberOfLines={1}>
                        {event.title}
                      </ThemedText>
                      {event.description ? (
                        <ThemedText style={[styles.eventDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                          {event.description}
                        </ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <ThemedText style={[styles.noEventsText, { color: theme.textSecondary }]}>
              No events scheduled for this date
            </ThemedText>
          )}
        </View>
      ) : null}
    </ScrollView>
  );

  const renderDashboardTab = () => (
    <ScrollView
      style={styles.dashboardContainer}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
    >
      <ThemedText style={styles.dashboardSectionTitle}>Entry Summaries</ThemedText>
      {dashboardStats.length > 0 ? (
        <View style={styles.dashboardGrid}>
          {dashboardStats.map(stat => (
            <Pressable
              key={stat.type.value}
              style={[styles.dashboardCard, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => handleDashboardTypePress(stat.type.value)}
            >
              <View style={[styles.dashboardIconContainer, { backgroundColor: stat.typeColor + "20" }]}>
                <Feather name={stat.type.icon as any} size={24} color={stat.typeColor} />
              </View>
              <ThemedText style={styles.dashboardCardTitle}>{stat.type.label}s</ThemedText>
              <View style={styles.dashboardStats}>
                <View style={styles.dashboardStatRow}>
                  <ThemedText style={[styles.dashboardStatLabel, { color: theme.textSecondary }]}>
                    Open
                  </ThemedText>
                  <ThemedText style={[styles.dashboardStatValue, { color: stat.typeColor }]}>
                    {stat.open}
                  </ThemedText>
                </View>
                <View style={styles.dashboardStatRow}>
                  <ThemedText style={[styles.dashboardStatLabel, { color: theme.textSecondary }]}>
                    Total
                  </ThemedText>
                  <ThemedText style={styles.dashboardStatValue}>{stat.total}</ThemedText>
                </View>
                <View style={styles.dashboardStatRow}>
                  <ThemedText style={[styles.dashboardStatLabel, { color: theme.textSecondary }]}>
                    Completed
                  </ThemedText>
                  <ThemedText style={[styles.dashboardStatValue, { color: theme.success }]}>
                    {stat.completed}
                  </ThemedText>
                </View>
                {stat.inProgress > 0 ? (
                  <View style={styles.dashboardStatRow}>
                    <ThemedText style={[styles.dashboardStatLabel, { color: theme.textSecondary }]}>
                      In Progress
                    </ThemedText>
                    <ThemedText style={[styles.dashboardStatValue, { color: theme.warning }]}>
                      {stat.inProgress}
                    </ThemedText>
                  </View>
                ) : null}
                <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${stat.completionRate}%`, backgroundColor: theme.success }
                    ]} 
                  />
                </View>
              </View>
              <View style={styles.dashboardCardFooter}>
                <ThemedText style={[styles.dashboardCardCta, { color: category.color }]}>
                  View All
                </ThemedText>
                <Feather name="chevron-right" size={14} color={category.color} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyDashboard}>
          <Feather name="inbox" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No entries yet. Add your first entry to see summaries here.
          </ThemedText>
        </View>
      )}
    </ScrollView>
  );

  const renderPersonCard = ({ item }: { item: Person }) => {
    const isExpanded = expandedPersonId === item.id;
    const linkedItems = getPersonLinkedItems(item.id);
    const hasLinkedItems = linkedItems.tasks.length > 0 || linkedItems.events.length > 0;

    const categoryInvite = item.categoryInvites?.find(inv => inv.categoryId === category.id);
    const getStatusColor = (status: string) => {
      switch (status) {
        case "accepted": return theme.success;
        case "pending": return theme.warning;
        case "declined": return theme.error;
        default: return theme.textSecondary;
      }
    };
    const getPermissionLabel = (permission: string) => {
      switch (permission) {
        case "co-owner": return "Co-owner";
        case "edit": return "Can edit";
        case "view": return "View only";
        default: return permission;
      }
    };

    return (
      <View style={[styles.personCard, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          style={styles.personCardHeader}
          onPress={() => setExpandedPersonId(isExpanded ? null : item.id)}
        >
          {item.photoUri ? (
            <Image source={{ uri: item.photoUri }} style={styles.personAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.personAvatarPlaceholder, { backgroundColor: category.color + "30" }]}>
              <ThemedText style={[styles.personAvatarInitials, { color: category.color }]}>
                {getInitials(item.name)}
              </ThemedText>
            </View>
          )}
          <View style={styles.personInfo}>
            <View style={styles.personNameRow}>
              <ThemedText style={styles.personName}>{item.name}</ThemedText>
              {categoryInvite ? (
                <View style={[styles.sharedBadge, { backgroundColor: getStatusColor(categoryInvite.status) + "20" }]}>
                  <Feather 
                    name={categoryInvite.status === "accepted" ? "check" : categoryInvite.status === "pending" ? "clock" : "x"} 
                    size={10} 
                    color={getStatusColor(categoryInvite.status)} 
                  />
                  <ThemedText style={[styles.sharedBadgeText, { color: getStatusColor(categoryInvite.status) }]}>
                    {getPermissionLabel(categoryInvite.permission)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={[styles.personRelationship, { color: theme.textSecondary }]}>
              {getRelationshipLabel(item.relationship)}
            </ThemedText>
          </View>
          {hasLinkedItems ? (
            <Feather
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.textSecondary}
            />
          ) : null}
        </Pressable>

        {isExpanded && hasLinkedItems ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.personLinkedItems}>
            {linkedItems.tasks.length > 0 ? (
              <View style={styles.linkedSection}>
                <ThemedText style={[styles.linkedSectionTitle, { color: theme.textSecondary }]}>
                  Assigned Tasks ({linkedItems.tasks.length})
                </ThemedText>
                {linkedItems.tasks.slice(0, 3).map(task => {
                  const typeInfo = TASK_TYPES.find(t => t.value === task.type) || TASK_TYPES[0];
                  const typeColor = TASK_TYPE_COLORS[task.type] || theme.textSecondary;
                  return (
                    <View key={task.id} style={styles.linkedItem}>
                      <Feather name={typeInfo.icon as any} size={14} color={typeColor} />
                      <ThemedText style={styles.linkedItemText} numberOfLines={1}>
                        {task.title}
                      </ThemedText>
                    </View>
                  );
                })}
                {linkedItems.tasks.length > 3 ? (
                  <ThemedText style={[styles.linkedMore, { color: category.color }]}>
                    +{linkedItems.tasks.length - 3} more
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
            {linkedItems.events.length > 0 ? (
              <View style={styles.linkedSection}>
                <ThemedText style={[styles.linkedSectionTitle, { color: theme.textSecondary }]}>
                  Events ({linkedItems.events.length})
                </ThemedText>
                {linkedItems.events.slice(0, 3).map(event => {
                  const eventInfo = getEventTypeInfo(event.eventType);
                  return (
                    <View key={event.id} style={styles.linkedItem}>
                      <Feather name={eventInfo.icon as any} size={14} color={eventInfo.color} />
                      <ThemedText style={styles.linkedItemText} numberOfLines={1}>
                        {event.title}
                      </ThemedText>
                    </View>
                  );
                })}
                {linkedItems.events.length > 3 ? (
                  <ThemedText style={[styles.linkedMore, { color: category.color }]}>
                    +{linkedItems.events.length - 3} more
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <View style={styles.personActions}>
          <Pressable
            style={[styles.personActionBtn, { backgroundColor: theme.primary + "15" }]}
            onPress={() => setShowShareModal(true)}
          >
            <Feather name="share" size={14} color={theme.primary} />
            <ThemedText style={[styles.personActionText, { color: theme.primary }]}>
              Manage Access
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderPeopleTab = () => (
    <View style={styles.peopleContainer}>
      {linkedPeople.length > 0 ? (
        <FlatList
          data={linkedPeople}
          keyExtractor={(item) => item.id}
          renderItem={renderPersonCard}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyPeople}>
          <Feather name="users" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No people linked to this category yet
          </ThemedText>
          <Pressable
            style={[styles.addPersonCta, { backgroundColor: category.color }]}
            onPress={() => setShowAddPersonModal(true)}
          >
            <Feather name="user-plus" size={16} color="#FFFFFF" />
            <ThemedText style={styles.addPersonCtaText}>Add Person</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <View style={[styles.expandedHeader, { marginTop: headerHeight, backgroundColor: category.color + "15" }]}>
        <View style={styles.headerContent}>
          <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
            <Feather name={category.icon as any || "circle"} size={32} color="#FFFFFF" />
          </View>
          <View style={styles.headerTitleSection}>
            <ThemedText style={styles.categoryTitle}>{category.name}</ThemedText>
            {category.description ? (
              <ThemedText style={[styles.categoryDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                {category.description}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.headerActionBtn, { backgroundColor: category.color }]}
            onPress={() => navigation.navigate("AddTask", { categoryId: category.id })}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={[styles.headerActionBtn, { backgroundColor: theme.success }]}
            onPress={handleAddEvent}
          >
            <Feather name="calendar" size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={[styles.headerActionBtn, { backgroundColor: theme.primary }]}
            onPress={() => setShowAddPersonModal(true)}
          >
            <Feather name="user-plus" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.backgroundDefault }]}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && { borderBottomColor: category.color, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Feather
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.key ? category.color : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.tabLabel,
                { color: activeTab === tab.key ? category.color : theme.textSecondary },
                activeTab === tab.key && { fontWeight: "600" },
              ]}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {activeTab === "entries" ? renderEntriesTab() : null}
      {activeTab === "calendar" ? renderCalendarTab() : null}
      {activeTab === "dashboard" ? renderDashboardTab() : null}
      {activeTab === "people" ? renderPeopleTab() : null}

      <SchedulingModal
        visible={showSchedulingModal}
        onClose={() => {
          setShowSchedulingModal(false);
          setEditingEvent(null);
          setEditingAsInstance(false);
        }}
        initialDate={selectedDate || undefined}
        lockedCategoryId={category.id}
        editingEvent={editingEvent}
        editingAsInstance={editingAsInstance}
      />
      <RecurringEventModal
        visible={showRecurringModal}
        event={editingEvent}
        onClose={() => {
          setShowRecurringModal(false);
          setEditingEvent(null);
        }}
        onEditInstance={handleEditInstance}
        onEditSeries={handleEditSeries}
        onDeleteInstance={handleDeleteInstance}
        onDeleteSeries={handleDeleteSeriesEvent}
      />
      <SharePeopleModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        sharedWith={category.sharedWith || []}
        onUpdateSharing={handleUpdateSharing}
        itemTitle={category.name}
      />

      <AddPersonModal
        visible={showAddPersonModal}
        onClose={() => setShowAddPersonModal(false)}
        preSelectedCategoryId={category.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  expandedHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    minHeight: 140,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleSection: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  categoryDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    justifyContent: "flex-end",
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  tabLabel: {
    fontSize: 13,
  },
  typeFilters: {
    maxHeight: 40,
    marginVertical: Spacing.sm,
  },
  typeFiltersContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  typeChipText: {
    fontSize: 13,
  },
  taskList: {
    flex: 1,
  },
  calendarContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  selectedDateSection: {
    marginTop: Spacing.lg,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  eventsList: {
    gap: Spacing.sm,
  },
  eventCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  eventTimeBar: {
    width: 4,
  },
  eventCardContent: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  eventHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eventBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  eventTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  repeatBadge: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  eventTypeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  eventTimeText: {
    fontSize: 12,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  eventDescription: {
    fontSize: 13,
  },
  noEventsText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  dashboardContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  dashboardSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  dashboardCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  dashboardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  dashboardCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  dashboardStats: {
    gap: Spacing.xs,
  },
  dashboardStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dashboardStatLabel: {
    fontSize: 12,
  },
  dashboardStatValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  dashboardCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.sm,
    gap: 4,
  },
  dashboardCardCta: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  emptyDashboard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  peopleContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  personCard: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  personCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
  },
  personAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  personAvatarInitials: {
    fontSize: 18,
    fontWeight: "600",
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: "600",
  },
  personRelationship: {
    fontSize: 13,
    marginTop: 2,
  },
  personNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  sharedBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  personLinkedItems: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  linkedSection: {
    marginBottom: Spacing.sm,
  },
  linkedSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  linkedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  linkedItemText: {
    fontSize: 13,
    flex: 1,
  },
  linkedMore: {
    fontSize: 12,
    marginTop: 4,
  },
  personActions: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  personActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  personActionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyPeople: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
  },
  addPersonCta: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  addPersonCtaText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

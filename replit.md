# My Life - Productivity App

## Overview
"My Life" is a cross-platform mobile productivity app built with Expo and React Native. It helps users organize their life through visual Life Categories (represented as a wheel), hierarchical task management, and calendar integration.

## Current State
MVP implementation with core features:
- Minimalist Home screen with "Balance Your World" headline
- Life Wheel dashboard with interactive category bubbles (10% enlarged)
- Central wheel hub with soft glow effect for interactive appearance
- Add/Edit Life Categories with name, description, color, and icon
- Hierarchical task management with 10 entry types
- Calendar view with event scheduling (Reminder, Due Date, Appointment, Meeting)
- Profile screen with stats, settings, and Recycle Bin
- Local data persistence with AsyncStorage
- Dark mode support (follows system settings)
- Feature parity between bubble calendars and global calendar

## Architecture

### Frontend (client/)
- **Expo + React Native** with TypeScript
- **React Navigation 7** for navigation
- **AsyncStorage** for local data persistence
- **react-native-calendars** for calendar views
- **react-native-svg** for Life Wheel visualization
- **react-native-reanimated** for animations

### Backend (server/)
- Express.js server (currently only serving landing page)
- Prepared for future Firebase/API integration

### State Management
- React Context API (AppContext) for global state
- Local storage with AsyncStorage for persistence

## Project Structure
```
client/
├── App.tsx                 # App entry point
├── context/
│   └── AppContext.tsx      # Global state management
├── types/
│   └── index.ts            # TypeScript types
├── screens/
│   ├── HomeScreen.tsx      # Life Wheel dashboard
│   ├── TasksScreen.tsx     # All tasks view
│   ├── CalendarScreen.tsx  # Calendar with tasks
│   ├── ProfileScreen.tsx   # Settings & stats
│   ├── CategoryDetailScreen.tsx
│   ├── AddCategoryScreen.tsx
│   └── AddTaskScreen.tsx
├── components/
│   ├── LifeWheel.tsx       # Life Wheel visualization
│   ├── FAB.tsx             # Floating action button
│   └── ...other components
├── navigation/
│   ├── RootStackNavigator.tsx
│   └── MainTabNavigator.tsx
└── constants/
    └── theme.ts            # Design system tokens
```

## Key Features

### Life Wheel
- Visual circular dashboard with category bubbles
- Tap to view category details
- Long press for edit/delete menu
- Animated interactions

### Hierarchical Task Management
- **10 Entry Types**: Goal, Objective, Project, Task, Sub-task, Appointment, Idea, List, Item, Resource
- **Parent-child relationships**: Create nested hierarchies (e.g., Goal > Objective > Project > Task > Sub-task)
- **Expand/collapse**: View child entries inline with visual indentation
- **Type filtering**: Filter entries by type (Goal, Task, etc.)
- **Category filtering**: Filter by life category
- **Cascading delete**: Deleting a parent moves all child entries to Recycle Bin
- **Type icons**: Large colored icons (24dp) with type-specific colors
- **Enhanced visuals**: 
  - Bold 18sp titles with 14sp metadata
  - Type badges with colored backgrounds
  - Due date indicators (red=overdue, orange=today/soon, green=on-track)
  - Colored hierarchy lines for nested children
  - Card elevation with subtle shadows

### Drag-and-Drop Interactions
- **Long-press to drag**: Hold an entry for 400ms to enter drag mode
- **Hierarchy changes**: Tap another entry while dragging to move as sub-entry
- **Confirmation modal**: Shows "Move '[title]' as a sub-entry under '[new parent]'?"
- **Haptic feedback**: Touch feedback on iOS/Android devices
- **Category inheritance**: Moving to new parent inherits category of target

### Clickable URLs
- URLs in descriptions are automatically detected (http/https)
- Displayed as blue underlined links
- Tapping opens in device browser via Linking.openURL

### Recycle Bin
- Deleted items stored for 30 days
- Restore or permanently delete from Profile screen
- Shows days remaining before auto-deletion
- Cascading restore includes all related child items

### Calendar
- Monthly calendar view
- Colored dots for tasks by category
- Task list for selected date

### Data Persistence
- All data stored locally with AsyncStorage
- Default sample categories and tasks on first launch
- Export and clear data options

## Development

### Running the App
```bash
npm run dev
```
- Expo app runs on port 8081
- Express backend runs on port 5000

### Navigation Structure
- 4-tab navigation: Home, Tasks, Calendar, Profile
- FAB (Floating Action Button) for adding categories/tasks
- Modal screens for Add/Edit forms

## Future Enhancements
- Firebase integration for sync across devices
- User authentication
- Push notifications
- AI assistant for task suggestions
- Drag-and-drop task reordering

# My Life - Productivity App

## Overview
"My Life" is a cross-platform mobile productivity app built with Expo and React Native. It helps users organize their life through visual Life Categories (represented as a wheel), hierarchical task management, and calendar integration.

## Current State
MVP implementation with core features:
- Life Wheel dashboard with interactive category bubbles
- Add/Edit Life Categories with name, description, color, and icon
- Task management with categories, priorities, and due dates
- Calendar view with task dots
- Profile screen with stats and settings
- Local data persistence with AsyncStorage
- Dark mode support (follows system settings)

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

### Task Management
- Create tasks with title, description, category, priority, due date
- Toggle task completion
- Filter by category or search
- Group tasks by life category

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
- Hierarchical sub-tasks
- Drag-and-drop task reordering

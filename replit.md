# My Life - Productivity App

## Overview
"My Life" is a cross-platform mobile productivity app built with Expo and React Native. It helps users organize their lives through visual Life Categories (represented as a wheel), hierarchical task management, and calendar integration. The project's vision is to provide a comprehensive, minimalist tool for personal organization with cloud data persistence and robust user data isolation.

## User Preferences
- I prefer clear and concise explanations.
- Please prioritize high-level architectural discussions over granular code implementation details.
- I appreciate a focus on key features and their impact.
- Do not make changes to the `server/` folder or its contents.
- Do not modify the core Supabase schema (`supabase/schema.sql`) without explicit instruction.
- When suggesting changes, provide a brief rationale.

## System Architecture

### UI/UX Decisions
- **Minimalist Design**: Clean Home screen with a "Balance Your World" headline.
- **Life Wheel Dashboard**: Interactive, visual circular dashboard with category bubbles that enlarge on hover/focus and have a central hub with a soft glow.
- **Dark Mode Support**: Follows system settings for a consistent user experience.
- **Consistent Icons**: Large colored icons (24dp) for task types, type badges with colored backgrounds.
- **Visual Task Hierarchy**: Bold 18sp titles with 14sp metadata, due date indicators (red=overdue, orange=today/soon, green=on-track), colored hierarchy lines, and card elevation with subtle shadows.
- **Interactive Elements**: Floating Action Button (FAB) for adding new items, clickable URLs, long-press for drag-and-drop, haptic feedback.
- **Avatar Display**: Stacked avatars with initials (when no photo) on task cards and event views.

### Technical Implementations
- **Frontend**: Expo and React Native with TypeScript for mobile development. Uses React Navigation for routing and `@supabase/supabase-js` for data interaction. `react-native-calendars` for calendar views, `react-native-svg` for the Life Wheel, and `react-native-reanimated` for animations.
- **Backend**: An Express.js server primarily for serving a landing page; Supabase acts as the primary cloud backend for data and authentication.
- **State Management**: React Context API (`AppContext`) for global state, complemented by Supabase realtime subscriptions for data synchronization across devices.
- **Data Persistence**: All user data (categories, tasks, events, people, recycle bin) is stored in Supabase, leveraging Row Level Security (RLS) for complete user isolation.
- **Authentication**: Email/Password authentication via Supabase Auth, with session persistence using AsyncStorage and automatic token refresh.
- **Recurring Events**: Robust recurrence engine with options for daily, weekly, biweekly, monthly, yearly repeats. Supports series-aware editing (single instance vs. entire series), instance exceptions, and intelligent regeneration logic for future instances upon pattern changes or rescheduling.
- **Task Completion & Habit Tracking**: Detailed completion logging with "As of" or "Until" types, notes, and history. Habits have positive/negative types, goal settings (frequency/count), streak tracking, and automatic logging from linked tasks.
- **People Management & Sharing**: Comprehensive person profiles with relationship types, photos, and notes. Supports linking people to categories, tasks, and events. Features an invitation system for sharing Life Bubbles with other users via email/SMS, including deep linking and contact import.

### Feature Specifications
- **Life Wheel**: Visual dashboard for categories; tap for details, long-press for edit/delete.
- **Hierarchical Task Management**: Supports 10 entry types (Goal, Objective, Project, Task, Sub-task, Appointment, Idea, List, Item, Resource) with parent-child relationships, expand/collapse functionality, and type/category filtering. Cascading delete moves children to the Recycle Bin.
- **Drag-and-Drop**: Long-press to drag tasks, move as sub-entries with confirmation and haptic feedback. Category inheritance on move.
- **Recycle Bin**: Stores deleted items for 30 days with restore/permanent delete options and cascading restore for child items.
- **Calendar**: Monthly view with colored dots for tasks by category and a task list for selected dates.
- **Bubble Sharing**: Share Life Bubbles with others via email/SMS invites, supporting app users and new contacts. Includes deep links for invite activation, expiration, and various permission levels (View only, Can edit, Co-owner).

### System Design Choices
- **Cross-Platform**: Leverages Expo and React Native for a single codebase across iOS and Android.
- **Cloud-Native Backend**: Utilizes Supabase for a fully managed, scalable backend with integrated authentication, database, and realtime capabilities.
- **Modular Structure**: Organized `client/` directory with clear separation for `screens/`, `components/`, `context/`, `navigation/`, and `utils/`.

## External Dependencies

- **Supabase**: Primary cloud backend for database, authentication, and realtime subscriptions.
  - `supabaseUrl` and `supabaseAnonKey` configured via `app.json` and environment variables.
- **Expo**: Core framework for React Native development.
  - `expo-image-picker`: For photo uploads.
  - `expo-mail-composer`: For email invitations.
  - `expo-sms`: For SMS invitations.
  - `expo-linking`: For deep linking.
- **React Native**: Core UI framework.
- **React Navigation**: For app navigation.
- **react-native-calendars**: For calendar UI components.
- **react-native-svg**: For rendering SVG graphics, specifically for the Life Wheel.
- **react-native-reanimated**: For animations.
- **@supabase/supabase-js**: JavaScript client library for interacting with Supabase.
- **Express.js**: Used in `server/` folder for a basic landing page, not core app functionality.
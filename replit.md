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
- Cloud data persistence with Supabase (complete user isolation via RLS)
- Dark mode support (follows system settings)
- Feature parity between bubble calendars and global calendar

## Architecture

### Frontend (client/)
- **Expo + React Native** with TypeScript
- **React Navigation 7** for navigation
- **@supabase/supabase-js** for Supabase cloud data
- **react-native-calendars** for calendar views
- **react-native-svg** for Life Wheel visualization
- **react-native-reanimated** for animations

### Backend (server/)
- Express.js server (currently only serving landing page)
- Supabase provides the cloud database and authentication

### State Management
- React Context API (AppContext) for global state
- Supabase realtime subscriptions for data sync

## Project Structure
```
client/
├── App.tsx                 # App entry point
├── context/
│   └── AppContext.tsx      # Global state management
│   └── AuthContext.tsx     # Authentication state management
├── types/
│   └── index.ts            # TypeScript types
├── screens/
│   ├── HomeScreen.tsx      # Life Wheel dashboard
│   ├── TasksScreen.tsx     # All tasks view
│   ├── CalendarScreen.tsx  # Calendar with tasks
│   ├── ProfileScreen.tsx   # Settings & stats
│   ├── PeopleScreen.tsx    # People management
│   ├── CategoryDetailScreen.tsx
│   ├── AddCategoryScreen.tsx
│   └── AddTaskScreen.tsx
├── components/
│   ├── LifeWheel.tsx       # Life Wheel visualization
│   ├── FAB.tsx             # Floating action button
│   ├── SchedulingModal.tsx # Event creation/editing modal
│   ├── RecurringEventModal.tsx # Series-aware edit/delete options
│   ├── PeopleSelector.tsx  # Multi-select people picker & avatars
│   └── ...other components
├── utils/
│   └── recurrence.ts       # Recurrence generation utilities
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

### Recurring Events
- **Recurrence options**: None, Daily, Weekly, Biweekly, Monthly, Yearly
- **Series generation**: Up to 52 occurrences (1 year of weekly events)
- **Visual indicator**: Repeat icon (↻) on recurring events
- **Series-aware editing**: Choose to edit single instance or entire series
- **Instance exceptions**: Edited instances become exceptions, preserved during series updates
- **Series deletion**: Delete single instance or entire series
- **Recurrence clarity note**: Shows description like "Repeats Weekly on Mondays"

### Advanced Series Editing
- **Recurrence change**: Changing recurrence pattern (e.g., weekly → daily) regenerates future instances
- **Anchor date reschedule**: Moving the anchor event date regenerates future instances from new date
- **Past event preservation**: Past events only receive mutable field updates (title, description, etc.), not date/time changes
- **Future event updates**: Future events receive time changes but preserve their recurrence-derived dates
- **Realtime guard**: Prevents duplicate instances during series regeneration by filtering realtime subscription replays
- **Recurrence→None conversion**: Converts recurring series to single standalone event, deleting all other instances

### People Management
- **Person profiles**: Name, relationship type, email, phone, photo, notes
- **Relationship types**: Family, Friend, Colleague, Pet, Teammate, Other
- **Photo support**: Upload photos via expo-image-picker with 1:1 aspect ratio
- **People tab**: 5th tab in navigation with searchable list and add/edit modal
- **Category linking**: 
  - People can be linked to multiple Life Categories via categoryIds
  - AddPersonModal includes multi-select Life Category dropdown
  - CategoryDetailScreen '+Person' pre-selects current category
  - Bi-directional sync: person.categoryIds ↔ category.peopleIds
- **Linking to entities**: 
  - Categories can tag people (peopleIds)
  - Tasks can assign people (assigneeIds)
  - Events can add attendees (attendeeIds)
- **Invitation system**:
  - InviteModal for email/SMS invitations via expo-mail-composer and expo-sms
  - Access rights: View only, Can edit, Co-owner permissions
  - CategoryInvite tracks per-category sharing with status (pending/accepted/declined)
  - Shared status badges in CategoryDetailScreen People tab
  - Invite button on PeopleScreen person cards
- **Avatar display**: Stacked avatars with initials (when no photo) on task cards and event views
- **Cascading deletion**: Deleting a person removes their ID from all linked categories, tasks, and events
- **Defensive handling**: Missing person IDs are gracefully ignored in UI

### Data Persistence
- **All Data in Supabase**: Categories, tasks, events, people, and recycle_bin all stored in Supabase cloud
- **User Isolation**: Row Level Security (RLS) enforces complete data isolation between users
- **Realtime Subscriptions**: All tables have realtime subscriptions keeping UI in sync across devices
- **Automatic Migration**: One-time migration from legacy AsyncStorage to Supabase on first login
- **Recycle Bin**: 30-day retention with automatic cleanup of expired items
- **Default Bubbles**: 7 default Life Bubbles created on first login (Family, Home, Health, Work, Learning, Finance, Hobbies)
- Export and clear data options in Profile screen

### Supabase Integration
- **Backend**: Supabase is the primary cloud backend for all data storage
- **Client**: `client/lib/supabase.ts` exports the initialized Supabase client
- **Schema**: `supabase/schema.sql` defines 6 tables with RLS policies:
  - `profiles`: User profiles (id, email, display_name, avatar_url)
  - `life_bubbles`: Life categories (id, user_id, name, color, icon, description, people_ids)
  - `tasks`: Hierarchical tasks with 10 entry types (id, user_id, bubble_id, parent_id, type, title, status, priority, order_index, assignee_ids)
  - `events`: Calendar events with recurrence (id, user_id, bubble_id, event_type, title, start_date, start_time, recurrence, series_id, is_exception, attendee_ids)
  - `people`: Contacts and relationships (id, user_id, name, relationship, email, phone, photo_uri, notes, category_ids)
  - `recycle_bin`: Soft-deleted items with 30-day retention (id, user_id, item_type, item_data, related_items, deleted_at)
- **Configuration**: Credentials stored in `app.json` under `expo.extra` section
  - `supabaseUrl`: Supabase project URL
  - `supabaseAnonKey`: Supabase anon (public) key
- **Environment Variables**: Also available via EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
- **Note**: The anon key is a public key by design (safe to expose in client code); row-level security (RLS) on Supabase protects data

### Authentication
- **Email/Password Auth**: Using Supabase Auth with signUp and signInWithPassword
- **Auth Screens**: 
  - WelcomeScreen: Landing page with Sign Up and Sign In buttons
  - SignUpScreen: Email, password, confirm password fields with validation
  - SignInScreen: Email and password fields
- **AuthContext**: Manages session state with onAuthStateChange listener
- **Route Protection**: RootStackNavigator shows AuthNavigator if no session, MainAppNavigator if authenticated
- **Logout**: Available in ProfileScreen Account section with confirmation dialog
- **Profile Auto-creation**: On signup, automatically creates/upserts row in `profiles` table (id, email, created_at)
- **Default Bubbles**: On first login, 7 default Life Bubbles are created (Family, Home, Health, Work, Learning, Finance, Hobbies)

### Database Schema (Supabase)
- **Schema file**: `supabase/schema.sql` - Run in Supabase SQL Editor to create tables
- **Tables**:
  - `profiles`: User profiles (id, email, display_name, avatar_url)
  - `life_bubbles`: Life categories (id, user_id, name, color, icon, description)
  - `tasks`: Hierarchical tasks with 10 entry types (id, user_id, bubble_id, parent_id, type, title)
  - `events`: Calendar events with recurrence (id, user_id, bubble_id, start_time, recurrence_rule)
  - `people`: Contacts and relationships (id, user_id, name, relationship, contact_info)
- **RLS**: Row Level Security enabled on all tables - users can only access their own data
- **Default Bubbles**: `client/lib/defaultBubbles.ts` - 7 default bubbles created on first login

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
- Series regeneration when changing recurrence pattern (currently edits apply to existing instances only)

# My Life App - Design Guidelines

## Architecture Decisions

### Authentication
**No Auth Required (Initial Phase):**
- App is single-user focused with local data storage
- Include **Profile/Settings screen** with:
  - User-customizable avatar (generate 3 preset avatars: minimalist geometric person silhouettes in primary color variations)
  - Display name field
  - App preferences: Dark mode toggle, notification settings, data export
- Future-ready structure for Firebase auth integration (login/signup screens can be added later)

### Navigation
**Tab Navigation (4 tabs + FAB):**
- **Home** (Life Wheel dashboard) - leftmost tab
- **Tasks** (All tasks view) - second tab
- **Calendar** (Calendar view) - third tab
- **Profile** (Settings & user info) - rightmost tab
- **Floating Action Button (FAB)** for core "Add" action:
  - Positioned center-bottom, above tab bar
  - Opens bottom sheet with options: "Add Life Category" or "Add Task"

### Screen Specifications

#### 1. Home Screen (Life Wheel)
- **Purpose:** Visual dashboard showing life category bubbles
- **Layout:**
  - Transparent header with right button (filter/sort icon)
  - Scrollable main content area with Life Wheel visualization
  - Top safe area: headerHeight + Spacing.xl
  - Bottom safe area: tabBarHeight + Spacing.xxl (extra room for FAB)
- **Components:**
  - Centered circular "wheel" using react-native-svg
  - Touchable bubble circles arranged in spoke pattern (6-8 bubbles max for visual clarity)
  - Each bubble: category icon (center), category name (below), colored ring
  - Empty state: "Get Started" card with illustration
- **Interactions:**
  - Tap bubble → Navigate to Category Detail screen
  - Long press bubble → Quick edit menu (Edit, Delete)
  - Subtle scale animation on press (0.95 scale)

#### 2. Category Detail Screen
- **Purpose:** Show tasks/calendar filtered by selected life category
- **Layout:**
  - Custom header with large title (category name), colored accent bar matching bubble color
  - Header right button: Edit category
  - Segmented control below header: "Tasks" / "Calendar" tabs
  - Bottom safe area: insets.bottom + Spacing.xl
- **Components:**
  - Task list (hierarchical, collapsible using FlatList)
  - Mini calendar view when Calendar segment selected
  - Empty state per segment

#### 3. Add/Edit Category Modal
- **Purpose:** Create or modify life category
- **Layout:**
  - Full-screen modal with custom header
  - Header: Cancel (left), "Save" (right, primary color when valid)
  - Scrollable form area
  - Top safe area: insets.top + Spacing.xl
  - Bottom safe area: insets.bottom + Spacing.xl
- **Form Fields:**
  - Category name input (required)
  - Description textarea (optional)
  - Icon picker (grid of 20 common category icons)
  - Color picker (8 preset colors in 2 rows)
- **Submit:** Header "Save" button (disabled until name filled)

#### 4. Tasks Screen
- **Purpose:** View all tasks across categories
- **Layout:**
  - Transparent header with search bar (expandable on tap)
  - Header right button: Filter icon (shows filter sheet)
  - Collapsible hierarchical list with indentation
  - Bottom safe area: tabBarHeight + Spacing.xxl
- **Components:**
  - Grouped sections by Life Category
  - Swipeable task rows (swipe left: Delete, right: Complete)
  - Checkbox, task title, due date indicator, category color dot

#### 5. Calendar Screen
- **Purpose:** View tasks by date
- **Layout:**
  - Custom header with month/year title (centered), prev/next arrows
  - Calendar component (react-native-calendars)
  - Task list below calendar for selected date
  - Bottom safe area: tabBarHeight + Spacing.xl
- **Components:**
  - Calendar with dots on dates with tasks (colored by category)
  - Agenda list with grouped tasks by time
  - Empty state for dates with no tasks

#### 6. Profile/Settings Screen
- **Purpose:** User customization and app preferences
- **Layout:**
  - Standard header: "Profile"
  - Scrollable form/list
  - Bottom safe area: tabBarHeight + Spacing.xl
- **Components:**
  - User avatar (large, top) with edit button overlay
  - Display name field
  - Settings list: Dark Mode toggle, Notifications, Export Data, About

## Design System

### Color Palette
**Light Mode:**
- Primary: #5B7FFF (vibrant blue)
- Secondary: #FF6B9D (warm pink)
- Background: #FFFFFF
- Surface: #F7F9FC
- Text Primary: #1A1A1A
- Text Secondary: #6B7280
- Border: #E5E7EB
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444

**Dark Mode:**
- Primary: #7C9AFF (lighter blue)
- Secondary: #FF8AB8
- Background: #0F0F0F
- Surface: #1A1A1A
- Text Primary: #F9FAFB
- Text Secondary: #9CA3AF
- Border: #374151
- (Success/Warning/Error same as light)

**Life Category Colors (8 presets):**
#5B7FFF, #FF6B9D, #10B981, #F59E0B, #8B5CF6, #06B6D4, #F97316, #EC4899

### Typography
- **Heading 1:** 32px, Bold, Letter spacing -0.5px
- **Heading 2:** 24px, Semibold
- **Heading 3:** 20px, Semibold
- **Body:** 16px, Regular, Line height 24px
- **Caption:** 14px, Regular, Text Secondary color
- **Small:** 12px, Medium

### Spacing
- xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, xxl: 32px

### Visual Design
- **Bubbles:** Circular with 2px colored stroke, white/surface fill, drop shadow on floating bubbles only
- **Cards:** 12px border radius, Surface color, no shadow (use subtle border instead)
- **Buttons:** 8px border radius, 48px min height for primary actions
- **FAB:** 56px diameter circle, Primary color, drop shadow:
  - shadowOffset: {width: 0, height: 2}
  - shadowOpacity: 0.10
  - shadowRadius: 2
- **Icons:** Use @expo/vector-icons (Feather set), 24px default size
- **Animations:** Subtle scale (0.95) on press, 200ms duration, easeInOut

### Required Assets
Generate these unique assets:
1. **User Avatars (3 presets):** Minimalist geometric person silhouettes in Primary, Secondary, Success colors
2. **Empty State Illustrations (3):**
   - Life Wheel empty: Circular frame with sparkles
   - Tasks empty: Checkmark with stars
   - Calendar empty: Calendar with smile
3. **Category Icons (20):** Simple line icons for: Family, Health, Work, Finance, Hobbies, Travel, Education, Social, Fitness, Mindfulness, Career, Home, Creativity, Relationships, Learning, Food, Reading, Spirituality, Adventure, Self-Care

### Accessibility
- Minimum touch target: 48x48 points
- Color contrast ratio: 4.5:1 for text
- Support dynamic type (iOS) and font scaling (Android)
- Provide alternative text for all interactive elements
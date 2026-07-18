import type { Habit, LifeCategory, Task } from "@/types";

type AddTaskFn = (
  task: Omit<Task, "id" | "createdAt" | "updatedAt">
) => Promise<Task | null>;

type AddHabitFn = (
  habit: Omit<Habit, "id" | "createdAt" | "updatedAt">
) => Promise<Habit | void>;

const DEFAULT_AREA_NAMES = [
  "Home",
  "Family",
  "Health",
  "Work",
  "Finances",
  "Finance",
];

export async function seedStarterContent(
  categories: LifeCategory[],
  addTask: AddTaskFn,
  addHabit: AddHabitFn,
  _userId: string,
  customAreaNames?: string[]
): Promise<void> {
  if (!categories || categories.length === 0) {
    return;
  }

  const findCategory = (name: string) =>
    categories.find((c) => c.name.toLowerCase() === name.toLowerCase());

  try {
    await seedHome(findCategory("Home"), addTask);
  } catch (error) {
    console.error("[StarterContent] Home seeding failed:", error);
  }

  try {
    await seedFamily(findCategory("Family"), addTask);
  } catch (error) {
    console.error("[StarterContent] Family seeding failed:", error);
  }

  try {
    await seedHealth(findCategory("Health"), addTask, addHabit);
  } catch (error) {
    console.error("[StarterContent] Health seeding failed:", error);
  }

  try {
    const financeCategory =
      findCategory("Finances") ?? findCategory("Finance");
    await seedFinances(financeCategory, addTask);
  } catch (error) {
    console.error("[StarterContent] Finances seeding failed:", error);
  }

  try {
    await seedWork(findCategory("Work"), addTask);
  } catch (error) {
    console.error("[StarterContent] Work seeding failed:", error);
  }

  if (customAreaNames && customAreaNames.length > 0) {
    for (const areaName of customAreaNames) {
      if (
        DEFAULT_AREA_NAMES.some((d) => d.toLowerCase() === areaName.toLowerCase())
      ) {
        continue;
      }

      const customCategory = categories.find(
        (c) => c.name.toLowerCase() === areaName.toLowerCase()
      );
      if (!customCategory) continue;

      try {
        await addTask({
          title: "Complete Your Coach Assessment",
          type: "task",
          description: `Your ${areaName} Coach is ready to get to know you.

The Life Area Coach Assessment is one of the most valuable features in My Life — especially for personal areas like this one. In just a few minutes, Coach will ask you targeted questions about your goals, current situation, and obstacles in ${areaName}.

From your answers, Coach will:
→ Build a personalized profile for this area
→ Deliver insights based on your actual activity
→ Provide accountability nudges tied to your stated goals
→ Give you guidance that's specific to you — not generic advice

HOW TO START YOUR ASSESSMENT:
1. Open the ${areaName} Life Area
2. Tap the Coach ⚡️ tab
3. Tap 'Start Assessment'
4. Answer 4-6 questions about your
   goals and current state
5. Coach generates your profile and
   begins delivering personalized guidance

Tip: The more honest and specific your
answers, the more valuable your Coach
insights will be. This takes about
3-5 minutes and is worth every second.`,
          categoryId: customCategory.id,
          parentId: null,
          status: "pending",
          priority: "medium",
          assigneeIds: [],
          isPinned: false,
        });
      } catch (error) {
        console.error(
          `[StarterContent] Coach Assessment task failed for ${areaName}:`,
          error
        );
      }
    }
  }
}

async function seedHome(
  category: LifeCategory | undefined,
  addTask: AddTaskFn
): Promise<void> {
  if (!category) return;
  try {
    const cid = category.id;

    const chores = await addTask({
      title: "Household Chores",
      type: "list",
      description: "",
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (chores) {
      const choreItems = [
        "Clean kitchen",
        "Vacuum",
        "Mop floors",
        "Clean bathrooms",
        "Clean garage",
        "Trash and recycling",
      ];
      for (const title of choreItems) {
        await addTask({
          title,
          type: "task",
          description: "",
          categoryId: cid,
          parentId: chores.id,
          status: "pending",
          priority: "medium",
          assigneeIds: [],
          isPinned: false,
        });
      }
      const laundry = await addTask({
        title: "Laundry",
        type: "list",
        description: "",
        categoryId: cid,
        parentId: chores.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      if (laundry) {
        for (const title of ["Darks", "Whites", "Towels", "Sheets"]) {
          await addTask({
            title,
            type: "task",
            description: "",
            categoryId: cid,
            parentId: laundry.id,
            status: "pending",
            priority: "medium",
            assigneeIds: [],
            isPinned: false,
          });
        }
      }
    }

    const yard = await addTask({
      title: "Yard Work",
      type: "list",
      description: "",
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (yard) {
      for (const title of [
        "Mow lawn",
        "Trim hedges and bushes",
        "Weed whack",
        "Rake leaves",
        "Clean gutters",
        "Fertilize lawn seasonally",
      ]) {
        await addTask({
          title,
          type: "task",
          description: "",
          categoryId: cid,
          parentId: yard.id,
          status: "pending",
          priority: "medium",
          assigneeIds: [],
          isPinned: false,
        });
      }
    }

    const maintenance = await addTask({
      title: "Home Maintenance",
      type: "project",
      description: "",
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (maintenance) {
      for (const title of [
        "Schedule annual HVAC service",
        "Test smoke and CO detectors",
        "Check and replace air filters",
        "Inspect roof and gutters",
        "Service water heater annually",
        "Check weatherstripping on doors",
      ]) {
        await addTask({
          title,
          type: "task",
          description: "",
          categoryId: cid,
          parentId: maintenance.id,
          status: "pending",
          priority: "medium",
          assigneeIds: [],
          isPinned: false,
        });
      }
    }

    const orgSystem = await addTask({
      title: "Create a Home Organization System",
      type: "goal",
      description: "",
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (orgSystem) {
      const declutter = await addTask({
        title: "Declutter one room at a time",
        type: "project",
        description: "",
        categoryId: cid,
        parentId: orgSystem.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      if (declutter) {
        for (const title of [
          "Sort items: keep, donate, toss",
          "Organize storage spaces",
          "Label containers and shelves",
        ]) {
          await addTask({
            title,
            type: "task",
            description: "",
            categoryId: cid,
            parentId: declutter.id,
            status: "pending",
            priority: "medium",
            assigneeIds: [],
            isPinned: false,
          });
        }
      }
      for (const title of [
        "Set up a weekly cleaning schedule",
        "Create a home maintenance calendar",
      ]) {
        await addTask({
          title,
          type: "task",
          description: "",
          categoryId: cid,
          parentId: orgSystem.id,
          status: "pending",
          priority: "medium",
          assigneeIds: [],
          isPinned: false,
        });
      }
    }

    await addTask({
      title: "Home Maintenance Schedule",
      type: "task",
      description: `A simple home maintenance schedule helps you stay ahead of repairs and avoid costly surprises.

To build yours in My Life:
1. Review the Home Maintenance list in this Life Area and note which tasks are annual, seasonal, or monthly
2. Open your Calendar and schedule each task at the right frequency — set advance reminders so nothing sneaks up on you
3. For recurring tasks, use the repeating event feature so they automatically reappear each cycle
4. Pin your highest priority maintenance tasks to your Master List so they stay visible

Tip: Ask your Life Coach to help you build a personalized maintenance schedule — just say 'Help me create a home maintenance schedule' in the Coach chat.`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
  } catch (error) {
    console.error("[StarterContent] Home seeding failed:", error);
  }
}

async function seedFamily(
  category: LifeCategory | undefined,
  addTask: AddTaskFn
): Promise<void> {
  if (!category) return;
  try {
    const cid = category.id;

    await addTask({
      title: "Important Family Dates",
      type: "task",
      description: `Never miss a birthday, anniversary, or milestone again.

To set these up in My Life:
1. Open the People tab in this Life Area and add the important people in your life — family members, close friends
2. Add each person's birthday in their profile — My Life will automatically create reminders so you're always prepared
3. For anniversaries and other recurring dates, add them directly to your calendar with advance reminders

Tip: Ask your Life Coach to help — say 'Help me set up birthday reminders for my family' in the Coach chat.`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });

    await addTask({
      title: "Populate Your Family Calendar",
      type: "task",
      description: `Getting your family's upcoming events on the calendar is one of the fastest ways to feel more organized and in control.

Start by adding:
→ Vacations and trips
→ Family parties and gatherings
→ Kids' school events and activities
→ Recurring family obligations
→ Holidays you celebrate together
→ Any events in the next 90 days that involve your family

To add events in My Life:
1. Open the Calendar tab in this Life Area
2. Tap the Add Event button or use voice — say something like 'Schedule a family vacation for July' and Coach will handle it instantly
3. Set advance reminders so nothing sneaks up on you
4. For recurring events like weekly family dinners, use the repeating event feature

Tip: You can also ask Coach to search and add events for you — try 'Add all school holidays to my family calendar' and watch it happen automatically.`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
  } catch (error) {
    console.error("[StarterContent] Family seeding failed:", error);
  }
}

async function seedHealth(
  category: LifeCategory | undefined,
  addTask: AddTaskFn,
  addHabit: AddHabitFn
): Promise<void> {
  if (!category) return;
  try {
    const cid = category.id;

    const bedtime = await addTask({
      title: "Develop a Bedtime Routine",
      type: "project",
      description: `A consistent bedtime routine is one of the highest impact changes you can make for your health, energy, and focus.

This project is here to help you build yours — personalize these tasks to fit your life:`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (bedtime) {
      for (const title of [
        "Decide on a consistent sleep and wake time",
        "Set a recurring bedtime reminder on your calendar",
        "Identify your wind-down activities (reading, stretching, journaling, no screens)",
        "Optimize your sleep environment (temperature, darkness, sound)",
        "Track your sleep quality for two weeks and adjust as needed",
      ]) {
        await addTask({
          title,
          type: "task",
          description: "",
          categoryId: cid,
          parentId: bedtime.id,
          status: "pending",
          priority: "medium",
          assigneeIds: [],
          isPinned: false,
        });
      }
      await addTask({
        title: "Use Coach to help plan your routine",
        type: "task",
        description: `Get personalized guidance building your bedtime routine in two ways:

Option 1 — Coach Assessment:
Open the Health Coach tab and complete your assessment. Coach will learn your goals, obstacles, and current state — then provide personalized insights and nudges to help you build lasting habits.

Option 2 — Coach Assist:
Tap the ⚡ icon on this entry to open a focused Coach session about your bedtime routine. Try: 'Help me build a personalized bedtime routine' and Coach will guide you step by step.`,
        categoryId: cid,
        parentId: bedtime.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
    }

    const exercise = await addTask({
      title: "Create an Exercise Regimen",
      type: "project",
      description: `The best exercise regimen is the one you'll actually stick to. Use these tasks to design yours:`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (exercise) {
      for (const title of [
        "Define your fitness goal (strength, cardio, flexibility, weight loss, general health)",
        "Choose workout types that fit your lifestyle and schedule",
        "Schedule workouts on your calendar (aim for at least 3x per week)",
        "Set up a habit to track consistency",
        "Research and save resources in your Wellness Resources entry",
      ]) {
        await addTask({
          title,
          type: "task",
          description: "",
          categoryId: cid,
          parentId: exercise.id,
          status: "pending",
          priority: "medium",
          assigneeIds: [],
          isPinned: false,
        });
      }
      await addTask({
        title: "Use Coach to help plan your regimen",
        type: "task",
        description: `Get personalized guidance building your exercise regimen in two ways:

Option 1 — Coach Assessment:
Open the Health Coach tab and complete your assessment. Coach will understand your fitness goals, current activity level, and obstacles — then deliver insights and accountability nudges tailored specifically to you.

Option 2 — Coach Assist:
Tap the ⚡ icon on this entry to open a focused Coach session about your exercise regimen. Try: 'Help me design a workout plan that fits my schedule' and Coach will build a personalized plan and add it directly to your entry hierarchy.`,
        categoryId: cid,
        parentId: exercise.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
    }

    await addTask({
      title: "Wellness Resources",
      type: "resource",
      description: `Save helpful health and wellness resources here — articles, videos, workout guides, nutrition tips, and links that support your goals.

To add a resource:
→ Tap Add Entry and select Resource
→ Paste links directly into the description field — they become tappable for quick access
→ Or ask Coach to research a topic and save it here — try 'Research the best beginner workout plans and save as a resource in Health'`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });

    await addTask({
      title: "Set Up Your Health Habits",
      type: "task",
      description: `Habits are the foundation of lasting health — small consistent actions that compound over time.

MY LIFE makes habit tracking simple. To get started:

YOUR FIRST HABIT IS ALREADY SET UP:
'Meditation Minutes' is ready to go in your Habits tab — a daily 10-minute meditation practice. Research consistently shows even 10 minutes of daily mindfulness improves focus, reduces stress, and supports overall wellbeing.

HOW TO LOG A HABIT:
1. Open the Habits tab in Health
2. Tap the + button on the habit card to log your session
3. Or use voice — say 'Log my meditation for today' and Coach handles it instantly

HOW TO EDIT A HABIT:
1. Tap the habit card to open it
2. Adjust the name, goal, or frequency to match your needs
3. Changes apply going forward

HOW TO ADD A NEW HABIT:
1. Tap the Add Habit button or use Capture on the Home screen
2. Name your habit, set your daily or weekly target, and assign it to a Life Area
3. Try starting with one habit at a time — consistency matters more than volume

HOW TO DELETE A HABIT:
1. Open the habit card
2. Tap the menu icon
3. Select Delete

SUGGESTED HABITS TO ADD NEXT:
→ Morning movement (30 min daily)
→ Drink 8 glasses of water (daily)
→ No screens before bed (daily)

Tip: Ask Coach to help — say 'Help me build a morning routine' and Coach will guide you through setting up habits that fit your lifestyle.`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });

    await addHabit({
      name: "Meditation Minutes",
      habitType: "positive",
      goalFrequency: "daily",
      goalCount: 10,
      categoryId: cid,
      linkedTaskId: null,
      isActive: true,
    });
  } catch (error) {
    console.error("[StarterContent] Health seeding failed:", error);
  }
}

async function seedFinances(
  category: LifeCategory | undefined,
  addTask: AddTaskFn
): Promise<void> {
  if (!category) return;
  try {
    const cid = category.id;

    const budget = await addTask({
      title: "Create a Personal Budget",
      type: "project",
      description: `A personal budget is the foundation of financial health — it tells your money where to go instead of wondering where it went.

Work through these steps to build yours. Don't worry about getting it perfect — a simple budget you actually use beats a perfect one you don't:`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (budget) {
      await addTask({
        title: "List all monthly expenses",
        type: "task",
        description: `Write down every recurring expense — housing, utilities, groceries, transport, insurance, subscriptions, entertainment, personal care. Nothing is too small to include. Tip: Review your last 2-3 bank and credit card statements to make sure you capture everything.`,
        categoryId: cid,
        parentId: budget.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      await addTask({
        title: "Calculate total monthly income",
        type: "task",
        description: `Include all income sources — salary, freelance, side income, passive income. Use your after-tax (take-home) number for accuracy.`,
        categoryId: cid,
        parentId: budget.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      await addTask({
        title: "Identify areas to reduce spending",
        type: "task",
        description: `Compare your expenses to your income. Where is more going out than you'd like? Subscriptions you forgot about? Dining out more than planned? Even small reductions compound significantly over time.`,
        categoryId: cid,
        parentId: budget.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      await addTask({
        title: "Set a monthly savings target",
        type: "task",
        description: `Aim to save before you spend — decide on a savings amount and treat it like a non-negotiable bill. Even a small consistent amount builds meaningful momentum. A common starting goal: save 10% of take-home income.`,
        categoryId: cid,
        parentId: budget.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      await addTask({
        title: "Schedule a monthly budget review on your calendar",
        type: "task",
        description: `A budget only works if you check in with it. Set a recurring monthly calendar event — 30 minutes is enough — to review spending, adjust categories, and celebrate progress. Tip: Use My Life's repeating event feature so it automatically reappears every month.`,
        categoryId: cid,
        parentId: budget.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });

      const debt = await addTask({
        title: "Debt Reduction Plan",
        type: "project",
        description: `Carrying debt is one of the biggest barriers to financial freedom. This plan will help you tackle it systematically:`,
        categoryId: cid,
        parentId: budget.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      if (debt) {
        for (const title of [
          "List all debts with current balances and interest rates",
          "Choose your payoff strategy: Avalanche (highest interest first) or Snowball (smallest balance first)",
          "Set a monthly payment target above the minimum for your priority debt",
          "Schedule monthly debt review on your calendar",
          "Celebrate each debt paid off — add it as a milestone entry",
        ]) {
          await addTask({
            title,
            type: "task",
            description: "",
            categoryId: cid,
            parentId: debt.id,
            status: "pending",
            priority: "medium",
            assigneeIds: [],
            isPinned: false,
          });
        }
      }

      await addTask({
        title: "Use Coach to help build your budget",
        type: "task",
        description: `Get personalized financial guidance in two ways:

Option 1 — Coach Assessment:
Open the Finances Coach tab and complete your assessment. Coach will understand your financial goals, current situation, and obstacles — then deliver insights and accountability nudges tailored to you.

Option 2 — Coach Assist:
Tap the ⚡ icon on this entry to open a focused Coach session. Try: 'Help me create a personal budget' and Coach will guide you through the process and build a plan directly into your entry hierarchy.`,
        categoryId: cid,
        parentId: budget.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
    }

    const checkup = await addTask({
      title: "Financial Health Checkup",
      type: "list",
      description: `Your financial health deserves regular attention — not just when something goes wrong. Use this list as a recurring reference to stay on top of the big picture.

Tip: Schedule a quarterly Financial Health Checkup on your calendar as a recurring event so it becomes a consistent habit.`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (checkup) {
      for (const title of [
        "Review credit score",
        "Check all account statements for errors or unauthorized charges",
        "Review and cancel unused subscriptions",
        "Update beneficiaries on financial accounts and insurance",
        "Review insurance coverage (home, auto, life, health)",
        "Check progress toward savings and debt goals",
        "Review and update your budget if income or expenses changed",
      ]) {
        await addTask({
          title,
          type: "task",
          description: "",
          categoryId: cid,
          parentId: checkup.id,
          status: "pending",
          priority: "medium",
          assigneeIds: [],
          isPinned: false,
        });
      }
    }
  } catch (error) {
    console.error("[StarterContent] Finances seeding failed:", error);
  }
}

async function seedWork(
  category: LifeCategory | undefined,
  addTask: AddTaskFn
): Promise<void> {
  if (!category) return;
  try {
    const cid = category.id;

    await addTask({
      title: "Enter Your Recurring Responsibilities",
      type: "task",
      description: `Your recurring work responsibilities are the backbone of your professional life — the things that need to happen consistently regardless of what else is on your plate.

Start by capturing everything you do on a regular basis. This becomes your personal work reference and the foundation of your daily planning.

HOW TO CAPTURE ENTRIES:
→ Voice (fastest): tap the microphone on the Home screen and say 'Add a work task to send weekly status report' — it appears instantly in your Work area
→ Capture button: tap + on the Home screen, select Add Entry, and choose Work as your Life Area
→ Directly in this Life Area: open the Work Entries tab and tap the + button

WHAT TO CAPTURE:
→ Daily tasks (emails, check-ins, standups, reports)
→ Weekly responsibilities (team meetings, recurring deadlines, reviews)
→ Monthly obligations (reporting, billing, planning sessions)
→ Quarterly or annual commitments

HOW TO NEST ENTRIES:
For responsibilities that have multiple steps or components, create a parent entry and add sub-entries beneath it:
→ Open any entry and tap Add Sub-Entry
→ Build as many levels deep as your work requires
→ Example:
Weekly Team Meeting (parent)
  → Prepare agenda
  → Send calendar invite
  → Follow up on action items

THE COMPLETE UNTIL FEATURE:
This is one of the most powerful tools for managing recurring work responsibilities.

Here's how it works:
When you complete a recurring responsibility, instead of marking it permanently done, use Complete Until to set the date it should come back:
→ Tap the complete button on any entry
→ Select 'Complete Until'
→ Set the date it recurs (next week, next month, etc.)
→ The entry disappears from your view
→ On the date you set, it automatically re-pins to your Master List with a reminder that it's due again

EXAMPLE:
'Send Weekly Status Report' →
Complete Until next Friday →
disappears until Friday →
re-pins automatically when due

Tip: Once you've captured your responsibilities and set up Complete Until for the recurring ones, use the Daily Plan Generator to automatically incorporate them into your scheduled day.`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });

    await addTask({
      title: "Work Inbox",
      type: "list",
      description: `Capture work tasks and action items here as they come in throughout the day — from meetings, emails, conversations, and ideas.

The goal is simple: get it out of your head and into the app immediately so nothing gets lost.

Fastest ways to capture:
→ Voice: tap the microphone on the Home screen and say 'Add a work task to follow up with the team about the proposal' — it appears instantly
→ Capture button: tap + on the Home screen for quick entry
→ Type directly into this list anytime

Review and process your Work Inbox at the start or end of each day — move items to the right place, set priorities, and pin anything urgent to your Master List.`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });

    const career = await addTask({
      title: "Career Goals",
      type: "goal",
      description: `Where do you want to be in 1, 3, and 5 years? Having clear career goals transforms your daily work from reactive to intentional — every task and decision connects to something bigger.

Use this goal to define and pursue your professional vision. Break it down into objectives and projects using the entry hierarchy, then let Coach help you build a path to get there.`,
      categoryId: cid,
      parentId: null,
      status: "pending",
      priority: "medium",
      assigneeIds: [],
      isPinned: false,
    });
    if (career) {
      await addTask({
        title: "Define your 1, 3 and 5 year career vision",
        type: "task",
        description: `Write down where you want to be professionally at each milestone. Be specific — role, industry, income, impact, lifestyle. The clearer the vision the more actionable your plan becomes.`,
        categoryId: cid,
        parentId: career.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      await addTask({
        title: "Identify skills to develop",
        type: "task",
        description: `What skills, certifications, or experiences stand between where you are now and where you want to be? List them here and turn each into a project with steps.`,
        categoryId: cid,
        parentId: career.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      await addTask({
        title: "Build your professional network",
        type: "task",
        description: `Relationships are often the fastest path to career growth. Add key professional contacts to your Inner Circle in the People tab — and set reminders to stay in touch consistently.`,
        categoryId: cid,
        parentId: career.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      await addTask({
        title: "Schedule weekly career development time",
        type: "task",
        description: `Growth doesn't happen by accident. Block time on your calendar each week — even 30 minutes — dedicated to learning, networking, or working toward your career goals. Add it as a recurring calendar event so it's always protected.`,
        categoryId: cid,
        parentId: career.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
      await addTask({
        title: "Use Coach to help define and pursue your career goals",
        type: "task",
        description: `Your Work Life Area Coach is one of the most powerful tools for professional clarity and accountability. Here's how to use it:

Option 1 — Coach Assessment:
Open the Work Coach tab and complete your assessment. Coach will ask targeted questions about your career goals, current situation, motivations, and obstacles. From your answers Coach builds a personalized profile and delivers ongoing insights and nudges to keep you moving toward your goals.

To start:
→ Open the Work Life Area
→ Tap the Coach ⚡️ tab
→ Tap Start Assessment
→ Answer 4-6 questions about your career vision and goals
→ Coach generates your profile and begins delivering personalized guidance

Option 2 — Coach Assist:
Tap the ⚡️ icon on this Career Goals entry to open a focused Coach session. Try these prompts:
→ 'Help me define my 5 year career vision'
→ 'Help me build a plan to become a [target role]'
→ 'What skills should I develop to reach my career goals?'
Coach will guide you through the thinking and build a detailed plan directly into your entry hierarchy.

Option 3 — Daily Planning:
Once your career goals are defined, use the Daily Plan Generator to ensure your career development gets time in your actual schedule — not just your intentions.`,
        categoryId: cid,
        parentId: career.id,
        status: "pending",
        priority: "medium",
        assigneeIds: [],
        isPinned: false,
      });
    }
  } catch (error) {
    console.error("[StarterContent] Work seeding failed:", error);
  }
}

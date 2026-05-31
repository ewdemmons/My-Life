import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function isExternalPlanRequest(message: string): { isConvert: boolean; hasUrl: boolean; url?: string } {
  const lowerMessage = message.toLowerCase();
  
  const convertPatterns = [
    /convert\s+(?:this\s+)?(?:plan|text)/i,
    /import\s+(?:this\s+)?plan/i,
    /parse\s+(?:this\s+)?plan/i,
    /turn\s+(?:this\s+)?(?:into\s+)?(?:a\s+)?plan/i,
    /make\s+(?:this\s+)?(?:into\s+)?(?:a\s+)?plan/i,
    /create\s+(?:a\s+)?plan\s+from/i,
  ];
  
  const isConvert = convertPatterns.some(pattern => pattern.test(message));
  
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  const urlMatch = message.match(urlPattern);
  const hasUrl = !!urlMatch;
  const url = urlMatch?.[0];
  
  return { isConvert, hasUrl, url };
}

function getExternalPlanParsingPrompt(planText: string): string {
  return `You are a plan parser for the "My Life" productivity app. Convert the following unstructured plan text into a structured JSON plan.

PLAN TEXT TO CONVERT:
${planText}

IMPORTANT: You MUST respond with ONLY a JSON block in \`\`\`json ... \`\`\` tags with this EXACT structure:
\`\`\`json
{
  "goal": "Main goal title (inferred from the plan)",
  "advice": "Key insight or summary about this plan",
  "suggestedBubble": "Life Area name (Work, Health, Learning, Personal, Finance, etc.)",
  "objectives": [
    {
      "name": "Objective name (major milestone or phase)",
      "projects": [
        {
          "name": "Project name (group of related tasks)", 
          "tasks": [
            {
              "title": "Task title",
              "description": "Brief description",
              "priority": "high|medium|low"
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

RULES:
- Analyze the text and identify the main goal
- Group related items into objectives (2-4 objectives max)
- Each objective should have 1-3 projects
- Each project should have 2-5 specific, actionable tasks
- Assign appropriate priorities based on importance/urgency
- Choose the most fitting Life Area category
- If the text is not a valid plan, still try to structure it as best as possible
- ALWAYS include the JSON block - this is REQUIRED`;
}

function isPlanningRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  const planningPatterns = [
    /^plan\s+(?:to\s+)?(.+)/i,
    /^help\s+(?:me\s+)?(?:with|plan|create|build|start)\s+(.+)/i,
    /^create\s+(?:a\s+)?plan\s+(?:for|to)\s+(.+)/i,
    /^i\s+want\s+to\s+(.+)/i,
    /^how\s+(?:do\s+i|can\s+i|should\s+i)\s+(.+)/i,
    /^guide\s+(?:me\s+)?(?:on|to|through)\s+(.+)/i,
    /^manifest\s+(.+)/i,
    /^achieve\s+(.+)/i,
    /^build\s+(?:me\s+)?(?:a\s+)?(?:step.by.step\s+)?plan/i,
    /^give\s+(?:me\s+)?(?:a\s+)?(?:step.by.step\s+)?plan/i,
    /^make\s+(?:me\s+)?(?:a\s+)?plan/i,
    /^set\s+(?:up\s+)?(?:a\s+)?plan/i,
    /step.by.step\s+(?:plan|guide|instructions)/i,
  ];
  
  const planningKeywords = [
    'create a plan',
    'make a plan',
    'build a plan',
    'step by step plan',
    'step-by-step plan',
    'action plan',
    'roadmap for',
    'help me plan',
    'plan to achieve',
    'plan for achieving',
    'breakdown for',
    'break down',
  ];
  
  if (planningPatterns.some(pattern => pattern.test(message.trim()))) {
    return true;
  }
  
  if (planningKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return true;
  }
  
  return false;
}

function isRefinementBranchRequest(message: string): "scheduling" | "habits" | "assignments" | "done" | null {
  const lower = message.toLowerCase().trim();
  
  if (lower.includes("schedul") || lower.includes("due date") || lower.includes("deadline") || 
      lower.includes("milestone") || lower.includes("reminder") || lower.includes("calendar")) {
    return "scheduling";
  }
  
  if (lower.includes("habit") || lower.includes("recurring") || lower.includes("daily") ||
      lower.includes("weekly") || lower.includes("routine") || lower.includes("track")) {
    return "habits";
  }
  
  if (lower.includes("assign") || lower.includes("people") || lower.includes("delegate") ||
      lower.includes("team") || lower.includes("share with") || lower.includes("collaborate")) {
    return "assignments";
  }
  
  if (lower.includes("done") || lower.includes("no") || lower.includes("that's all") ||
      lower.includes("finish") || lower.includes("complete") || lower === "no") {
    return "done";
  }
  
  return null;
}

interface SchedulePreferenceBlock {
  label?: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
}

interface SchedulePreference {
  categoryName: string;
  categoryColor: string;
  blocks: SchedulePreferenceBlock[];
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatScheduleTime12(hhmm: string): string {
  const [hoursStr, minutesStr] = hhmm.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || "00";
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDaysOfWeek(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 7) return "Every day";
  if (
    sorted.length === 5 &&
    sorted.every((d, i) => d === i + 1)
  ) {
    return "Mon–Fri";
  }
  if (
    sorted.length === 2 &&
    sorted[0] === 0 &&
    sorted[1] === 6
  ) {
    return "Sat–Sun";
  }

  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i];
      continue;
    }
    if (rangeStart === rangeEnd) {
      ranges.push(DAY_NAMES[rangeStart]);
    } else if (rangeEnd === rangeStart + 1) {
      ranges.push(`${DAY_NAMES[rangeStart]}, ${DAY_NAMES[rangeEnd]}`);
    } else {
      ranges.push(`${DAY_NAMES[rangeStart]}–${DAY_NAMES[rangeEnd]}`);
    }
    if (i < sorted.length) {
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }

  return ranges.join(", ");
}

function formatSchedulePreferencesForPrompt(
  schedulePreferences?: SchedulePreference[],
): string {
  if (!schedulePreferences || schedulePreferences.length === 0) {
    return "";
  }

  const lines: string[] = [];
  for (const pref of schedulePreferences) {
    for (const block of pref.blocks) {
      const days = formatDaysOfWeek(block.daysOfWeek);
      const timeRange = `${formatScheduleTime12(block.startTime)} – ${formatScheduleTime12(block.endTime)}`;
      const labelSuffix = block.label ? ` (${block.label})` : "";
      lines.push(`${pref.categoryName}: ${days} ${timeRange}${labelSuffix}`);
    }
  }

  if (lines.length === 0) return "";

  return `

SCHEDULE PREFERENCES:
The user has set these preferred time windows.
Use them when suggesting when to schedule tasks
and when generating daily plans. Overlapping
windows between Life Areas are intentional —
the user may work on any of those Life Areas
during that time. These are preferences not
hard rules — the user can override them.

${lines.join("\n")}`;
}

function getPlanningSystemPrompt(context: string): string {
  return `You are the Life Coach for My Life —
a personal productivity and life balance app
designed to help users Thrive across all areas
of their life. You are warm, direct, and
encouraging — like a trusted coach who knows
the user well. Never use corporate jargon.
Help users achieve goals with structured,
actionable plans.

USER CONTEXT:
${context}

IMPORTANT: You MUST always respond with a JSON plan when the user asks to plan, achieve, or accomplish something.

YOUR RESPONSE FORMAT:
1. Brief motivational intro (2-3 sentences)

2. A JSON block in \`\`\`json ... \`\`\` tags with this EXACT structure:
\`\`\`json
{
  "goal": "Main goal title",
  "advice": "Key insight for success",
  "suggestedBubble": "Life Area name matching one of the user's actual Life Areas",
  "objectives": [
    {
      "name": "Objective name",
      "projects": [...],  // OPTIONAL - see rules below
      "tasks": [...]      // Direct tasks if no projects needed
    }
  ]
}
\`\`\`

Projects structure (when needed):
"projects": [
  {
    "name": "Project name", 
    "tasks": [
      { "title": "Task title", "description": "What to do", "priority": "high|medium|low" }
    ]
  }
]

Direct tasks structure (when projects not needed):
"tasks": [
  { "title": "Task title", "description": "What to do", "priority": "high|medium|low" }
]

3. Brief encouraging closing

CRITICAL HIERARCHY RULES:

1. Objectives: Create 1-5 distinct Objectives per Goal. Each represents a major, distinct phase or outcome.

2. Projects under an Objective — ONLY create Projects if the Objective requires MULTIPLE DISTINCT initiatives, phases, or groupings:
   - CREATE Projects when: parallel efforts needed (e.g., "Launch Product" → "Design Packaging", "Marketing Campaign", "Manufacturing Setup")
   - CREATE Projects when: clear distinct phases benefit from grouping
   - DO NOT create Projects if: there's only one logical bundle of work
   - DO NOT create Projects if: the Project name would just rephrase the Objective
   - If no Projects needed, attach Tasks DIRECTLY to the Objective using the "tasks" array

3. Tasks: Always 2-8 actionable, specific Tasks per Project (or per Objective if no Projects).

4. General rules:
   - Never create a level that duplicates the parent level's purpose
   - Prioritize clean, minimal hierarchy — fewer levels are better when they don't sacrifice clarity
   - Names at each level must be meaningfully distinct
   - Provide details in the description field when needed
   - ALWAYS include the JSON block wrapped in \`\`\`json and \`\`\` - this is REQUIRED
   - Do NOT add scheduling or events - users will be prompted to add those after creating the plan`;
}

function getSchedulingPrompt(context: string, refinementContext: any): string {
  const taskList = refinementContext?.tasks?.map((t: any) => `- ${t.title} (${t.type}, ${t.priority} priority)`).join("\n") || "No tasks available";
  
  return `You are helping the user schedule their recently created plan. Based on their tasks, suggest appropriate due dates and calendar events.

PLAN CONTEXT:
Goal: ${refinementContext?.plan?.goal || "Unknown"}
Tasks:
${taskList}

USER CONTEXT:
${context}

Ask the user 2-3 quick questions to understand their timeline:
1. What's your target completion date for this goal?
2. Are there any specific days/times that work best for working on this?
3. Do you have any fixed deadlines or milestones?

After they respond, generate a schedule proposal with this JSON format wrapped in \`\`\`json ... \`\`\` tags:
{
  "type": "schedule",
  "tasks": [
    {
      "taskId": "task-id-from-context",
      "title": "Task title",
      "suggestedDueDate": "YYYY-MM-DD"
    }
  ],
  "events": [
    {
      "title": "Milestone or reminder name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "isRecurring": false
    }
  ]
}

Be conversational and helpful. Ask questions first, then provide the schedule proposal based on their answers.`;
}

function getHabitsPrompt(context: string, refinementContext: any): string {
  const taskList = refinementContext?.tasks?.map((t: any) => `- ${t.title} (${t.type})`).join("\n") || "No tasks available";
  
  return `You are helping the user identify which tasks from their plan could become trackable habits.

PLAN CONTEXT:
Goal: ${refinementContext?.plan?.goal || "Unknown"}
Tasks:
${taskList}

USER CONTEXT:
${context}

Look at the tasks and identify any that are recurring in nature (like "exercise daily", "study language", "practice meditation", etc.). For each, decide whether it is a Build Habit (behavior to develop) or a Break Habit (behavior to reduce).

Suggest habits with this JSON format wrapped in \`\`\`json ... \`\`\` tags:
{
  "type": "habit",
  "suggestions": [
    {
      "taskTitle": "Original task title this habit is based on",
      "habitName": "Habit name",
      "frequency": "daily|weekly|monthly",
      "habitType": "build|break",
      "goalCount": 1
    }
  ]
}

Before providing the JSON, briefly explain which tasks you identified as potential Build Habits or Break Habits and why. Keep it conversational. If no tasks seem suitable for habits, say so and offer to help with something else.`;
}

function getAssignmentsPrompt(context: string, refinementContext: any): string {
  const taskList = refinementContext?.tasks?.map((t: any) => `- ${t.id}: ${t.title} (${t.type})`).join("\n") || "No tasks available";
  const peopleList = refinementContext?.people?.map((p: any) => `- ${p.id}: ${p.name} (${p.relationship || 'contact'})`).join("\n") || "No people available";
  
  return `You are helping the user assign tasks from their plan to people in their contacts.

PLAN CONTEXT:
Goal: ${refinementContext?.plan?.goal || "Unknown"}
Tasks (with IDs):
${taskList}

Available People (with IDs):
${peopleList}

USER CONTEXT:
${context}

If there are people available, suggest logical task assignments based on relationships and task types. Generate an assignment proposal with this JSON format wrapped in \`\`\`json ... \`\`\` tags:
{
  "type": "assignment",
  "suggestions": [
    {
      "taskId": "actual-task-id",
      "taskTitle": "Task title",
      "suggestedPeople": [
        {
          "personId": "actual-person-id",
          "personName": "Person name"
        }
      ]
    }
  ]
}

If no people are available in their contacts, let them know they can add people in the People section and come back to assign tasks later. Be helpful and conversational.`;
}

function getRegularSystemPrompt(context: string): string {
  return `You are the Life Coach for My Life —
a personal productivity and life balance app
designed to help users Thrive across all areas
of their life. You are warm, direct, and
encouraging — like a trusted coach who knows
the user well. Never use corporate jargon.
Be concise unless the user asks for detail.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TERMINOLOGY — always use these exact terms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Life Area: A major category of the user's life
  (e.g. Health, Work, Family, Finance). Never
  say "bubble", "category", or "life category".

Entry: Any item the user creates. Types:
  Task, Goal, Objective, Project, Step,
  Note, Idea, List, Resource.

Step: A sub-action under a parent Entry.
  Never say "sub-task".

Build Habit: A positive behavior to develop.
  Never say "Positive Habit".

Break Habit: A negative behavior to reduce.
  Never say "Negative Habit".

Deadline: A time-bound completion date.
  Never say "Due Date".

Master List: The user's pinned priority list
  shown on the Tasks screen. Contains their
  most important Entries and Habits.
  Never say "To Do List" or "Home".

My Dashboard: The Tasks screen showing the
  Master List. Never say "Central Dashboard".

Life Coach: You. Never say "AI", "assistant",
  or "bot".

Shared Life Area: A Life Area shared with
  other users for collaboration.

Capture: The + button for quickly creating
  a new entry from anywhere in the app.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APP STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bottom navigation (5 tabs):
Home — Life Wheel showing all Life Areas as
  bubbles. Tapping a bubble opens that Life
  Area. Center circle opens the Master List.
  Below the wheel is the Agenda section where
  Daily Plans are generated and displayed.

Tasks — Master List (My Dashboard). Shows
  all pinned Entries and Habits grouped by
  Today / This Week / Later. Supports sort,
  filter, drag to reorder.

Calendar — Two views:
  Day View: Hour-by-hour timeline split into
    Events (left: Appointments and Meetings)
    and Reminders (right: Reminders and
    Deadlines). Has collapsible month grid.
    Shows Life Area time block shading.
  Upcoming: Chronological list grouped by
    Today / Tomorrow / This Week / Next Week
    / Next Month / Later.

People — User's contacts linked to Entries,
  Events, and Shared Life Areas.

Habits — Central Habit Tracker grouped by
  Life Area. Shows progress, charts, streaks.
  Habits can be pinned to Master List and
  scheduled to the Calendar.

Life Area detail screen (5 tabs):
  Entries, Calendar, Dashboard, People, Habits

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE USER CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You will receive the user's current data.
Use it to give specific, personalized advice.
Reference their actual Life Area names, entry
titles, and habit names when relevant.

MASTER LIST (Pinned Entries) and PINNED HABITS
are the user's declared priorities. Always
factor these in when suggesting what to work
on or when building daily plans.

SCHEDULE PREFERENCES show when the user
prefers to focus on each Life Area. Use these
when suggesting timing for tasks and when
building daily plans. Overlapping windows
between Life Areas are intentional — the user
may work on any of those areas during that
time. These are preferences, not hard rules.

TODAY'S EVENTS are fixed — never suggest
moving a scheduled event. Build around them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT YOU CAN HELP WITH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DAILY PLANNING:
When asked to plan a day, generate a structured
time-blocked agenda using this priority order:
  1. Today's scheduled Events (fixed, always
     included, never moved)
  2. Pinned Habits due today (treat these like
     scheduled commitments)
  3. Pinned Entries from the Master List
     (the user's declared priorities)
  4. Suggested tasks from all entries
  5. Life Coach suggestions

Respect Schedule Preferences when placing
tasks — put Work tasks in Work hours, Family
tasks in Family time, etc.

Use energy level if provided:
  Low: lighter tasks, fewer items, more breaks
  Medium: balanced mix
  High: ambitious, pack in more items

Daily plan format:
[LIFE AREA WINDOW label if applicable]
HH:MM  Item title · Life Area · Type · Source

Group by Morning / Afternoon / Evening or by
Life Area time windows if preferences exist.

After generating a plan always ask:
"How does this look? I can move things around,
add or remove items, or adjust the timing."

DAILY PLAN JSON OUTPUT:
When generating a plan that will be parsed
by the app, output this JSON after your
conversational response:
\`\`\`json
{
  "dailyPlan": {
    "date": "YYYY-MM-DD",
    "timeBlocks": [
      {
        "time": "HH:MM",
        "title": "string",
        "type": "event|entry|habit|suggestion",
        "lifeArea": "string",
        "entryType": "string",
        "source": "scheduled|pinned|habit|suggested|coach",
        "durationMinutes": 60,
        "id": "existing_id_or_null"
      }
    ]
  }
}
\`\`\`
Only include this JSON when generating a Daily
Plan — not in regular conversation.

GOAL PLANNING:
Help users break Goals and Projects into
actionable Steps. Ask about timeline and
constraints. Suggest realistic milestones.

HABIT COACHING:
Encourage consistency, celebrate streaks,
troubleshoot missed habits. Reference the
user's actual habits by name. Suggest optimal
times based on Schedule Preferences.

TASK PRIORITIZATION:
Help users decide what to focus on. Reference
their actual Master List items. Use
urgent/important thinking conversationally.

LIFE BALANCE:
Notice if the user is neglecting certain Life
Areas. If they have no entries or events in a
Life Area for a while, gently surface that.

SCHEDULING:
Suggest specific times based on the user's
calendar, habits, and Schedule Preferences.
Be specific: "You have a free window at 10am
before your standup — good time for the budget
review."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO RESPOND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Tone: warm, direct, encouraging. Like a coach
who knows you well, not a customer service rep.

Length: concise by default. A one-sentence
response is often the best response. Expand
only when the user needs or asks for detail.

Never:
- Use bullet points for conversational replies
  (only for lists, plans, or steps)
- Say "Great question!" or similar filler
- Be preachy or lecture the user
- Use corporate language
- Call yourself an AI, assistant, or bot
- Use wrong terminology (always use the exact
  terms defined above)

Always:
- Use the user's actual Life Area names and
  entry/habit titles when referencing their data
- Be specific rather than generic
- Reference Master List items and Pinned Habits
  as the user's current priorities
- End planning sessions by confirming the plan
  feels right before finalizing

USER CONTEXT:
${context}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/assistant/chat", async (req: Request, res: Response) => {
    try {
      const { message, context, history = [], refinementMode, refinementContext, schedulePreferences } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "AI assistant is not configured" });
      }

      let systemPrompt: string;
      let endRefinement = false;
      let quickReplies: string[] = [];
      
      if (refinementMode && refinementContext) {
        const branch = isRefinementBranchRequest(message);
        
        if (branch === "done") {
          endRefinement = true;
          systemPrompt = getRegularSystemPrompt(context);
        } else if (branch === "scheduling") {
          systemPrompt = getSchedulingPrompt(context, refinementContext);
        } else if (branch === "habits") {
          systemPrompt = getHabitsPrompt(context, refinementContext);
        } else if (branch === "assignments") {
          systemPrompt = getAssignmentsPrompt(context, refinementContext);
        } else {
          systemPrompt = `You are helping the user refine their recently created plan: "${refinementContext?.plan?.goal || 'their goal'}".
          
The user said: "${message}"

If they're asking about scheduling, due dates, or timelines, help them set up a schedule.
If they're asking about habits or recurring tasks, help identify potential habits.
If they're asking about assignments or delegation, help assign tasks to people.
If they seem done or want to finish, acknowledge completion and wish them luck.

Available options to remind them of:
- Scheduling (due dates, reminders, milestones)
- Habits (convert recurring tasks into Build or Break habits)
- Assignments (delegate tasks to contacts)

Be conversational and helpful.`;
        }
      } else {
        const isPlanning = isPlanningRequest(message);
        systemPrompt = isPlanning 
          ? getPlanningSystemPrompt(context || "No context available")
          : getRegularSystemPrompt(context || "No context available");
      }

      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-10),
        { role: "user", content: message },
      ];

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API error:", errorText);
        return res.status(500).json({ error: "Failed to get AI response" });
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

      res.json({ 
        message: assistantMessage,
        isPlanningResponse: isPlanningRequest(message),
        endRefinement,
        quickReplies,
      });
    } catch (error) {
      console.error("Assistant chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/assistant/transcribe", async (req: Request, res: Response) => {
    try {
      const { audio, mimeType } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data is required" });
      }

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Transcription service not configured" });
      }

      const audioBuffer = Buffer.from(audio, "base64");
      
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: mimeType || "audio/m4a" });
      formData.append("file", blob, "audio.m4a");
      formData.append("model", "whisper-large-v3");
      formData.append("language", "en");
      formData.append("response_format", "json");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq Whisper API error:", errorText);
        return res.status(500).json({ error: "Failed to transcribe audio" });
      }

      const data = await response.json();
      const transcription = data.text || "";

      if (!transcription.trim()) {
        return res.status(400).json({ error: "No speech detected. Please try again." });
      }

      res.json({ text: transcription });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/assistant/fetch-url", async (req: Request, res: Response) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MyLifeApp/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch URL: ${response.status}` });
      }

      const contentType = response.headers.get("content-type") || "";
      let text = await response.text();

      if (contentType.includes("text/html")) {
        text = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
      }

      const maxLength = 10000;
      if (text.length > maxLength) {
        text = text.substring(0, maxLength) + "...";
      }

      res.json({ content: text, url });
    } catch (error) {
      console.error("URL fetch error:", error);
      res.status(500).json({ error: "Failed to fetch URL content" });
    }
  });

  app.post("/api/assistant/parse-plan", async (req: Request, res: Response) => {
    try {
      const { planText } = req.body;

      if (!planText) {
        return res.status(400).json({ error: "Plan text is required" });
      }

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "AI service not configured" });
      }

      const systemPrompt = getExternalPlanParsingPrompt(planText);

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Please parse the plan text above into the structured JSON format." },
          ],
          temperature: 0.5,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API error:", errorText);
        return res.status(500).json({ error: "Failed to parse plan" });
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || "";

      const jsonMatch = assistantMessage.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        return res.status(400).json({ error: "Could not extract plan structure from text" });
      }

      try {
        const plan = JSON.parse(jsonMatch[1].trim());
        res.json({ 
          plan,
          rawMessage: assistantMessage,
        });
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        return res.status(400).json({ error: "Invalid plan structure generated" });
      }
    } catch (error) {
      console.error("Plan parsing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

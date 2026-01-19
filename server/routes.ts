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
  "suggestedBubble": "Life Bubble name (Work, Health, Learning, Personal, Finance, etc.)",
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
- Choose the most fitting Life Bubble category
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

function getPlanningSystemPrompt(context: string): string {
  return `You are a life coach for the "My Life" productivity app. Help users achieve goals with structured, actionable plans.

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
  "suggestedBubble": "Life Bubble name (Work, Health, Learning, etc.)",
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

Look at the tasks and identify any that are recurring in nature (like "exercise daily", "study language", "practice meditation", etc.).

Suggest habits with this JSON format wrapped in \`\`\`json ... \`\`\` tags:
{
  "type": "habit",
  "suggestions": [
    {
      "taskTitle": "Original task title this habit is based on",
      "habitName": "Habit name",
      "frequency": "daily|weekly|monthly",
      "habitType": "positive|negative",
      "goalCount": 1
    }
  ]
}

Before providing the JSON, briefly explain which tasks you identified as potential habits and why. Keep it conversational. If no tasks seem suitable for habits, say so and offer to help with something else.`;
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
  return `You are a helpful assistant for My Life app - a productivity app that helps users organize their lives through Life Bubbles (categories), tasks, events, habits, and people management.

When providing advice, be concise, friendly, and actionable. Use the app context when relevant to give personalized suggestions.

Current app context: ${context || "No context available"}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/assistant/chat", async (req: Request, res: Response) => {
    try {
      const { message, context, history = [], refinementMode, refinementContext } = req.body;

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
- Habits (convert recurring tasks to trackable habits)
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

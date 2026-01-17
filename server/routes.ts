import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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
  return `You are an expert life coach and productivity assistant for the "My Life" app. Your role is to help users achieve their goals by creating actionable, hierarchical plans.

The app organizes life into:
- Life Bubbles (categories like Work, Health, Family, Finance, etc.)
- Hierarchical entries: Goals → Objectives → Projects → Tasks → Sub-tasks
- Also supports: Ideas, Lists, Items, Resources, Appointments

CURRENT USER CONTEXT:
${context}

When the user asks you to plan something or help achieve a goal, you MUST respond with:

1. A brief personalized advice section (2-3 sentences acknowledging their situation and providing motivation)

2. A structured JSON plan block wrapped in \`\`\`json ... \`\`\` tags with this EXACT format:
{
  "goal": "The main goal title",
  "advice": "Personalized insights based on their current situation...",
  "suggestedBubble": "The best matching Life Bubble name from their existing bubbles, or suggest a new one",
  "objectives": [
    {
      "name": "Objective name",
      "projects": [
        {
          "name": "Project name",
          "tasks": [
            {
              "title": "Task title",
              "description": "Brief description of what to do",
              "priority": "high|medium|low",
              "dueOffset": 7
            }
          ]
        }
      ]
    }
  ]
}

RULES:
- dueOffset is days from today (e.g., 7 = one week from now)
- Match suggestedBubble to user's existing bubbles when possible
- Keep tasks specific and actionable
- Create 2-4 objectives with 1-2 projects each
- Each project should have 2-5 tasks
- Prioritize tasks appropriately (first steps should be high priority)
- Consider user's existing commitments from context

After the JSON, add a brief encouraging closing message.`;
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

  const httpServer = createServer(app);

  return httpServer;
}

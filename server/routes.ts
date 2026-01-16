import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function isPlanningRequest(message: string): boolean {
  const planningPatterns = [
    /^plan\s+(?:to\s+)?(.+)/i,
    /^help\s+(?:me\s+)?(?:with|plan|create|build|start)\s+(.+)/i,
    /^create\s+(?:a\s+)?plan\s+(?:for|to)\s+(.+)/i,
    /^i\s+want\s+to\s+(.+)/i,
    /^how\s+(?:do\s+i|can\s+i|should\s+i)\s+(.+)/i,
    /^guide\s+(?:me\s+)?(?:on|to|through)\s+(.+)/i,
    /^manifest\s+(.+)/i,
    /^achieve\s+(.+)/i,
  ];
  
  return planningPatterns.some(pattern => pattern.test(message.trim()));
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

function getRegularSystemPrompt(context: string): string {
  return `You are a helpful assistant for My Life app - a productivity app that helps users organize their lives through Life Bubbles (categories), tasks, events, habits, and people management.

When providing advice, be concise, friendly, and actionable. Use the app context when relevant to give personalized suggestions.

Current app context: ${context || "No context available"}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/assistant/chat", async (req: Request, res: Response) => {
    try {
      const { message, context, history = [] } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "AI assistant is not configured" });
      }

      const isPlanning = isPlanningRequest(message);
      const systemPrompt = isPlanning 
        ? getPlanningSystemPrompt(context || "No context available")
        : getRegularSystemPrompt(context || "No context available");

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
          temperature: isPlanning ? 0.6 : 0.7,
          max_tokens: isPlanning ? 2048 : 1024,
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
        isPlanningResponse: isPlanning,
      });
    } catch (error) {
      console.error("Assistant chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

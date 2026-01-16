import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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

      const systemPrompt = `You are a helpful assistant for My Life app - a productivity app that helps users organize their lives through Life Bubbles (categories), tasks, events, habits, and people management.

When providing advice, be concise, friendly, and actionable. Use the app context when relevant to give personalized suggestions.

Current app context: ${context || "No context available"}`;

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
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API error:", errorText);
        return res.status(500).json({ error: "Failed to get AI response" });
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

      res.json({ message: assistantMessage });
    } catch (error) {
      console.error("Assistant chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

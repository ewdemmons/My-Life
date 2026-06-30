import { getLifeAreaInsightsPrompt } from "@/lib/systemPrompts";
import { validateInsights } from "@/lib/validateInsightAction";
import type { CoachInsight } from "@/types";
import type { LifeAreaInsightsContext } from "@/lib/lifeAreaInsightsContext";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const LIFE_AREA_INSIGHTS_TOOL = {
  name: "life_area_insights",
  description: "Return 2–4 Coach insights for this Life Area.",
  input_schema: {
    type: "object",
    properties: {
      insights: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "positive_trend",
                "gap_or_drop_off",
                "accountability_nudge",
                "sparse_area_prompt",
                "detail_planning_suggestion",
                "daily_planning_tie_in",
              ],
            },
            text: { type: "string" },
            action: {
              type: "object",
              properties: {
                actionType: {
                  type: "string",
                  enum: ["command", "navigate_chat", "navigate_plan_generator"],
                },
                label: { type: "string" },
                command: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: [
                        "createEntry",
                        "scheduleEvent",
                        "createHabit",
                        "logHabit",
                        "pinEntry",
                        "completeEntry",
                      ],
                    },
                    input: { type: "object" },
                  },
                  required: ["type", "input"],
                },
                initialPrompt: { type: "string" },
                openPlanningSession: { type: "boolean" },
                initialDate: { type: "string" },
              },
              required: ["actionType", "label"],
            },
            relatedEntryIds: {
              type: "array",
              items: { type: "string" },
            },
            relatedHabitIds: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["type", "text"],
        },
      },
    },
    required: ["insights"],
  },
};

function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Anthropic API key is not configured. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in your .env file.",
    );
  }
  return apiKey;
}

export async function generateLifeAreaInsights(
  lifeAreaName: string,
  insightsContext: LifeAreaInsightsContext,
): Promise<CoachInsight[]> {
  const systemPrompt = getLifeAreaInsightsPrompt(lifeAreaName);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analyze this Life Area data and generate insights:\n\n${insightsContext.contextText}`,
        },
      ],
      tools: [LIFE_AREA_INSIGHTS_TOOL],
      tool_choice: { type: "tool", name: LIFE_AREA_INSIGHTS_TOOL.name },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Anthropic API error (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const data = await response.json();
  const toolUse = data.content?.find(
    (block: { type: string }) => block.type === "tool_use",
  );

  if (!toolUse?.input) {
    throw new Error("Anthropic API did not return insights");
  }

  const parsed = toolUse.input as { insights?: unknown[] };
  const rawInsights = Array.isArray(parsed.insights) ? parsed.insights : [];

  return validateInsights(
    rawInsights,
    insightsContext.knownHabitIds,
    insightsContext.knownTaskIds,
  );
}

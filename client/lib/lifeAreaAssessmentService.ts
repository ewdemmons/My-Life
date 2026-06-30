import {
  getLifeAreaAssessmentPrompt,
  getLifeAreaProfileSynthesisPrompt,
} from "@/lib/systemPrompts";
import type { AssessmentQAPair, LifeAreaProfileSynthesis } from "@/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const MAX_QUESTIONS = 6;
const MIN_QUESTIONS = 4;

const ASSESSMENT_TURN_TOOL = {
  name: "assessment_turn",
  description: "Provide the next assessment question or signal completion.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["continue", "complete"],
      },
      question: {
        type: ["string", "null"],
        description: "The next question to ask, or null if status is complete",
      },
      closingMessage: {
        type: "string",
        description: "Brief warm closing message, only used when status is complete",
      },
    },
    required: ["status"],
  },
};

const PROFILE_SYNTHESIS_TOOL = {
  name: "profile_synthesis",
  description:
    "Return the structured Life Area profile synthesized from the assessment conversation.",
  input_schema: {
    type: "object",
    properties: {
      primaryGoal: { type: "string" },
      currentFocus: { type: "array", items: { type: "string" } },
      knownObstacles: { type: "array", items: { type: "string" } },
      currentState: { type: "string" },
      motivations: { type: "string" },
      successCriteria: { type: "string" },
    },
    required: [
      "primaryGoal",
      "currentFocus",
      "knownObstacles",
      "currentState",
      "motivations",
      "successCriteria",
    ],
  },
};

export type AssessmentTurnResult =
  | {
      status: "continue";
      question: string;
    }
  | {
      status: "complete";
      closingMessage: string;
    };

type ChatMessage = { role: "user" | "assistant"; content: string };

type AssessmentTool = {
  name: string;
  description: string;
  input_schema: object;
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

function buildHistoryFromAnswers(rawAnswers: AssessmentQAPair[]): Array<{ role: "user" | "assistant"; content: string }> {
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const pair of rawAnswers) {
    history.push({ role: "assistant", content: pair.question });
    history.push({ role: "user", content: pair.answer });
  }
  return history;
}

async function fetchToolResponse(
  system: string,
  messages: ChatMessage[],
  tool: AssessmentTool,
  maxTokens: number,
): Promise<Record<string, unknown>> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
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
    throw new Error("Anthropic API did not return a tool_use response");
  }

  return toolUse.input as Record<string, unknown>;
}

export async function askAssessmentQuestion(params: {
  lifeAreaName: string;
  lifeAreaDescription: string;
  rawAnswers: AssessmentQAPair[];
}): Promise<AssessmentTurnResult> {
  const questionCount = params.rawAnswers.length;

  if (questionCount >= MAX_QUESTIONS) {
    return {
      status: "complete",
      closingMessage: "Thanks — I have a clear picture. Building your profile...",
    };
  }

  const history = buildHistoryFromAnswers(params.rawAnswers);
  const systemPrompt = getLifeAreaAssessmentPrompt(
    params.lifeAreaName,
    params.lifeAreaDescription,
    questionCount,
  );

  const parsed = (await fetchToolResponse(
    systemPrompt,
    [
      ...history,
      {
        role: "user",
        content:
          questionCount === 0
            ? "Begin the assessment. Ask your first question."
            : "Ask your next question based on my answers so far.",
      },
    ],
    ASSESSMENT_TURN_TOOL,
    512,
  )) as {
    status?: string;
    question?: string | null;
    closingMessage?: string;
  };

  if (
    parsed.status === "complete" ||
    (questionCount >= MIN_QUESTIONS && parsed.status !== "continue")
  ) {
    return {
      status: "complete",
      closingMessage:
        parsed.closingMessage?.trim() ||
        "Thanks — I have a clear picture. Building your profile...",
    };
  }

  const question = parsed.question?.trim();
  if (!question) {
    throw new Error("Assessment response missing question");
  }

  return { status: "continue", question };
}

export async function generateLifeAreaProfile(
  rawAnswers: AssessmentQAPair[],
  lifeAreaName: string,
  lifeAreaDescription?: string,
): Promise<LifeAreaProfileSynthesis | null> {
  const transcript = rawAnswers
    .map(
      (pair, index) =>
        `Q${index + 1}: ${pair.question}\nA${index + 1}: ${pair.answer}`,
    )
    .join("\n\n");

  const systemPrompt = getLifeAreaProfileSynthesisPrompt(
    lifeAreaName,
    lifeAreaDescription ?? "",
  );

  try {
    const parsed = (await fetchToolResponse(
      systemPrompt,
      [{ role: "user", content: transcript }],
      PROFILE_SYNTHESIS_TOOL,
      1500,
    )) as Partial<LifeAreaProfileSynthesis>;

    return {
      primaryGoal: parsed.primaryGoal?.trim() || "",
      currentFocus: Array.isArray(parsed.currentFocus)
        ? parsed.currentFocus.map((s) => String(s).trim()).filter(Boolean)
        : [],
      knownObstacles: Array.isArray(parsed.knownObstacles)
        ? parsed.knownObstacles.map((s) => String(s).trim()).filter(Boolean)
        : [],
      currentState: parsed.currentState?.trim() || "",
      motivations: parsed.motivations?.trim() || "",
      successCriteria: parsed.successCriteria?.trim() || "",
    };
  } catch (error) {
    console.error("Profile synthesis failed:", error);
    return null;
  }
}

export { MAX_QUESTIONS, MIN_QUESTIONS };

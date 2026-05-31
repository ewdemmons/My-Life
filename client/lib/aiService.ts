const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type ChatRole = "user" | "assistant";

function normalizeHistory(
  history: Array<{ role: string; content: string }>,
): Array<{ role: ChatRole; content: string }> {
  const filtered = history.filter(
    (m) => m.role === "user" || m.role === "assistant",
  ) as Array<{ role: ChatRole; content: string }>;

  const merged: Array<{ role: ChatRole; content: string }> = [];
  for (const msg of filtered) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content = `${last.content}\n\n${msg.content}`;
    } else {
      merged.push({ role: msg.role, content: msg.content });
    }
  }

  let start = 0;
  while (start < merged.length && merged[start].role !== "user") {
    start++;
  }
  return merged.slice(start);
}

export function isPlanningRequest(message: string): boolean {
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

export function isRefinementBranchRequest(message: string): "scheduling" | "habits" | "assignments" | "done" | null {
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

export async function sendToAI(params: {
  message: string;
  context: string;
  history: Array<{ role: string; content: string }>;
  systemPrompt: string;
}): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Anthropic API key is not configured. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in your .env file.",
    );
  }

  const normalizedHistory = normalizeHistory(params.history);
  const messages: Array<{ role: ChatRole; content: string }> = [
    ...normalizedHistory,
    { role: "user", content: params.message },
  ];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: params.systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Anthropic API error (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error("Anthropic API returned an empty response");
  }

  return text;
}

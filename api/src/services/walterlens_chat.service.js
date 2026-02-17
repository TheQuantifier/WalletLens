// src/services/walterlens_chat.service.js
import env from "../config/env.js";
import { GoogleGenAI } from "@google/genai";

const USE_GEMINI = (env.aiProvider || "gemini").toLowerCase() === "gemini";
const MAX_CHARS = Number(env.aiMaxChars || 5000);

const SYSTEM_PROMPT = `
You are WalterLens, a helpful financial insights assistant.

Rules:
- Provide general budgeting insights only.
- Do NOT provide legal or tax advice. If the user asks about legal/tax topics, refuse politely.
- Never instruct the user to reduce essential categories like rent or groceries.
- If an action modifies data (create/update/delete), ALWAYS require confirmation.
- Output JSON ONLY in the exact schema below. No markdown, no extra text.

Schema:
{
  "reply": "",
  "intent": "insight|list|create|edit|delete|unknown|refusal",
  "action": {
    "kind": "create|update|delete",
    "id": "",
    "updates": {},
    "payload": {}
  },
  "actionSummary": "",
  "requiresConfirmation": false
}
`;

function sanitizeContext(context) {
  if (!context || typeof context !== "object") return {};
  return {
    totals: context.totals || undefined,
    topCategories: Array.isArray(context.topCategories) ? context.topCategories.slice(0, 5) : undefined,
    dateRange: context.dateRange || undefined,
    currencyNote: context.currencyNote || undefined,
  };
}

async function extractTextFromResponse(response) {
  if (typeof response?.text === "function") {
    return await response.text();
  }

  try {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const textPart = parts.find((p) => p?.text);
      if (textPart?.text) return textPart.text;
    }
  } catch (err) {
    console.warn("⚠️ Could not read Gemini response:", err);
  }

  return "";
}

function extractJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1).trim());
  } catch {
    return null;
  }
}

function normalizeResponse(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const action = parsed.action && typeof parsed.action === "object" ? parsed.action : {};
  return {
    reply: String(parsed.reply || "").trim(),
    intent: String(parsed.intent || "unknown"),
    action: {
      kind: action.kind || "",
      id: action.id ? String(action.id) : "",
      updates: action.updates && typeof action.updates === "object" ? action.updates : {},
      payload: action.payload && typeof action.payload === "object" ? action.payload : {},
    },
    actionSummary: String(parsed.actionSummary || "").trim(),
    requiresConfirmation: Boolean(parsed.requiresConfirmation),
  };
}

export async function runWalterLensChat({ message, context }) {
  if (!USE_GEMINI || !env.aiApiKey) {
    return {
      reply:
        "AI chat is not configured yet. I can still help with basic insights and record edits.",
      intent: "unknown",
      action: { kind: "", id: "", updates: {}, payload: {} },
      actionSummary: "",
      requiresConfirmation: false,
    };
  }

  let safeMessage = message;
  if (safeMessage.length > MAX_CHARS) {
    safeMessage = safeMessage.slice(0, MAX_CHARS);
  }

  const ai = new GoogleGenAI({ apiKey: env.aiApiKey });
  const modelName = env.aiModel || "gemini-2.5-flash";

  const contents = [
    { role: "system", text: SYSTEM_PROMPT },
    {
      role: "user",
      text: JSON.stringify({
        message: safeMessage,
        context: sanitizeContext(context),
      }),
    },
  ];

  const response = await ai.models.generateContent({ model: modelName, contents });
  const raw = await extractTextFromResponse(response);
  const parsed = extractJson(raw);
  const normalized = normalizeResponse(parsed);

  if (!normalized) {
    return {
      reply: "I couldn't parse that. Try asking in a different way.",
      intent: "unknown",
      action: { kind: "", id: "", updates: {}, payload: {} },
      actionSummary: "",
      requiresConfirmation: false,
    };
  }

  if (normalized.action?.kind) {
    normalized.requiresConfirmation = true;
  }

  return normalized;
}

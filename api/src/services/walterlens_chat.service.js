// src/services/walterlens_chat.service.js
import env from "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import { isSystemHealthServiceDeactivated } from "./system_health_controls.service.js";

const USE_GEMINI = (env.aiProvider || "gemini").toLowerCase() === "gemini";
const MAX_CHARS = Number(env.aiMaxChars || 5000);
const MAX_REPLY_CHARS = 1200;
const MAX_ACTION_SUMMARY_CHARS = 300;
const MAX_RECORD_CONTEXT = 25;
const MAX_NOTE_CHARS = 240;
const MAX_CATEGORY_CHARS = 80;
const ALLOWED_INTENTS = new Set([
  "insight",
  "list",
  "create",
  "edit",
  "delete",
  "unknown",
  "refusal",
]);
const ALLOWED_ACTION_KINDS = new Set(["create", "update", "delete"]);
const ALLOWED_UPDATE_KEYS = new Set(["type", "amount", "category", "date", "note"]);
const ID_PATTERN = /^[a-f0-9-]{8,}$|^\d+$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  const records = Array.isArray(context.candidateRecords)
    ? context.candidateRecords.slice(0, MAX_RECORD_CONTEXT)
    : [];

  return {
    totals:
      context.totals && typeof context.totals === "object"
        ? {
            expenses: Number(context.totals.expenses) || 0,
            income: Number(context.totals.income) || 0,
            net: Number(context.totals.net) || 0,
          }
        : undefined,
    topCategories: Array.isArray(context.topCategories) ? context.topCategories.slice(0, 5) : undefined,
    dateRange: context.dateRange || undefined,
    currencyNote: context.currencyNote || undefined,
    candidateRecords: records.map((record) => ({
      id: String(record?.id || "").slice(0, 80),
      type: String(record?.type || "").toLowerCase() === "income" ? "income" : "expense",
      amount: Number(record?.amount) || 0,
      category: String(record?.category || "").slice(0, MAX_CATEGORY_CHARS),
      date: String(record?.date || "").slice(0, 30),
      note: String(record?.note || "").slice(0, MAX_NOTE_CHARS),
    })),
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

  try {
    return JSON.parse(raw.trim());
  } catch {
    // continue with partial extraction below
  }

  const candidates = [];
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) candidates.push(codeBlockMatch[1]);

  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        candidates.push(raw.slice(start, i + 1));
        start = -1;
      }
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      // keep trying
    }
  }

  return null;
}

function sanitizeId(value) {
  const id = String(value || "").trim();
  if (!id || id.length > 80) return "";
  return ID_PATTERN.test(id) ? id : "";
}

function sanitizeType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "income" || normalized === "expense") return normalized;
  return "";
}

function sanitizeAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Number(num.toFixed(2));
}

function sanitizeDate(value) {
  const date = String(value || "").trim();
  if (!date) return "";
  return ISO_DATE_PATTERN.test(date) ? date : "";
}

function sanitizeText(value, maxLen) {
  return String(value || "").trim().slice(0, maxLen);
}

function sanitizeCreatePayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  const clean = {};

  const type = sanitizeType(payload.type);
  if (type) clean.type = type;

  const amount = sanitizeAmount(payload.amount);
  if (amount !== null) clean.amount = amount;

  const category = sanitizeText(payload.category, MAX_CATEGORY_CHARS);
  if (category) clean.category = category;

  const date = sanitizeDate(payload.date);
  if (date) clean.date = date;

  const note = sanitizeText(payload.note, MAX_NOTE_CHARS);
  if (note) clean.note = note;

  return clean;
}

function sanitizeUpdates(updates) {
  if (!updates || typeof updates !== "object") return {};
  const clean = {};
  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) continue;
    if (key === "type") {
      const type = sanitizeType(value);
      if (type) clean.type = type;
      continue;
    }
    if (key === "amount") {
      const amount = sanitizeAmount(value);
      if (amount !== null) clean.amount = amount;
      continue;
    }
    if (key === "date") {
      const date = sanitizeDate(value);
      if (date) clean.date = date;
      continue;
    }
    if (key === "category") {
      const category = sanitizeText(value, MAX_CATEGORY_CHARS);
      if (category) clean.category = category;
      continue;
    }
    if (key === "note") {
      const note = sanitizeText(value, MAX_NOTE_CHARS);
      clean.note = note;
    }
  }
  return clean;
}

function sanitizeAction(action) {
  if (!action || typeof action !== "object") {
    return { kind: "", id: "", updates: {}, payload: {} };
  }

  const kind = ALLOWED_ACTION_KINDS.has(action.kind) ? action.kind : "";
  if (!kind) return { kind: "", id: "", updates: {}, payload: {} };

  const sanitized = {
    kind,
    id: "",
    updates: {},
    payload: {},
  };

  if (kind === "delete") {
    sanitized.id = sanitizeId(action.id);
    if (!sanitized.id) return { kind: "", id: "", updates: {}, payload: {} };
    return sanitized;
  }

  if (kind === "update") {
    sanitized.id = sanitizeId(action.id);
    sanitized.updates = sanitizeUpdates(action.updates);
    if (!sanitized.id || !Object.keys(sanitized.updates).length) {
      return { kind: "", id: "", updates: {}, payload: {} };
    }
    return sanitized;
  }

  if (kind === "create") {
    sanitized.payload = sanitizeCreatePayload(action.payload);
    if (
      !sanitized.payload.type ||
      sanitized.payload.amount === undefined ||
      !sanitized.payload.category
    ) {
      return { kind: "", id: "", updates: {}, payload: {} };
    }
    return sanitized;
  }

  return { kind: "", id: "", updates: {}, payload: {} };
}

export function validateWalterLensResponse(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const intent = ALLOWED_INTENTS.has(parsed.intent) ? parsed.intent : "unknown";
  const action = sanitizeAction(parsed.action);
  const hasAction = Boolean(action.kind);

  const reply =
    sanitizeText(parsed.reply, MAX_REPLY_CHARS) ||
    (intent === "refusal"
      ? "I cannot help with legal or tax advice, but I can help with budgeting insights."
      : "");

  const actionSummary = sanitizeText(parsed.actionSummary, MAX_ACTION_SUMMARY_CHARS);

  return {
    reply,
    intent,
    action,
    actionSummary,
    requiresConfirmation: hasAction ? true : Boolean(parsed.requiresConfirmation),
  };
}

function fallbackResponse(reply = "I couldn't parse that. Try asking in a different way.") {
  return {
    reply,
    intent: "unknown",
    action: { kind: "", id: "", updates: {}, payload: {} },
    actionSummary: "",
    requiresConfirmation: false,
  };
}

export async function runWalterLensChat({ message, context }) {
  if (await isSystemHealthServiceDeactivated("ai_provider")) {
    return fallbackResponse(
      "AI chat is disconnected by admin. Please try again later."
    );
  }
  if (!USE_GEMINI || !env.aiApiKey) {
    return fallbackResponse(
      "AI chat is not configured yet. I can still help with basic insights and record edits."
    );
  }

  let safeMessage = String(message || "").trim();
  if (!safeMessage) {
    return fallbackResponse("Please provide a message.");
  }
  if (safeMessage.length > MAX_CHARS) {
    safeMessage = safeMessage.slice(0, MAX_CHARS);
  }

  const ai = new GoogleGenAI({ apiKey: env.aiApiKey });
  const modelName = env.aiChatModel || env.aiModel || "gemini-2.5-flash";

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

  let response = null;
  try {
    response = await ai.models.generateContent({ model: modelName, contents });
  } catch {
    return fallbackResponse("I couldn't reach the AI service. Please try again.");
  }

  const raw = await extractTextFromResponse(response);
  const parsed = extractJson(raw);
  const normalized = validateWalterLensResponse(parsed);

  if (!normalized) {
    return fallbackResponse();
  }

  return normalized;
}

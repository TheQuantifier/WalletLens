// src/services/ai_parser.service.js
import env from "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import { isSystemHealthServiceDeactivated } from "./system_health_controls.service.js";

const MAX_CHARS = Number(env.aiMaxChars || 5000);
const USE_GEMINI = (env.aiProvider || "gemini").toLowerCase() === "gemini";
const MAX_WINDOWS = 3;
const MIN_PARSE_SCORE = 2;

const ALLOWED_PAY_METHODS = new Set([
  "Cash",
  "Check",
  "Credit Card",
  "Debit Card",
  "Gift Card",
  "Multiple",
  "Other",
]);

const ALLOWED_CATEGORIES = new Set([
  "Housing",
  "Utilities",
  "Groceries",
  "Transportation",
  "Dining",
  "Health",
  "Entertainment",
  "Shopping",
  "Membership",
  "Miscellaneous",
  "Education",
  "Giving",
  "Savings",
  "Other",
]);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const PARSE_PROMPT = `
You are a financial receipt extraction system.

From the receipt text, extract ONLY the following fields:

- date: Purchase date in YYYY-MM-DD format
- source: Store or venue name
- subAmount: Subtotal before tax (number)
- amount: Final total charged including tax (number)
- taxAmount: Tax charged (number)
- payMethod: One of:
    Cash, Check, Credit Card, Debit Card, Gift Card, Multiple, Other
- category: Choose ONE expense category from this exact list:
    Housing, Utilities, Groceries, Transportation, Dining, Health, Entertainment,
    Shopping, Membership, Miscellaneous, Education, Giving, Savings, Other
- items: Array of objects [{ "name": string, "price": number }]

Return JSON ONLY in this exact structure:

{
  "date": "",
  "source": "",
  "subAmount": 0,
  "amount": 0,
  "taxAmount": 0,
  "payMethod": "",
  "category": "",
  "items": []
}

No explanations. No markdown. Only JSON.
`;

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
    console.warn("Could not read model response text:", err);
  }

  console.warn("No text found in model response.");
  return "";
}

function extractJson(raw) {
  if (!raw || typeof raw !== "string") return null;

  try {
    return JSON.parse(raw.trim());
  } catch {
    // continue with candidate extraction below
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
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
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

function sanitizeText(value, maxLen) {
  return String(value || "").trim().slice(0, maxLen);
}

function sanitizeAmount(value) {
  const num = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(num) || num < 0) return 0;
  return Number(num.toFixed(2));
}

function sanitizeDate(value) {
  const date = sanitizeText(value, 20);
  return ISO_DATE_PATTERN.test(date) ? date : "";
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      name: sanitizeText(item?.name, 120),
      price: sanitizeAmount(item?.price),
    }))
    .filter((item) => item.name || item.price > 0);
}

export function validateReceiptExtraction(parsed = {}) {
  if (!parsed || typeof parsed !== "object") return null;

  const payMethod = ALLOWED_PAY_METHODS.has(parsed.payMethod) ? parsed.payMethod : "Other";
  const category = ALLOWED_CATEGORIES.has(parsed.category) ? parsed.category : "Other";

  return {
    date: sanitizeDate(parsed.date),
    source: sanitizeText(parsed.source, 140),
    subAmount: sanitizeAmount(parsed.subAmount),
    amount: sanitizeAmount(parsed.amount),
    taxAmount: sanitizeAmount(parsed.taxAmount),
    payMethod,
    category,
    items: sanitizeItems(parsed.items),
  };
}

function scoreParsedReceipt(parsed) {
  if (!parsed) return 0;
  let score = 0;
  if (parsed.source) score += 1;
  if (parsed.amount > 0) score += 3;
  if (parsed.subAmount > 0) score += 1;
  if (parsed.taxAmount > 0) score += 1;
  if (parsed.date) score += 1;
  if (parsed.items?.length) score += 1;
  return score;
}

function splitTextWindows(text) {
  if (text.length <= MAX_CHARS) return [text];
  const windows = [];
  windows.push(text.slice(0, MAX_CHARS));
  if (MAX_WINDOWS > 2) {
    const mid = Math.max(0, Math.floor(text.length / 2 - MAX_CHARS / 2));
    windows.push(text.slice(mid, mid + MAX_CHARS));
  }
  windows.push(text.slice(Math.max(0, text.length - MAX_CHARS)));
  return windows.slice(0, MAX_WINDOWS);
}

async function runGeminiWithRetry(ai, modelName, contents, retries = 2) {
  try {
    return await ai.models.generateContent({ model: modelName, contents });
  } catch (err) {
    if (retries > 0 && err?.status === 503) {
      console.warn("Model overloaded. Retrying...");
      await new Promise((res) => setTimeout(res, 300));
      return runGeminiWithRetry(ai, modelName, contents, retries - 1);
    }
    throw err;
  }
}

async function parseWindow(ai, modelName, windowText) {
  const contents = [
    { role: "system", text: PARSE_PROMPT },
    { role: "user", text: windowText },
  ];

  const response = await runGeminiWithRetry(ai, modelName, contents);
  const raw = await extractTextFromResponse(response);
  const parsed = extractJson(raw);
  return validateReceiptExtraction(parsed);
}

export async function parseReceiptText(ocrText) {
  if (!ocrText || ocrText.trim().length < 5) return null;
  if (!USE_GEMINI) return null;
  if (await isSystemHealthServiceDeactivated("parser_service")) return null;
  if (await isSystemHealthServiceDeactivated("ai_provider")) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: env.aiApiKey });
    const modelName = env.aiReceiptModel || env.aiModel || "gemini-2.5-flash";
    const windows = splitTextWindows(String(ocrText));

    if (windows.length > 1) {
      console.warn(`OCR text segmented for parsing (${ocrText.length} chars, ${windows.length} windows).`);
    }

    let best = null;
    let bestScore = -1;

    for (const windowText of windows) {
      let candidate = null;
      try {
        candidate = await parseWindow(ai, modelName, windowText);
      } catch {
        candidate = null;
      }
      const score = scoreParsedReceipt(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (!best || bestScore < MIN_PARSE_SCORE) return null;
    return best;
  } catch (err) {
    console.error("Gemini parsing error:", err);
    return null;
  }
}

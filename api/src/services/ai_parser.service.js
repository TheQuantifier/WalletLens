// src/services/ai_parser.service.js
import env from "../config/env.js";
import { GoogleGenAI } from "@google/genai";

const MAX_CHARS = Number(env.aiMaxChars || 5000);
const USE_GEMINI = (env.aiProvider || "gemini").toLowerCase() === "gemini";

// ---------------------------------------------------------
// Prompt for Receipt Parsing
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// Extract text from ANY model (Gemini OR Gemma)
// ---------------------------------------------------------
async function extractTextFromResponse(response) {
  // Case 1 — Gemini models have .text()
  if (typeof response?.text === "function") {
    return await response.text();
  }

  // Case 2 — Gemma models deliver inside candidates[].content.parts[]
  try {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const textPart = parts.find((p) => p?.text);
      if (textPart?.text) return textPart.text;
    }
  } catch (err) {
    console.warn("⚠️ Could not read Gemma-style response:", err);
  }

  console.warn("⚠️ No text found in model response.");
  return "";
}

// ---------------------------------------------------------
// Extract JSON from model output
// ---------------------------------------------------------
function extractJson(raw) {
  if (!raw || typeof raw !== "string") return null;

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1).trim());
  } catch {
    console.warn("⚠️ Failed to parse JSON.");
    return null;
  }
}

// ---------------------------------------------------------
// Normalize parsed fields
// ---------------------------------------------------------
function normalize(parsed = {}) {
  return {
    date: parsed.date || "",
    source: parsed.source || "",
    subAmount: Number(parsed.subAmount) || 0,
    amount: Number(parsed.amount) || 0,
    taxAmount: Number(parsed.taxAmount) || 0,
    payMethod: parsed.payMethod || "Other",
    category: parsed.category || "Other",
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

// ---------------------------------------------------------
// Retry logic for overloaded models (503)
// ---------------------------------------------------------
async function runGeminiWithRetry(ai, modelName, contents, retries = 2) {
  try {
    return await ai.models.generateContent({ model: modelName, contents });
  } catch (err) {
    if (retries > 0 && err?.status === 503) {
      console.warn("🔁 Model overloaded. Retrying...");
      await new Promise((res) => setTimeout(res, 300));
      return runGeminiWithRetry(ai, modelName, contents, retries - 1);
    }
    throw err;
  }
}

// ---------------------------------------------------------
// Main entry: Parse receipt text
// ---------------------------------------------------------
export async function parseReceiptText(ocrText) {
  if (!ocrText || ocrText.trim().length < 5) return null;

  // Limit size
  let text = ocrText;
  if (text.length > MAX_CHARS) {
    console.warn(`Gemini: OCR truncated ${text.length} → ${MAX_CHARS}`);
    text = text.slice(0, MAX_CHARS);
  }

  if (!USE_GEMINI) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: env.aiApiKey });

    const modelName = env.aiModel || "gemini-2.5-flash";
    console.log("🤖 Using AI model:", modelName);

    const contents = [
      { role: "system", text: PARSE_PROMPT },
      { role: "user", text },
    ];

    const response = await runGeminiWithRetry(ai, modelName, contents);
    const raw = await extractTextFromResponse(response);

    const parsed = extractJson(raw);
    if (!parsed) return null;

    return normalize(parsed);
  } catch (err) {
    console.error("❌ Gemini Parsing Error:", err);
    return null;
  }
}

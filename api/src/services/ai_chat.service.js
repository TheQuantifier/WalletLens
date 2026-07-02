import env from "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import { isSystemHealthServiceDeactivated } from "./system_health_controls.service.js";

const USE_GEMINI = (env.aiProvider || "gemini").toLowerCase() === "gemini";
const DEFAULT_MAX_INPUT_CHARS = Number(env.aiMaxChars || 5000);

export async function generateAiText({
  systemPrompt = "",
  userPrompt = "",
  model = env.aiChatModel || env.aiModel || "gemini-2.5-flash",
  maxInputChars = DEFAULT_MAX_INPUT_CHARS,
} = {}) {
  if (await isSystemHealthServiceDeactivated("ai_provider")) {
    return {
      ok: false,
      error: "AI provider is disconnected by admin. Please try again later.",
      text: "",
    };
  }

  if (!USE_GEMINI || !env.aiChatApiKey) {
    return {
      ok: false,
      error: "AI provider is not configured.",
      text: "",
    };
  }

  const safeSystemPrompt = String(systemPrompt || "").trim();
  const safeUserPrompt = String(userPrompt || "").trim().slice(0, maxInputChars);
  if (!safeUserPrompt) {
    return { ok: false, error: "AI prompt is empty.", text: "" };
  }

  const ai = new GoogleGenAI({ apiKey: env.aiChatApiKey });
  const contents = [
    { role: "system", text: safeSystemPrompt },
    { role: "user", text: safeUserPrompt },
  ];

  let response = null;
  try {
    response = await ai.models.generateContent({ model, contents });
  } catch {
    return { ok: false, error: "I couldn't reach the AI service. Please try again.", text: "" };
  }

  const text = await extractTextFromResponse(response);
  if (!text) {
    return { ok: false, error: "AI response was empty.", text: "" };
  }

  return { ok: true, error: "", text };
}

async function extractTextFromResponse(response) {
  if (typeof response?.text === "function") {
    return await response.text();
  }

  try {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const textPart = parts.find((part) => part?.text);
      if (textPart?.text) return textPart.text;
    }
  } catch (err) {
    console.warn("Could not read Gemini response:", err);
  }

  return "";
}

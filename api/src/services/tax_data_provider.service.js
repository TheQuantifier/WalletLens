import { getTaxRatesByYear, upsertTaxRates } from "../models/tax_rates.model.js";
import env from "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import { isSystemHealthServiceDeactivated } from "./system_health_controls.service.js";

const GEMINI_TAX_PROVIDER = "gemini";
const US_STATE_CODES = Object.freeze([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

const TAX_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["year", "country", "federalIncomeTax", "fica", "stateIncomeTax"],
  properties: {
    year: { type: "integer" },
    country: { type: "string" },
    federalIncomeTax: {
      type: "object",
      additionalProperties: false,
      required: ["standardDeduction", "brackets"],
      properties: {
        standardDeduction: { type: "number" },
        brackets: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["over", "upTo", "rate"],
            properties: {
              over: { type: "number" },
              upTo: { anyOf: [{ type: "number" }, { type: "null" }] },
              rate: { type: "number" },
            },
          },
        },
      },
    },
    fica: {
      type: "object",
      additionalProperties: false,
      required: ["socialSecurity", "medicare"],
      properties: {
        socialSecurity: {
          type: "object",
          additionalProperties: false,
          required: ["rate", "wageBase"],
          properties: {
            rate: { type: "number" },
            wageBase: { anyOf: [{ type: "number" }, { type: "null" }] },
          },
        },
        medicare: {
          type: "object",
          additionalProperties: false,
          required: ["rate", "wageBase"],
          properties: {
            rate: { type: "number" },
            wageBase: { anyOf: [{ type: "number" }, { type: "null" }] },
          },
        },
      },
    },
    stateIncomeTax: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: true,
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
        },
      },
    },
  },
};

function asNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeRate(value) {
  const rate = asNumber(value, 0);
  return rate > 1 ? rate / 100 : rate;
}

function normalizeMax(value) {
  if (value === null || value === undefined || value === "") return null;
  if (String(value).toLowerCase() === "infinity") return null;
  return Math.max(0, asNumber(value, 0));
}

function convertBrackets(brackets = []) {
  return Array.isArray(brackets)
    ? brackets
        .map((bracket) => ({
          over: Math.max(0, asNumber(bracket?.min ?? bracket?.over, 0)),
          upTo: normalizeMax(bracket?.max ?? bracket?.upTo),
          rate: Math.max(0, Math.min(1, normalizeRate(bracket?.rate))),
        }))
        .filter((bracket) => bracket.rate > 0)
        .sort((a, b) => a.over - b.over)
    : [];
}

function convertStateData(states = {}) {
  if (!states || typeof states !== "object" || Array.isArray(states)) return {};
  return Object.fromEntries(
    Object.entries(states)
      .map(([code, value]) => {
        const stateCode = String(code || "").trim().toUpperCase();
        if (!US_STATE_CODES.includes(stateCode)) return null;
        return [
          stateCode,
          {
            single: { brackets: convertBrackets(value?.single?.brackets || value?.brackets) },
            married: { brackets: convertBrackets(value?.married?.brackets) },
            married_separate: { brackets: convertBrackets(value?.married_separate?.brackets) },
            head_of_household: { brackets: convertBrackets(value?.head_of_household?.brackets) },
            standardDeduction: value?.standard_deduction || value?.standardDeduction || null,
          },
        ];
      })
      .filter(Boolean)
  );
}

function buildTaxDataPrompt({ year, filingStatus }) {
  return `
Return current United States tax quantities for tax year ${year}.

Use current authoritative sources where possible. Include:
- Federal individual income tax standard deduction and brackets for filing status "${filingStatus}".
- FICA employee Social Security rate and wage base.
- FICA employee Medicare rate.
- State income tax brackets for all 50 states plus DC where state income tax exists. Use empty brackets for states without wage income tax.

Return rates as decimals, not percentages. Example: 12% must be 0.12.
Return dollar thresholds as plain numbers.
Return only JSON matching the provided schema. Do not include tax advice.
`.trim();
}

async function extractTextFromResponse(response) {
  if (typeof response?.output_text === "string") return response.output_text;
  if (typeof response?.outputText === "string") return response.outputText;
  if (typeof response?.text === "function") return await response.text();
  if (typeof response?.text === "string") return response.text;
  if (Array.isArray(response?.steps)) {
    const text = response.steps
      .flatMap((step) => (Array.isArray(step?.content) ? step.content : []))
      .map((content) => content?.text || "")
      .filter(Boolean)
      .join("")
      .trim();
    if (text) return text;
  }
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((part) => part?.text || "").join("").trim();
  }
  return "";
}

function parseJsonText(value) {
  const raw = String(value || "").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  }
}

function hasUsableTaxPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.federalIncomeTax &&
      payload.fica &&
      payload.stateIncomeTax
  );
}

export function normalizeGeminiTaxResponse(payload, { existingTaxData = {}, filingStatus = "single", year } = {}) {
  const existingFederal = existingTaxData?.federalIncomeTax || {};
  const federal = payload?.federalIncomeTax || {};
  const brackets = convertBrackets(federal.brackets);
  const fica = payload?.fica && typeof payload.fica === "object" ? payload.fica : {};
  return {
    ...existingTaxData,
    version: 1,
    provider: GEMINI_TAX_PROVIDER,
    source: "gemini:grounded-tax-sync",
    fetchedAt: new Date().toISOString(),
    country: String(payload?.country || "US").toUpperCase(),
    year: asNumber(payload?.year, year || existingTaxData?.year || new Date().getFullYear()),
    filingStatus,
    federalIncomeTax: {
      standardDeduction: asNumber(federal.standardDeduction, existingFederal.standardDeduction || 0),
      brackets: brackets.length ? brackets : existingFederal.brackets || [],
    },
    fica: {
      socialSecurity: {
        rate: normalizeRate(fica.socialSecurity?.rate ?? existingTaxData?.fica?.socialSecurity?.rate ?? 0.062),
        wageBase: fica.socialSecurity?.wageBase === null || fica.socialSecurity?.wageBase === undefined
          ? existingTaxData?.fica?.socialSecurity?.wageBase ?? null
          : Math.max(0, asNumber(fica.socialSecurity.wageBase, 0)),
      },
      medicare: {
        rate: normalizeRate(fica.medicare?.rate ?? existingTaxData?.fica?.medicare?.rate ?? 0.0145),
        wageBase: fica.medicare?.wageBase === null || fica.medicare?.wageBase === undefined
          ? null
          : Math.max(0, asNumber(fica.medicare.wageBase, 0)),
      },
    },
    stateIncomeTax: convertStateData(payload?.stateIncomeTax),
    sources: Array.isArray(payload?.sources)
      ? payload.sources
          .map((source) => ({
            title: String(source?.title || "").trim().slice(0, 160),
            url: String(source?.url || "").trim().slice(0, 400),
          }))
          .filter((source) => source.title || source.url)
          .slice(0, 20)
      : [],
  };
}

async function requestTaxDataWithGenerateContent(ai, model, prompt) {
  return ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0,
      maxOutputTokens: 30000,
      responseMimeType: "application/json",
      responseJsonSchema: TAX_RESPONSE_SCHEMA,
      tools: [{ googleSearch: {} }],
    },
  });
}

async function requestTaxDataWithInteractions(ai, model, prompt) {
  return ai.interactions.create({
    model,
    input: prompt,
    generation_config: {
      temperature: 0,
      max_output_tokens: 30000,
    },
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: TAX_RESPONSE_SCHEMA,
    },
    tools: [{ type: "google_search" }],
  });
}

export async function fetchGeminiTaxData({ year, existingTaxData = {}, filingStatus = "single" } = {}) {
  if (await isSystemHealthServiceDeactivated("ai_provider")) {
    throw new Error("AI provider is disconnected by admin. Please try again later.");
  }
  const apiKey = process.env.GEMINI_API_KEY || env.aiApiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY or AI_API_KEY is not configured on the API server.");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_TAX_MODEL || process.env.AI_TAX_MODEL || env.aiChatModel || "gemini-3.5-flash";
  const prompt = buildTaxDataPrompt({ year, filingStatus });
  const mode = String(process.env.GEMINI_TAX_API_MODE || "generate_content").trim().toLowerCase();

  let response = null;
  let data = null;

  if (mode === "interactions" || mode === "auto") {
    try {
      response = await requestTaxDataWithInteractions(ai, model, prompt);
      data = parseJsonText(await extractTextFromResponse(response));
    } catch (err) {
      console.warn("Gemini Interactions tax sync failed; falling back to generateContent:", err?.message || err);
    }
  }

  if (!hasUsableTaxPayload(data)) {
    response = await requestTaxDataWithGenerateContent(ai, model, prompt);
    data = parseJsonText(await extractTextFromResponse(response));
  }

  if (!hasUsableTaxPayload(data)) {
    throw new Error("Gemini tax response did not include usable federal, FICA, and state tax data.");
  }

  return normalizeGeminiTaxResponse(data, { existingTaxData, filingStatus, year });
}

export async function getCachedTaxRates({ year = new Date().getFullYear(), country = "US", filingStatus = "single", existingTaxData = {}, forceRefresh = false } = {}) {
  const taxYear = Number(year);
  const normalizedCountry = String(country || "US").toUpperCase();
  if (!forceRefresh) {
    const existing = await getTaxRatesByYear({ country: normalizedCountry, year: taxYear });
    if (existing?.data) return existing;
  }

  const data = await fetchGeminiTaxData({
    year: taxYear,
    filingStatus,
    existingTaxData,
  });
  const saved = await upsertTaxRates({
    country: normalizedCountry,
    taxYear,
    provider: GEMINI_TAX_PROVIDER,
    data,
    fetchedAt: data.fetchedAt || new Date().toISOString(),
  });
  return saved;
}

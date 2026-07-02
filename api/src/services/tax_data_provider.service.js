import { getTaxRatesByYear, upsertTaxRates } from "../models/tax_rates.model.js";
import env from "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import { isSystemHealthServiceDeactivated } from "./system_health_controls.service.js";

const GEMINI_TAX_PROVIDER = "gemini";
const DEFAULT_TAX_MODELS = Object.freeze([
  "gemini-3.1-flash-lite",
  "models/gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "models/gemini-2.5-flash",
]);
const TAX_SYNC_TIMEOUT_MS = 25000;
const FEDERAL_TAX_SYNC_TIMEOUT_MS = 45000;
const STATE_TAX_SYNC_TIMEOUT_MS = 45000;
const STATE_BATCH_SIZE = 5;
const US_STATE_CODES = Object.freeze([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

function maskKeyFingerprint(value) {
  const raw = String(value || "").trim();
  if (!raw) return "(missing)";
  if (raw.length <= 8) return `${raw.slice(0, 2)}...${raw.slice(-2)}`;
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

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

function buildFederalTaxPrompt({ year, filingStatus }) {
  return `
Return current United States federal and FICA tax quantities for tax year ${year}.

Use current authoritative sources where possible. Include:
- Federal individual income tax standard deduction and brackets for filing status "${filingStatus}".
- FICA employee Social Security rate and wage base.
- FICA employee Medicare rate.

Return rates as decimals, not percentages. Example: 12% must be 0.12.
Return dollar thresholds as plain numbers.
Return only JSON in this shape:
{
  "year": ${year},
  "country": "US",
  "federalIncomeTax": {
    "standardDeduction": 0,
    "brackets": [
      { "over": 0, "upTo": 0, "rate": 0.1 }
    ]
  },
  "fica": {
    "socialSecurity": { "rate": 0.062, "wageBase": 0 },
    "medicare": { "rate": 0.0145, "wageBase": null }
  },
  "sources": [
    { "title": "IRS", "url": "https://..." }
  ]
}
Do not include markdown. Do not include tax advice.
`.trim();
}

function buildStateTaxPrompt({ year, stateCodes = US_STATE_CODES }) {
  const requestedStateCodes = Array.from(new Set(
    (Array.isArray(stateCodes) ? stateCodes : [])
      .map((code) => String(code || "").trim().toUpperCase())
      .filter((code) => US_STATE_CODES.includes(code))
  ));
  const requestedStatesLabel = requestedStateCodes.join(", ");
  const stateExampleEntries = requestedStateCodes.slice(0, 2);
  const exampleObject = stateExampleEntries.length
    ? stateExampleEntries
        .map((code, index) => `    "${code}": { "brackets": ${index === 0 ? '[{ "over": 0, "upTo": 0, "rate": 0.01 }]' : "[]"} }`)
        .join(",\n")
    : '    "CA": { "brackets": [{ "over": 0, "upTo": 0, "rate": 0.01 }] }';
  return `
Return current United States state income tax bracket quantities for tax year ${year}.

Use current authoritative sources where possible.
Include only these jurisdictions: ${requestedStatesLabel}.
For states without wage income tax, return an empty brackets array.
Return rates as decimals, not percentages. Example: 5% must be 0.05.
Return dollar thresholds as plain numbers.
Return only JSON in this shape:
{
  "year": ${year},
  "country": "US",
  "stateIncomeTax": {
${exampleObject}
  },
  "sources": [
    { "title": "State revenue department", "url": "https://..." }
  ]
}
Do not include jurisdictions outside this list: ${requestedStatesLabel}.
Do not include markdown. Do not include tax advice.
`.trim();
}

function isGeminiModelName(value) {
  const model = String(value || "").trim().toLowerCase();
  if (!model) return false;
  return model.includes("gemini");
}

function buildTaxModelCandidates() {
  const configured = [
    env.aiTaxModel,
    env.aiChatModel,
    env.aiModel,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const preferred = configured.filter(isGeminiModelName);
  const defaults = DEFAULT_TAX_MODELS.filter(
    (model) => !preferred.some((candidate) => candidate.toLowerCase() === model.toLowerCase())
  );

  return Array.from(
    new Set(
      [...preferred, ...defaults].map((value) => String(value || "").trim()).filter(Boolean)
    )
  );
}

function isUnsupportedModelError(err) {
  const message = String(err?.message || "").toLowerCase();
  return err?.status === 404 && (
    message.includes("not found")
    || message.includes("not supported for generatecontent")
  );
}

function isQuotaExceededError(err) {
  const message = String(err?.message || "").toLowerCase();
  return err?.status === 429 || message.includes("quota exceeded") || message.includes("resource_exhausted");
}

function hasExistingStateTaxDataForYear(existingTaxData, year) {
  const sameYear = Number(existingTaxData?.year) === Number(year);
  const states =
    existingTaxData?.stateIncomeTax && typeof existingTaxData.stateIncomeTax === "object" && !Array.isArray(existingTaxData.stateIncomeTax)
      ? existingTaxData.stateIncomeTax
      : {};
  return sameYear && Object.keys(states).length > 0;
}

function createTaxSyncTimeoutError(label, timeoutMs = TAX_SYNC_TIMEOUT_MS) {
  const err = new Error(`Gemini ${label} tax sync timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
  err.status = 504;
  return err;
}

async function withTimeout(promise, label, timeoutMs = TAX_SYNC_TIMEOUT_MS) {
  let timeoutId = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(createTaxSyncTimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function runGeminiWithRetry(ai, modelName, contents, config, { retries = 2, timeoutMs = TAX_SYNC_TIMEOUT_MS } = {}) {
  try {
    return await withTimeout(
      ai.models.generateContent({
        model: modelName,
        contents,
        config,
      }),
      "request",
      timeoutMs
    );
  } catch (err) {
    if (retries > 0 && err?.status === 503) {
      console.warn("Gemini tax sync model overloaded. Retrying...");
      await new Promise((resolve) => setTimeout(resolve, 300));
      return runGeminiWithRetry(ai, modelName, contents, config, { retries: retries - 1, timeoutMs });
    }
    throw err;
  }
}

async function extractTextFromResponse(response) {
  if (typeof response?.text === "function") return response.text();
  if (typeof response?.output_text === "string") return response.output_text;
  if (typeof response?.outputText === "string") return response.outputText;
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
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // continue
      }
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]);
  }
}

function truncateDebugText(value, maxLength = 1200) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

function summarizeTaxPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { type: Array.isArray(payload) ? "array" : typeof payload };
  }
  return {
    keys: Object.keys(payload),
    hasFederalIncomeTax: Boolean(payload.federalIncomeTax),
    hasFica: Boolean(payload.fica),
    stateCount:
      payload.stateIncomeTax && typeof payload.stateIncomeTax === "object" && !Array.isArray(payload.stateIncomeTax)
        ? Object.keys(payload.stateIncomeTax).length
        : 0,
    sourceCount: Array.isArray(payload.sources) ? payload.sources.length : 0,
  };
}

function hasFederalTaxPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.federalIncomeTax &&
      payload.fica
  );
}

function hasStateTaxPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.stateIncomeTax &&
      typeof payload.stateIncomeTax === "object" &&
      !Array.isArray(payload.stateIncomeTax)
  );
}

function hasRequestedStateTaxPayload(payload, stateCodes = []) {
  if (!hasStateTaxPayload(payload)) return false;
  const requested = new Set(
    (Array.isArray(stateCodes) ? stateCodes : [])
      .map((code) => String(code || "").trim().toUpperCase())
      .filter(Boolean)
  );
  if (!requested.size) return false;
  return Object.keys(payload.stateIncomeTax || {}).some((code) => requested.has(String(code || "").trim().toUpperCase()));
}

function chunkValues(values = [], chunkSize = STATE_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

export function normalizeGeminiTaxResponse(payload, { existingTaxData = {}, filingStatus = "single", year } = {}) {
  const existingFederal = existingTaxData?.federalIncomeTax || {};
  const federal = payload?.federalIncomeTax || {};
  const brackets = convertBrackets(federal.brackets);
  const fica = payload?.fica && typeof payload.fica === "object" ? payload.fica : {};
  const stateIncomeTax = convertStateData(payload?.stateIncomeTax);
  const existingStateIncomeTax =
    existingTaxData?.stateIncomeTax && typeof existingTaxData.stateIncomeTax === "object" && !Array.isArray(existingTaxData.stateIncomeTax)
      ? existingTaxData.stateIncomeTax
      : {};
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
    stateIncomeTax: Object.keys(stateIncomeTax).length ? stateIncomeTax : existingStateIncomeTax,
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

async function requestTaxDataFromGemini(ai, model, prompt, { useGoogleSearch = true, timeoutMs = TAX_SYNC_TIMEOUT_MS } = {}) {
  const contents = [{ role: "user", text: prompt }];
  const config = {
    temperature: 0,
    maxOutputTokens: 30000,
  };
  if (useGoogleSearch) {
    config.tools = [{ googleSearch: {} }];
  }
  return runGeminiWithRetry(ai, model, contents, config, { timeoutMs });
}

async function fetchFederalTaxData(ai, modelCandidates, year, filingStatus) {
  const prompt = buildFederalTaxPrompt({ year, filingStatus });
  try {
    return await withTimeout(
      fetchTaxSection(
        ai,
        modelCandidates,
        prompt,
        hasFederalTaxPayload,
        "federal",
        { useGoogleSearch: true, timeoutMs: FEDERAL_TAX_SYNC_TIMEOUT_MS }
      ),
      "federal",
      FEDERAL_TAX_SYNC_TIMEOUT_MS
    );
  } catch (err) {
    if (err?.status === 504) {
      console.warn("Gemini federal tax grounded request timed out. Retrying without googleSearch.");
      return withTimeout(
        fetchTaxSection(
          ai,
          modelCandidates,
          prompt,
          hasFederalTaxPayload,
          "federal fallback",
          { useGoogleSearch: false, timeoutMs: FEDERAL_TAX_SYNC_TIMEOUT_MS }
        ),
        "federal fallback",
        FEDERAL_TAX_SYNC_TIMEOUT_MS
      );
    }
    throw err;
  }
}

async function fetchTaxSection(ai, modelCandidates, prompt, validator, label, options = {}) {
  let data = null;
  let lastError = null;

  for (const model of modelCandidates) {
    try {
      const response = await requestTaxDataFromGemini(ai, model, prompt, options);
      const rawText = await extractTextFromResponse(response);
      console.info(`Gemini ${label} tax raw response.`, {
        model,
        text: truncateDebugText(rawText),
      });
      data = parseJsonText(rawText);
      console.info(`Gemini ${label} tax parsed payload.`, {
        model,
        summary: summarizeTaxPayload(data),
      });
      if (validator(data)) return data;
      console.warn(`Gemini ${label} tax payload failed validation.`, {
        model,
        summary: summarizeTaxPayload(data),
        text: truncateDebugText(rawText, 2000),
      });
    } catch (err) {
      lastError = err;
      if (isUnsupportedModelError(err)) {
        console.warn(`Gemini ${label} tax sync model unavailable: ${model}. Trying fallback model.`);
        continue;
      }
      console.warn(`Gemini ${label} tax request failed.`, {
        model,
        status: err?.status || null,
        message: err?.message || String(err),
      });
      throw err;
    }
  }

  if (lastError) throw lastError;
  return null;
}

async function fetchBatchedStateTaxData(ai, modelCandidates, year) {
  const batches = chunkValues(US_STATE_CODES, STATE_BATCH_SIZE);
  const combinedStateIncomeTax = {};
  const sourceGroups = [];

  for (let index = 0; index < batches.length; index += 1) {
    const stateCodes = batches[index];
    const label = `state batch ${index + 1}/${batches.length}`;
    console.info("Starting Gemini state tax batch sync.", {
      batch: index + 1,
      totalBatches: batches.length,
      stateCodes,
    });
    try {
      const batchData = await withTimeout(
        fetchTaxSection(
          ai,
          modelCandidates,
          buildStateTaxPrompt({ year, stateCodes }),
          (payload) => hasRequestedStateTaxPayload(payload, stateCodes),
          label,
          { useGoogleSearch: false, timeoutMs: STATE_TAX_SYNC_TIMEOUT_MS }
        ),
        label,
        STATE_TAX_SYNC_TIMEOUT_MS
      );
      if (hasStateTaxPayload(batchData)) {
        Object.assign(combinedStateIncomeTax, batchData.stateIncomeTax);
        sourceGroups.push(batchData.sources);
        console.info("Gemini state tax batch sync completed.", {
          batch: index + 1,
          totalBatches: batches.length,
          receivedStates: Object.keys(batchData.stateIncomeTax || {}),
        });
      }
    } catch (err) {
      console.warn("Gemini state tax batch sync failed.", {
        batch: index + 1,
        totalBatches: batches.length,
        stateCodes,
        status: err?.status || null,
        message: err?.message || String(err),
      });
      if (isQuotaExceededError(err)) throw err;
    }
  }

  if (!Object.keys(combinedStateIncomeTax).length) return null;
  return {
    year,
    country: "US",
    stateIncomeTax: combinedStateIncomeTax,
    sources: mergeSources(...sourceGroups),
  };
}

function mergeSources(...groups) {
  const seen = new Set();
  return groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .map((source) => ({
      title: String(source?.title || "").trim().slice(0, 160),
      url: String(source?.url || "").trim().slice(0, 400),
    }))
    .filter((source) => {
      const key = `${source.title}|${source.url}`;
      if (!source.title && !source.url) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

export async function fetchGeminiTaxData({ year, existingTaxData = {}, filingStatus = "single" } = {}) {
  if (await isSystemHealthServiceDeactivated("ai_provider")) {
    throw new Error("AI provider is disconnected by admin. Please try again later.");
  }
  const apiKey = env.aiTaxApiKey;
  if (!apiKey) throw new Error("AI_TAX_API_KEY, GEMINI_TAX_API_KEY, GEMINI_API_KEY, or AI_API_KEY is not configured on the API server.");

  const ai = new GoogleGenAI({ apiKey });
  const modelCandidates = buildTaxModelCandidates();
  console.info("Gemini tax runtime config.", {
    keyFingerprint: maskKeyFingerprint(apiKey),
    configuredModel: env.aiTaxModel || "",
    chatModelFallback: env.aiChatModel || "",
    baseModelFallback: env.aiModel || "",
  });
  console.info("Starting Gemini tax sync.", {
    year,
    filingStatus,
    modelCandidates,
    hasExistingStateTaxData: hasExistingStateTaxDataForYear(existingTaxData, year),
  });

  const federalData = await fetchFederalTaxData(ai, modelCandidates, year, filingStatus);

  if (!hasFederalTaxPayload(federalData)) {
    throw new Error("Gemini tax response did not include usable federal and FICA tax data.");
  }
  console.info("Gemini federal tax sync completed.", {
    year,
    filingStatus,
  });

  let stateData = null;
  let stateSyncStatus = "skipped";
  let stateSyncReason = "";
  const shouldFetchStateData = !hasExistingStateTaxDataForYear(existingTaxData, year);
  if (shouldFetchStateData) {
    try {
      stateData = await fetchBatchedStateTaxData(ai, modelCandidates, year);
      stateSyncStatus = hasStateTaxPayload(stateData) ? "synced" : "skipped";
      stateSyncReason = hasStateTaxPayload(stateData) ? "" : "no_usable_state_data";
    } catch (err) {
      if (isQuotaExceededError(err)) {
        console.warn("Gemini state tax sync skipped because Gemini quota is exhausted; keeping existing state tax data.");
        stateSyncStatus = "skipped";
        stateSyncReason = "quota_exhausted";
      } else {
        console.warn("Gemini state tax sync did not return usable data; keeping existing state tax data.", err?.message || err);
        stateSyncStatus = "skipped";
        stateSyncReason = "request_failed";
      }
    }
  } else {
    stateData = { stateIncomeTax: existingTaxData.stateIncomeTax, sources: existingTaxData.sources || [] };
    stateSyncStatus = "kept_existing";
    stateSyncReason = "already_current";
  }

  const merged = {
    year,
    country: "US",
    federalIncomeTax: federalData.federalIncomeTax,
    fica: federalData.fica,
    stateIncomeTax: hasStateTaxPayload(stateData)
      ? stateData.stateIncomeTax
      : (existingTaxData?.stateIncomeTax || {}),
    sources: mergeSources(federalData?.sources, stateData?.sources),
  };

  console.info("Gemini tax sync completed.", {
    year,
    filingStatus,
    stateDataUpdated: hasStateTaxPayload(stateData),
  });

  return {
    data: normalizeGeminiTaxResponse(merged, { existingTaxData, filingStatus, year }),
    syncResult: {
      federalStatus: "synced",
      stateStatus: stateSyncStatus,
      stateReason: stateSyncReason,
      stateDataUpdated: hasStateTaxPayload(stateData),
    },
  };
}

export async function getCachedTaxRates({ year = new Date().getFullYear(), country = "US", filingStatus = "single", existingTaxData = {}, forceRefresh = false } = {}) {
  const taxYear = Number(year);
  const normalizedCountry = String(country || "US").toUpperCase();
  if (!forceRefresh) {
    const existing = await getTaxRatesByYear({ country: normalizedCountry, year: taxYear });
    if (existing?.data) return existing;
  }

  const fetched = await fetchGeminiTaxData({
    year: taxYear,
    filingStatus,
    existingTaxData,
  });
  const data = fetched?.data || null;
  const saved = await upsertTaxRates({
    country: normalizedCountry,
    taxYear,
    provider: GEMINI_TAX_PROVIDER,
    data,
    fetchedAt: data.fetchedAt || new Date().toISOString(),
  });
  return {
    ...saved,
    syncResult: fetched?.syncResult || null,
  };
}

// src/services/fx_rates.service.js
import { getFxRatesByBase, upsertFxRates } from "../models/fx_rates.model.js";
import { isSystemHealthServiceDeactivated } from "./system_health_controls.service.js";

const PROVIDER = "ratesdb";
const DEFAULT_BASE = "USD";
const PROVIDER_URL = "https://free.ratesdb.com/v1/rates";

const toDateKey = (value) => {
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const normalizeBase = (base) => String(base || DEFAULT_BASE).trim().toUpperCase();

const parseProviderResponse = (json) => {
  const data = json?.data || json;
  const base = data?.from || data?.base;
  const date = data?.date;
  const rates = data?.rates;
  return { base, date, rates };
};

const fetchRatesFromProvider = async (baseCurrency) => {
  const url = `${PROVIDER_URL}?from=${encodeURIComponent(baseCurrency)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Provider request failed (${res.status})`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  const json = await res.json();
  const { base, date, rates } = parseProviderResponse(json);

  if (!base || !date || !rates || typeof rates !== "object") {
    throw new Error("Provider response missing base/date/rates");
  }

  return { base, date, rates };
};

const convertRatesBase = (ratesByEur, targetBase) => {
  const baseRate = ratesByEur?.[targetBase];
  if (!Number.isFinite(Number(baseRate)) || Number(baseRate) === 0) {
    throw new Error(`Provider rates missing base currency ${targetBase}`);
  }

  const converted = {};
  Object.entries(ratesByEur).forEach(([code, value]) => {
    if (value === null || value === undefined) {
      converted[code] = null;
      return;
    }
    const num = Number(value);
    converted[code] = Number.isFinite(num) ? num / Number(baseRate) : null;
  });

  converted[targetBase] = 1;
  return converted;
};

export async function getFxRates({ base = DEFAULT_BASE } = {}) {
  const baseCurrency = normalizeBase(base);
  const existing = await getFxRatesByBase(baseCurrency);
  const todayKey = toDateKey(new Date());

  if (existing && toDateKey(existing.fetched_at) === todayKey) {
    return existing;
  }

  if (await isSystemHealthServiceDeactivated("ratesdb_api")) {
    if (existing) return existing;
    throw new Error("RatesDB API is disconnected by admin.");
  }

  let providerBase = baseCurrency;
  let providerDate = null;
  let providerRates = null;

  try {
    const data = await fetchRatesFromProvider(baseCurrency);
    providerBase = data.base;
    providerDate = data.date;
    providerRates = data.rates;
  } catch (err) {
    // Some providers only allow EUR base. Fallback by converting from EUR.
    if (baseCurrency !== "EUR" && err?.status === 422) {
      const data = await fetchRatesFromProvider("EUR");
      providerBase = baseCurrency;
      providerDate = data.date;
      providerRates = convertRatesBase(data.rates, baseCurrency);
    } else {
      throw err;
    }
  }

  providerRates[providerBase] = 1;

  const saved = await upsertFxRates({
    baseCurrency: providerBase,
    provider: PROVIDER,
    rates: providerRates,
    asOfDate: providerDate,
    fetchedAt: new Date().toISOString(),
  });

  return saved;
}

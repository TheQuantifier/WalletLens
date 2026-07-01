import { query } from "../config/db.js";

export async function getTaxRatesByYear({ country = "US", year }) {
  const { rows } = await query(
    `
    SELECT *
    FROM tax_rates
    WHERE country = $1
      AND tax_year = $2
    LIMIT 1
    `,
    [String(country || "US").toUpperCase(), Number(year)]
  );
  return rows[0] || null;
}

export async function upsertTaxRates({ country = "US", taxYear, provider, data, fetchedAt }) {
  const { rows } = await query(
    `
    INSERT INTO tax_rates
      (country, tax_year, provider, data, fetched_at)
    VALUES
      ($1, $2, $3, $4, $5)
    ON CONFLICT (country, tax_year)
    DO UPDATE SET
      provider = EXCLUDED.provider,
      data = EXCLUDED.data,
      fetched_at = EXCLUDED.fetched_at,
      updated_at = now()
    RETURNING *
    `,
    [
      String(country || "US").toUpperCase(),
      Number(taxYear),
      provider || "gemini",
      JSON.stringify(data || {}),
      fetchedAt || new Date().toISOString(),
    ]
  );
  return rows[0] || null;
}

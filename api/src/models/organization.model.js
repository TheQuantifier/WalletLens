import { query } from "../config/db.js";

const ORGANIZATION_COLUMNS = `
  id, name, business_type, industry, email, phone_number, website, address,
  city, region, postal_code, country, logo_url, default_currency, timezone,
  fiscal_year_start_month, subscription_status, access_expires_at,
  custom_expense_categories, custom_income_categories, created_at, updated_at
`;

export async function createOrganization({
  name,
  businessType = "",
  industry = "",
  email = "",
  phoneNumber = "",
  website = "",
  address = "",
  city = "",
  region = "",
  postalCode = "",
  country = "",
  executor = query,
}) {
  const { rows } = await executor(
    `INSERT INTO organizations
      (name, business_type, industry, email, phone_number, website, address, city, region, postal_code, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${ORGANIZATION_COLUMNS}`,
    [name, businessType, industry, email, phoneNumber, website, address, city, region, postalCode, country]
  );
  return rows[0];
}

export async function findOrganizationById(id, executor = query) {
  const { rows } = await executor(
    `SELECT ${ORGANIZATION_COLUMNS} FROM organizations WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function updateOrganizationById(id, changes = {}, executor = query) {
  const allowed = {
    name: "name", businessType: "business_type", industry: "industry", email: "email",
    phoneNumber: "phone_number", website: "website", address: "address", city: "city",
    region: "region", postalCode: "postal_code", country: "country", logoUrl: "logo_url",
    defaultCurrency: "default_currency", timezone: "timezone",
    fiscalYearStartMonth: "fiscal_year_start_month",
    customExpenseCategories: "custom_expense_categories",
    customIncomeCategories: "custom_income_categories",
  };
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (changes[key] === undefined) continue;
    values.push(key === "customExpenseCategories" || key === "customIncomeCategories"
      ? JSON.stringify(Array.isArray(changes[key]) ? changes[key] : [])
      : changes[key]);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) return findOrganizationById(id, executor);
  values.push(id);
  const { rows } = await executor(
    `UPDATE organizations SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${values.length} RETURNING ${ORGANIZATION_COLUMNS}`,
    values
  );
  return rows[0] || null;
}

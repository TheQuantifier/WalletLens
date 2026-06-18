import { query } from "../config/db.js";

const ORGANIZATION_COLUMNS = `
  id, name, business_type, industry, email, phone_number, website, address,
  city, region, postal_code, country, created_at, updated_at
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

CREATE TABLE IF NOT EXISTS tax_rates (
  country TEXT NOT NULL DEFAULT 'US',
  tax_year INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gemini',
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (country, tax_year)
);

alter table organizations
  add column if not exists custom_expense_categories jsonb not null default '[]'::jsonb,
  add column if not exists custom_income_categories jsonb not null default '[]'::jsonb;

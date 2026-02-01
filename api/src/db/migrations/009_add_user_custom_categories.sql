-- src/db/migrations/009_add_user_custom_categories.sql
-- Adds custom expense/income category arrays to users

alter table users
  add column if not exists custom_expense_categories text[] not null default '{}',
  add column if not exists custom_income_categories text[] not null default '{}';

export const ACHIEVEMENT_METRICS = Object.freeze([
  "records_total",
  "records_income",
  "records_expense",
  "receipts_total",
  "budgets_total",
  "net_worth_total",
  "account_age_years",
  "dual_auth_enabled",
  "two_fa_enabled",
  "google_signin_enabled",
  "avatar_selected",
]);

export const BOOLEAN_ACHIEVEMENT_METRICS = Object.freeze([
  "dual_auth_enabled",
  "two_fa_enabled",
  "google_signin_enabled",
  "avatar_selected",
]);

export const DEFAULT_ACHIEVEMENTS = Object.freeze([
  {
    key: "first_record",
    title: "First Record",
    description: "Add your first record.",
    icon: "🧾",
    metric: "records_total",
    target: 1,
  },
  {
    key: "five_records",
    title: "Tracking Momentum",
    description: "Add 5 total records.",
    icon: "📊",
    metric: "records_total",
    target: 5,
  },
  {
    key: "expense_tracker",
    title: "Expense Tracker",
    description: "Add 10 expense records.",
    icon: "💸",
    metric: "records_expense",
    target: 10,
  },
  {
    key: "income_tracker",
    title: "Income Tracker",
    description: "Add 5 income records.",
    icon: "💰",
    metric: "records_income",
    target: 5,
  },
  {
    key: "first_budget",
    title: "Budget Starter",
    description: "Create your first budget sheet.",
    icon: "🎯",
    metric: "budgets_total",
    target: 1,
  },
  {
    key: "net_worth_started",
    title: "Net Worth Starter",
    description: "Add your first net worth item.",
    icon: "📈",
    metric: "net_worth_total",
    target: 1,
  },
]);

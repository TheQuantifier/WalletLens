import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const walterPath = path.resolve(__dirname, "../../../web/scripts/walterlens.js");

globalThis.window = {
  location: {
    hostname: "localhost",
    href: "http://localhost/home.html",
  },
};

const { __walterlensTest } = await import(pathToFileURL(walterPath).href);
const { detectIntent, isFinancialQuestion } = __walterlensTest;

const cases = [
  { q: "How much did I spend last week?", scope: "finance", intent: "insight" },
  { q: "How much did I spend on groceries this month?", scope: "finance", intent: "insight" },
  { q: "How much income did I make this month?", scope: "finance", intent: "insight" },
  { q: "What is my net this month?", scope: "finance", intent: "insight" },
  { q: "Show my records from last week", scope: "finance", intent: "list" },
  { q: "List transactions this month", scope: "finance", intent: "list" },
  { q: "Add expense 12.50 coffee today", scope: "finance", intent: "create" },
  { q: "Create income 4500 salary", scope: "finance", intent: "create" },
  { q: "Edit record 123 amount to 45", scope: "finance", intent: "edit" },
  { q: "Delete record 123", scope: "finance", intent: "delete" },
  { q: "Where am I spending the most?", scope: "finance", intent: "insight" },
  { q: "Top categories this month", scope: "finance", intent: "insight" },
  { q: "What is my average spending this month?", scope: "finance", intent: "insight" },
  { q: "How many transactions this week?", scope: "finance", intent: "unknown" },
  { q: "How many expenses this month?", scope: "finance", intent: "unknown" },
  { q: "Did I overspend this week?", scope: "finance", intent: "unknown" },
  { q: "Can I afford this purchase?", scope: "finance", intent: "insight" },
  { q: "Budget summary for last month", scope: "finance", intent: "insight" },
  { q: "Show income this week", scope: "finance", intent: "insight" },
  { q: "Show expenses this week", scope: "finance", intent: "insight" },
  { q: "How much did I save this month?", scope: "finance", intent: "insight" },
  { q: "How much money left over this month?", scope: "finance", intent: "insight" },
  { q: "What is my cash flow this month?", scope: "finance", intent: "insight" },
  { q: "Show records for dining", scope: "finance", intent: "list" },
  { q: "Update transaction 77 category to Dining", scope: "finance", intent: "edit" },
  { q: "Remove transaction 77", scope: "finance", intent: "delete" },
  { q: "Log expense 23.10 lunch", scope: "finance", intent: "create" },
  { q: "Record my rent payment", scope: "finance", intent: "unknown" },
  { q: "How much is left in my budget?", scope: "finance", intent: "insight" },
  { q: "Summarize my spending trends", scope: "finance", intent: "insight" },
  { q: "can WalletLense scan receipts?", scope: "finance", intent: "unknown" },
  { q: "what receipts have i scanned?", scope: "finance", intent: "unknown" },
  { q: "What records do i have?", scope: "finance", intent: "list" },

  { q: "What is the capital of NC?", scope: "other", intent: "unknown" },
  { q: "What is an apple?", scope: "other", intent: "unknown" },
  { q: "Write me a poem", scope: "other", intent: "unknown" },
  { q: "How do I bake bread?", scope: "other", intent: "unknown" },
  { q: "Explain quantum physics", scope: "other", intent: "unknown" },
  { q: "Who won the game last night?", scope: "other", intent: "unknown" },
  { q: "Tell me a joke", scope: "other", intent: "unknown" },
  { q: "What is 2+2?", scope: "other", intent: "unknown" },
  { q: "Translate hello to Spanish", scope: "other", intent: "unknown" },
  { q: "What is the weather tomorrow?", scope: "other", intent: "unknown" },
];

let passed = 0;
const failures = [];

for (const c of cases) {
  const intent = detectIntent(c.q);
  const finance = isFinancialQuestion(c.q);
  const inScope = intent !== "unknown" || finance;

  let ok = true;
  if (c.scope === "finance") {
    ok = inScope;
    if (ok && c.intent !== "unknown") {
      ok = intent === c.intent;
    }
  } else {
    ok = !inScope;
  }

  if (ok) {
    passed += 1;
  } else {
    failures.push({
      q: c.q,
      expectedScope: c.scope,
      expectedIntent: c.intent,
      gotIntent: intent,
      gotFinance: finance,
      inScope,
    });
  }
}

const total = cases.length;
const rate = (passed / total) * 100;
console.log(`WalterLens matrix: ${passed}/${total} (${rate.toFixed(1)}%)`);
if (failures.length) {
  console.log("Failures:");
  failures.forEach((f) => {
    console.log(`- ${f.q}`);
    console.log(`  expected scope=${f.expectedScope} intent=${f.expectedIntent}, got intent=${f.gotIntent} finance=${f.gotFinance} inScope=${f.inScope}`);
  });
}
process.exit(rate >= 95 ? 0 : 1);

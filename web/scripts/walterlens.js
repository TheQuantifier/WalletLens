import { api } from "./api.js";

const WELCOME_MESSAGES = [
  "Hi, what's on your mind today?",
  "Hi, what can I help you with?",
  "Hey there! How can I help today?",
  "Hello! Want insights or a quick update?",
  "Welcome back. What would you like to do?",
  "Hi! Ask me about spending, saving, or a record edit.",
];

const SUGGESTION_PROMPTS = [
  "Where am I spending a lot this month?",
  "Where can I save money?",
  "Show expenses last 30 days",
  "List budgets",
  "List recurring",
  "Add record",
  "Add expense 12.50 coffee today",
  "Edit record",
];

const PUBLIC_SUGGESTION_PROMPTS = [
  "What is WalletLens for?",
  "Give me a privacy policy overview",
  "What pages can I use without logging in?",
  "How does WalletLens handle my data?",
  "Summarize terms of service",
  "How do I create an account?",
];

const FALLBACK_MESSAGES = [
  "I can help with spending insights, records, budgets, recurring schedules, rules, and receipts.",
  "Not sure I got that. Ask about spending, savings, or say 'show records last 30 days'.",
  "I can assist with insights or record changes. Try: 'Add expense 12.50 coffee today'.",
  "Want insights or edits? Ask about spending, or say 'edit record <id> amount 45'.",
  "Try a prompt like 'where can I save money?' or 'show expenses this month'.",
];

const PROTECTED_CATEGORIES = [
  "rent",
  "mortgage",
  "housing",
  "grocery",
  "grocer",
  "supermarket",
  "utilities",
  "utility",
  "insurance",
  "medical",
  "health",
  "pharmacy",
  "tuition",
  "childcare",
  "tax",
  "legal",
];

const DISCRETIONARY_HINTS = [
  "entertainment",
  "dining",
  "restaurant",
  "takeout",
  "coffee",
  "cafe",
  "subscription",
  "streaming",
  "shopping",
  "retail",
  "travel",
  "rideshare",
  "games",
  "gaming",
  "hobby",
  "gifts",
  "bars",
];

const LEGAL_KEYWORDS = [
  "legal",
  "lawsuit",
  "attorney",
  "lawyer",
  "court",
  "tax",
  "irs",
  "regulation",
  "contract",
  "compliance",
];

const PUBLIC_PAGES = new Set([
  "index.html",
  "login.html",
  "register.html",
  "privacy.html",
  "terms.html",
  "about.html",
  "careers.html",
  "help.html",
  "",
]);

const RECORD_ID_PATTERN = "([a-f0-9-]{8,}|\\d+)";

const PAGE_SIZE = 500;
const CACHE_TTL_MS = 60 * 1000;
const CATEGORY_TTL_MS = 5 * 60 * 1000;

const normalizeKey = (value) => String(value || "").trim().toLowerCase();
const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) => normalizeText(value).split(" ").filter(Boolean);

const isProtectedCategory = (name) =>
  PROTECTED_CATEGORIES.some((token) => normalizeKey(name).includes(token));
const isDiscretionaryCategory = (name) =>
  DISCRETIONARY_HINTS.some((token) => normalizeKey(name).includes(token));

const STOPWORDS = new Set(["and", "or", "of", "the", "a", "an"]);
const categoryTokens = (value) =>
  tokenize(value).filter((token) => token.length > 1 && !STOPWORDS.has(token));

const BUDGET_CADENCES = new Set([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi-annually",
  "yearly",
]);

const BUDGET_CATEGORY_LABELS = [
  "Housing",
  "Utilities",
  "Groceries",
  "Transportation",
  "Dining",
  "Health",
  "Entertainment",
  "Shopping",
  "Membership",
  "Miscellaneous",
  "Education",
  "Giving",
  "Savings",
];

const BUDGET_CATEGORY_COLUMNS = new Map([
  ["housing", "Housing"],
  ["utilities", "Utilities"],
  ["groceries", "Groceries"],
  ["transportation", "Transportation"],
  ["dining", "Dining"],
  ["health", "Health"],
  ["entertainment", "Entertainment"],
  ["shopping", "Shopping"],
  ["membership", "Membership"],
  ["miscellaneous", "Miscellaneous"],
  ["education", "Education"],
  ["giving", "Giving"],
  ["savings", "Savings"],
]);

const NORMALIZED_BUDGET_CATEGORY = new Map(
  BUDGET_CATEGORY_LABELS.map((label) => [normalizeText(label), label])
);

const RECURRING_FREQUENCIES = new Set(["weekly", "monthly", "yearly"]);
const WEEKDAY_TOKENS = new Map([
  ["monday", 1],
  ["mon", 1],
  ["tuesday", 2],
  ["tue", 2],
  ["tues", 2],
  ["wednesday", 3],
  ["wed", 3],
  ["thursday", 4],
  ["thu", 4],
  ["thur", 4],
  ["thurs", 4],
  ["friday", 5],
  ["fri", 5],
  ["saturday", 6],
  ["sat", 6],
  ["sunday", 0],
  ["sun", 0],
]);

let categoriesCache = { ts: 0, expense: [], income: [] };

const loadCategories = async () => {
  if (Date.now() - categoriesCache.ts < CATEGORY_TTL_MS && categoriesCache.expense.length) {
    return categoriesCache;
  }
  const data = await api.records.categories();
  categoriesCache = {
    ts: Date.now(),
    expense: Array.isArray(data?.expense) ? data.expense : [],
    income: Array.isArray(data?.income) ? data.income : [],
  };
  return categoriesCache;
};

const getAllowedCategories = (type) => {
  if (type === "income") return categoriesCache.income || [];
  return categoriesCache.expense || [];
};

const formatCategoryList = (type) => getAllowedCategories(type).join(", ");

const normalizeCategory = (value) => normalizeText(value);

const scoreCategoryMatch = (input, category) => {
  const inputTokens = new Set(categoryTokens(input));
  const catTokens = categoryTokens(category);
  let score = 0;
  catTokens.forEach((t) => {
    if (inputTokens.has(t)) score += 1;
  });
  return score;
};

const pickCategory = (input, type) => {
  if (!input) return null;
  const normalized = normalizeCategory(input);
  const options = getAllowedCategories(type);
  const exact = options.find((c) => normalizeCategory(c) === normalized);
  if (exact) return exact;

  let best = null;
  let bestScore = 0;
  options.forEach((opt) => {
    const score = scoreCategoryMatch(input, opt);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  });

  return bestScore > 0 ? best : null;
};

const findCategoryInText = (text, type) => {
  if (!text) return null;
  const options = getAllowedCategories(type);
  let best = null;
  let bestScore = 0;
  options.forEach((opt) => {
    const score = scoreCategoryMatch(text, opt);
    if (score > bestScore) {
      bestScore = score;
      best = opt;
    }
  });
  return bestScore > 0 ? best : null;
};

const parseISODate = (iso) => {
  if (!iso) return null;
  if (typeof iso !== "string") return new Date(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00`);
  return new Date(iso);
};

const todayDateOnly = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDateOnly = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const relativeDateToISO = (value) => {
  const key = normalizeKey(value);
  const now = new Date();
  if (key === "today") return todayDateOnly();
  if (key === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return null;
};

const MONTHS = new Map([
  ["january", 1],
  ["jan", 1],
  ["february", 2],
  ["feb", 2],
  ["march", 3],
  ["mar", 3],
  ["april", 4],
  ["apr", 4],
  ["may", 5],
  ["june", 6],
  ["jun", 6],
  ["july", 7],
  ["jul", 7],
  ["august", 8],
  ["aug", 8],
  ["september", 9],
  ["sep", 9],
  ["sept", 9],
  ["october", 10],
  ["oct", 10],
  ["november", 11],
  ["nov", 11],
  ["december", 12],
  ["dec", 12],
]);

const parseMonthNameDate = (text) => {
  const match = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i
  );
  if (!match) return null;
  const monthKey = match[1].toLowerCase();
  const month = MONTHS.get(monthKey);
  const day = Number(match[2]);
  const explicitYear = match[3] ? Number(match[3]) : null;
  if (!month || !day || day < 1 || day > 31) return null;
  const now = new Date();
  let year = explicitYear || now.getFullYear();
  let candidate = new Date(year, month - 1, day);

  if (candidate.getMonth() + 1 !== month || candidate.getDate() !== day) return null;

  if (!explicitYear) {
    // Prefer the most recent occurrence for month/day mentions.
    if (candidate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
      year -= 1;
      candidate = new Date(year, month - 1, day);
      if (candidate.getMonth() + 1 !== month || candidate.getDate() !== day) return null;
    }
  }

  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
};

const stripDatePhrases = (text) =>
  text.replace(
    /\b(on|for|date)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    " "
  );

const extractAmountFromText = (text) => {
  if (!text) return null;
  const cleaned = stripDatePhrases(text);

  const keywordMatch = cleaned.match(
    /\bamount\s+(?:to\s+)?\$?([0-9]+(?:\.[0-9]{1,2})?)\b/i
  );
  if (keywordMatch) return Number(keywordMatch[1]);

  const currencyMatch = cleaned.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)\b/);
  if (currencyMatch) return Number(currencyMatch[1]);

  const addMatch = cleaned.match(/\badd\s+([0-9]+(?:\.[0-9]{1,2})?)\b/i);
  if (addMatch) return Number(addMatch[1]);

  const anyMatch = cleaned.match(/\b([0-9]+(?:\.[0-9]{1,2})?)\b/);
  if (anyMatch) return Number(anyMatch[1]);

  return null;
};

const isLegalQuery = (text) => {
  const key = normalizeKey(text);
  return LEGAL_KEYWORDS.some((token) => key.includes(token));
};

const pickWelcome = () =>
  WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];

const pickFallback = () =>
  FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];

const fmtMoney = (value, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    Number(value) || 0
  );

const getMonthKey = (d) => {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const filterByRange = (records, range) => {
  if (!range || !range.start || !range.end) return records;
  return (records || []).filter((r) => {
    const d = parseISODate(r?.date);
    if (!d || Number.isNaN(d.getTime())) return false;
    return d >= range.start && d <= range.end;
  });
};

const buildRange = (start, end, label) => ({
  start,
  end,
  label,
});

const parseExplicitRange = (text) => {
  const match = text.match(
    /\b(?:between|from)\s+(\d{4}-\d{2}-\d{2})\s+(?:and|to)\s+(\d{4}-\d{2}-\d{2})\b/i
  );
  if (!match) return null;
  const start = parseISODate(match[1]);
  const end = parseISODate(match[2]);
  if (!start || !end) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return buildRange(start, end, `from ${match[1]} to ${match[2]}`);
};

const parseSingleDateMention = (text) => {
  const direct = text.match(/\b(?:on|for|date)\s+(\d{4}-\d{2}-\d{2}|today|yesterday)\b/i);
  const bare = text.match(/\b(\d{4}-\d{2}-\d{2}|today|yesterday)\b/i);
  const token = direct?.[1] || bare?.[1] || "";
  if (token) {
    return relativeDateToISO(token) || token;
  }
  return parseMonthNameDate(text) || "";
};

const detectRange = (text) => {
  const key = normalizeText(text);
  const explicit = parseExplicitRange(text);
  if (explicit) return explicit;
  const singleDate = parseSingleDateMention(text);
  if (singleDate) {
    const day = parseISODate(singleDate);
    if (day && !Number.isNaN(day.getTime())) {
      const start = new Date(day);
      const end = new Date(day);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return buildRange(start, end, singleDate);
    }
  }

  const lastDaysMatch = key.match(/\blast\s+(\d+)\s+days?\b/);
  if (lastDaysMatch) {
    const days = Math.max(1, Number(lastDaysMatch[1]));
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    return buildRange(start, end, `last ${days} days`);
  }

  const now = new Date();
  if (key.includes("this week")) {
    const start = new Date(now);
    const day = start.getDay();
    const mondayOffset = (day + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return buildRange(start, end, "this week");
  }
  if (key.includes("last week")) {
    const end = new Date(now);
    const day = end.getDay();
    const mondayOffset = (day + 6) % 7;
    end.setDate(end.getDate() - mondayOffset - 1);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return buildRange(start, end, "last week");
  }
  if (key.includes("this month")) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return buildRange(start, end, "this month");
  }
  if (key.includes("last month")) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return buildRange(start, end, "last month");
  }
  if (key.includes("this year")) {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return buildRange(start, end, "this year");
  }
  if (key.includes("last year")) {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() - 1, 11, 31);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return buildRange(start, end, "last year");
  }
  return null;
};

let publicDocsCache = { ts: 0, docs: [] };

const PUBLIC_DOC_SOURCES = [
  { page: "privacy.html", topic: "privacy" },
  { page: "terms.html", topic: "terms" },
  { page: "help.html", topic: "help" },
];

const PUBLIC_APP_NAME = "WalletLens";
let conversationAppName = PUBLIC_APP_NAME;

const PUBLIC_CONTENT_ROOT_SELECTORS = [
  "main",
  ".legal-content",
  ".legal-placeholder",
  ".nf-about-inner",
  ".nf-hero-content",
  "article",
];

const cleanPublicText = (value) =>
  String(value || "")
    .replace(/<\s*appname\s*>/gi, PUBLIC_APP_NAME)
    .replace(/\s+/g, " ")
    .trim();

const parseMentionedAppName = (question) => {
  const raw = String(question || "");
  const match = raw.match(/\b(walletwise|walletlens)\b/i);
  if (!match) return "";
  const token = match[1].toLowerCase();
  if (token === "walletwise") return "WalletWise";
  return "WalletLens";
};

const detectMentionedAppName = (question) => {
  const parsed = parseMentionedAppName(question);
  return parsed || conversationAppName || PUBLIC_APP_NAME;
};

const isLikelyUiText = (value) => {
  const text = cleanPublicText(value);
  if (!text) return true;
  if (text.length < 20 && /^[\w\s.'’-]+$/.test(text)) return true;
  if (/^(click here|submit|send|cancel|close|login|register|privacy|terms)$/i.test(text)) return true;
  return false;
};

const extractPublicDocumentText = (html) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ""), "text/html");
    doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());

    const roots = PUBLIC_CONTENT_ROOT_SELECTORS
      .map((selector) => Array.from(doc.querySelectorAll(selector)))
      .flat();
    const sourceRoots = roots.length ? roots : [doc.body];

    const seen = new Set();
    const lines = [];
    sourceRoots.forEach((root) => {
      if (!root) return;
      const nodes = root.querySelectorAll("h1, h2, h3, p, li");
      nodes.forEach((node) => {
        if (
          node.closest(
            "header, footer, nav, form, button, label, .auth-links, .nf-legal, .walterlens-widget"
          )
        ) {
          return;
        }
        const text = cleanPublicText(node.textContent || "");
        if (!text || isLikelyUiText(text) || seen.has(text)) return;
        seen.add(text);
        lines.push(/[.!?]$/.test(text) ? text : `${text}.`);
      });
    });

    return lines.join(" ");
  } catch {
    return "";
  }
};

const splitSentences = (text) =>
  String(text || "")
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 35);

const getQuestionTokens = (question) => {
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "to",
    "of",
    "in",
    "on",
    "is",
    "are",
    "can",
    "you",
    "i",
    "me",
    "my",
    "what",
    "how",
  ]);
  return tokenize(question).filter((t) => t.length > 2 && !stop.has(t));
};

const detectPublicTopic = (question) => {
  const key = normalizeText(question);
  if (/\b(login|log in|sign in|signin|access account)\b/.test(key)) {
    return "login";
  }
  if (
    /\b(register|registration|sign up|signup|new account)\b/.test(key) ||
    /\b(create|make|open)\s+(?:an?\s+)?account\b/.test(key)
  ) {
    return "account";
  }
  if (/\b(privacy|data|collect|share|tracking|cookies|personal information)\b/.test(key)) {
    return "privacy";
  }
  if (/\b(terms|legal|tos|agreement|liability|disclaimer)\b/.test(key)) {
    return "terms";
  }
  if (/\b(help|support|contact|how do i|how to|troubleshoot|issue)\b/.test(key)) {
    return "help";
  }
  return "general";
};

const isPublicInfoQuestion = (question) => detectPublicTopic(question) !== "general";

const rankSentences = (question, docs, preferredTopic = "general") => {
  const qTokens = getQuestionTokens(question);
  const scored = [];
  (docs || []).forEach((doc) => {
    const sentences = splitSentences(doc.text);
    sentences.forEach((sentence) => {
      const sTokens = new Set(tokenize(sentence));
      let score = 0;
      qTokens.forEach((t) => {
        if (sTokens.has(t)) score += 1;
      });
      if (doc.topic === "privacy" && qTokens.includes("privacy")) score += 1;
      if (doc.topic === "terms" && (qTokens.includes("terms") || qTokens.includes("legal"))) score += 1;
      if (preferredTopic !== "general" && doc.topic === preferredTopic) score += 2;
      if (preferredTopic === "about" && /\b(walletlens|track|receipt|expense|finance|record)\b/i.test(sentence)) {
        score += 1;
      }
      if (score > 0) scored.push({ sentence, score, topic: doc.topic, page: doc.page });
    });
  });
  return scored.sort((a, b) => b.score - a.score);
};

const hasAny = (text, regex) => regex.test(String(text || "").toLowerCase());

const composePublicTopicResponse = (question, topic, docs) => {
  const corpus = (docs || []).map((d) => d.text || "").join(" ").toLowerCase();
  const q = normalizeText(question);
  const appName = detectMentionedAppName(question);

  if (topic === "login") {
    return `To log in to ${appName}, open the Login page, enter your email/username and password, then submit. If you use Google sign-in, choose the Google option on that page.`;
  }

  if (topic === "account") {
    return `To create an account in ${appName}, open the Register page, enter your name/email/password, accept the terms, and submit. You can also use Google registration if you prefer.`;
  }


  if (topic === "privacy") {
    const mentionsProviders = hasAny(corpus, /\bservice provider|third-party|hosting|cloud|storage|email|ocr|ai\b/);
    const mentionsControls = hasAny(corpus, /\bchoice|control|rights|delete|access|opt\b/);
    const mentionsCollection = hasAny(corpus, /\bcollect|information|data|account|usage\b/);
    const parts = [`The Privacy Policy explains what data ${appName} handles and why it is needed to run the product.`];
    if (mentionsCollection) parts.push("That generally includes account and usage-related information required for core features.");
    if (mentionsProviders) parts.push("It may rely on vetted infrastructure providers to operate services like storage, email, or processing.");
    if (mentionsControls) parts.push("The policy also outlines user choices and controls over personal information.");
    return parts.slice(0, 3).join(" ");
  }

  if (topic === "terms") {
    const parts = [
      `The Terms of Service for ${appName} cover account responsibilities, acceptable use, and service limitations.`,
      "They also describe ownership/licensing boundaries and important liability/disclaimer language.",
      "For exact legal wording, review the full Terms page directly.",
    ];
    return parts.join(" ");
  }

  if (topic === "help") {
    const parts = [
      "The Help content is intended to guide setup, common workflows, and troubleshooting.",
      "If your question is account-specific, using the in-app support/contact path is the fastest route.",
    ];
    return parts.join(" ");
  }

  if (/\bwhat is|what does|this app|app for|walletlens\b/.test(q)) {
    return `${appName} is built to help manage personal finances by organizing records, receipts, and spending insights in one place.`;
  }
  if (/\bprivacy|data\b/.test(q)) {
    return `At a high level, ${appName} privacy information explains data use for product functionality, security, and user controls.`;
  }
  if (/\bterms|legal\b/.test(q)) {
    return `${appName} terms describe usage rules and legal boundaries for the service.`;
  }

  return `I can summarize ${appName} public pages in plain language, including About, Privacy, Terms, and Help.`;
};

const loadPublicDocs = async () => {
  if (Date.now() - publicDocsCache.ts < CATEGORY_TTL_MS && publicDocsCache.docs.length) {
    return publicDocsCache.docs;
  }
  const docs = await Promise.all(
    PUBLIC_DOC_SOURCES.map(async ({ page, topic }) => {
      try {
        const res = await fetch(page);
        if (!res.ok) return { page, topic, text: "" };
        const html = await res.text();
        return { page, topic, text: extractPublicDocumentText(html) };
      } catch {
        return { page, topic, text: "" };
      }
    })
  );
  publicDocsCache = { ts: Date.now(), docs };
  return docs;
};

const buildPublicFallback = (question) => {
  const key = normalizeText(question);
  const appName = detectMentionedAppName(question);
  if (/\b(login|log in|sign in|signin)\b/.test(key)) {
    return `To log in to ${appName}, use the Login page with your email/username and password, or the Google sign-in option if enabled.`;
  }
  if (/\b(scan|receipt|ocr|upload)\b/.test(key)) {
    return `Yes, ${appName} supports receipt upload/scanning workflows. You can upload receipts and use extraction features described on the public pages.`;
  }
  if (key.includes("privacy") || key.includes("data")) {
    return `${appName} privacy details are on the Privacy page. In short: it explains what information is collected, how it is used, and your available controls.`;
  }
  if (key.includes("terms") || key.includes("legal")) {
    return `${appName} Terms of Service describe account responsibilities, acceptable use, and important legal disclaimers.`;
  }
  if (key.includes("what") || key.includes("about") || key.includes("app")) {
    return `${appName} helps track finances by organizing records, receipts, and spending insights.`;
  }
  return `I can answer questions about ${appName} public pages like Privacy, Terms, Help, login, and registration.`;
};

const answerPublicQuestion = async (question) => {
  const parsedName = parseMentionedAppName(question);
  if (parsedName) conversationAppName = parsedName;
  const docs = await loadPublicDocs();
  const topic = detectPublicTopic(question);
  const filteredDocs = topic === "general" ? docs : docs.filter((d) => d.topic === topic);
  const topicalDocs = filteredDocs.length ? filteredDocs : docs;
  const ranked = rankSentences(question, topicalDocs, topic);
  if (!ranked.length) return buildPublicFallback(question);
  return composePublicTopicResponse(question, topic, topicalDocs);
};

let recordsCache = { ts: 0, data: [] };
const loadAllRecords = async () => {
  if (Date.now() - recordsCache.ts < CACHE_TTL_MS && recordsCache.data.length) {
    return recordsCache.data;
  }
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const batch = await api.records.getAll({ limit: PAGE_SIZE, offset });
    const rows = Array.isArray(batch) ? batch : batch?.records || batch?.data || [];
    all.push(...rows);
    if (!Array.isArray(rows) || rows.length < PAGE_SIZE) break;
  }
  recordsCache = { ts: Date.now(), data: all };
  return all;
};

const summarizeSpending = (records) => {
  const expenses = (records || []).filter((r) => r.type === "expense");
  const income = (records || []).filter((r) => r.type === "income");
  const totalExp = expenses.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalInc = income.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const byCategory = new Map();
  expenses.forEach((r) => {
    const key = r.category || "Uncategorized";
    byCategory.set(key, (byCategory.get(key) || 0) + Number(r.amount || 0));
  });

  const topCats = [...byCategory.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { totalExp, totalInc, topCats };
};

const hasMultipleCurrencies = (records) => {
  const set = new Set(
    (records || [])
      .map((r) => String(r.currency || "USD").toUpperCase())
      .filter(Boolean)
  );
  return set.size > 1;
};

const formatRecordLine = (record) => {
  const d = parseISODate(record?.date);
  const dateLabel = d ? formatDateOnly(d) : "Unknown date";
  const currency = record?.currency || "USD";
  const amountLabel = fmtMoney(record?.amount || 0, currency);
  const typeLabel = record?.type === "income" ? "Income" : "Expense";
  const category = record?.category || "Uncategorized";
  return `${dateLabel} · ${typeLabel} · ${category} · ${amountLabel}`;
};

const formatRecordDisplay = (record) => {
  const note = String(record?.note || "").trim();
  if (note) return note;
  const category = record?.category || "Uncategorized";
  const d = parseISODate(record?.date);
  const dateLabel = d ? formatDateOnly(d) : "Unknown date";
  return `${category} on ${dateLabel}`;
};

const scoreMatch = (query, candidate) => {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.9;
  const qTokens = new Set(tokenize(q));
  const cTokens = new Set(tokenize(c));
  let overlap = 0;
  qTokens.forEach((t) => {
    if (cTokens.has(t)) overlap += 1;
  });
  if (overlap) {
    return overlap / Math.max(qTokens.size, cTokens.size);
  }
  return 0;
};

const pickBestMatch = (query, candidates) => {
  let best = null;
  let score = 0;
  (candidates || []).forEach((candidate) => {
    const s = scoreMatch(query, candidate);
    if (s > score) {
      score = s;
      best = candidate;
    }
  });
  return score >= 0.45 ? best : null;
};

const extractCategoryHint = (text) => {
  const catMatch = text.match(
    /\b(?:category|on|in|for)\s+([a-zA-Z0-9 &-]{2,})\b/i
  );
  if (catMatch) return catMatch[1].trim();
  return null;
};

const parseRecordFilter = (text, categories) => {
  const key = normalizeText(text);
  const typeMatch = key.match(/\b(expense|expenses|income)\b/);
  const type =
    typeMatch && typeMatch[1].includes("income") ? "income" : typeMatch ? "expense" : null;

  const categoryHint = extractCategoryHint(text);
  const category = categoryHint ? pickBestMatch(categoryHint, categories) : null;

  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const date = dateMatch ? dateMatch[1] : null;

  return { type, category, date };
};

const filterRecords = (records, filter) => {
  let out = records;
  if (filter?.type) out = out.filter((r) => r.type === filter.type);
  if (filter?.category) {
    out = out.filter((r) => normalizeText(r.category) === normalizeText(filter.category));
  }
  if (filter?.date) {
    out = out.filter((r) => {
      const d = parseISODate(r?.date);
      if (!d || Number.isNaN(d.getTime())) return false;
      return formatDateOnly(d) === filter.date;
    });
  }
  return out;
};

const parseRecordEdits = (text) => {
  const idMatch = text.match(
    new RegExp(`\\b(?:edit|update)\\s+(?:record|transaction)\\s+#?${RECORD_ID_PATTERN}\\b`, "i")
  );
  if (!idMatch) return null;
  const id = idMatch[1];

  const amountMatch = text.match(/\bamount\s+(?:to\s+)?([0-9]+(?:\.[0-9]+)?)\b/i);
  const categoryMatch = text.match(
    /\bcategory\s+(.+?)(?:\s+(amount|date|note|type|as)\b|$)/i
  );
  const dateMatch = text.match(/\bdate\s+(\d{4}-\d{2}-\d{2}|today|yesterday)\b/i);
  const noteMatch = text.match(/\bnote\s+(.+)$/i);
  const typeMatch = text.match(/\b(type|as)\s+(income|expense)\b/i);

  const updates = {};
  if (amountMatch) updates.amount = Number(amountMatch[1]);
  if (categoryMatch) updates.category = categoryMatch[1].trim();
  if (dateMatch) {
    const rel = relativeDateToISO(dateMatch[1]);
    updates.date = rel || dateMatch[1];
  } else {
    const named = parseMonthNameDate(text);
    if (named) updates.date = named;
  }
  if (noteMatch) updates.note = noteMatch[1].trim();
  if (typeMatch) updates.type = typeMatch[2];

  return { id, updates };
};

const parseRecordCreate = (text) => {
  const key = normalizeKey(text);
  const matchType = key.match(/\b(expense|income)\b/);
  if (!/\b(add|create|log)\b/.test(key)) return null;
  const type = matchType ? matchType[1] : "expense";

  let amountMatch = text.match(
    /\b(?:expense|income)\b\s+([0-9]+(?:\.\d{1,2})?)\b/i
  );
  if (!amountMatch) {
    amountMatch = text.match(/\badd\s+([0-9]+(?:\.\d{1,2})?)\b/i);
  }
  const amount =
    (amountMatch ? Number(amountMatch[1]) : null) ?? extractAmountFromText(text);
  if (amount === null || Number.isNaN(amount)) return null;

  const categoryMatch =
    text.match(
      /\b(?:expense|income)\b\s+\d+(?:\.\d{1,2})?\s+(.+?)(?:\s+(?:on|date)\s+|$)/i
    ) ||
    text.match(
      /\badd\s+\d+(?:\.\d{1,2})?\s+(.+?)(?:\s+(?:as|for|on|date)\s+|$)/i
    );

  let category = categoryMatch ? categoryMatch[1].trim() : "";
  if (category) {
    category = category.replace(/\b(expense|income)\b/i, "").trim();
  }
  if (!category) {
    category =
      findCategoryInText(text, type) ||
      findCategoryInText(text, "expense") ||
      findCategoryInText(text, "income") ||
      pickCategory(text, type) ||
      pickCategory(text, "expense") ||
      pickCategory(text, "income") ||
      "";
  }

  const dateMatch = text.match(/\b(on|date|for)\s+(\d{4}-\d{2}-\d{2}|today|yesterday)\b/i);
  const dateValue = dateMatch ? dateMatch[2] : null;
  const date =
    (dateValue ? relativeDateToISO(dateValue) || dateValue : null) ||
    parseMonthNameDate(text);

  return { type, amount, category, date };
};

const parseRecordCreateSeed = (text) => {
  const key = normalizeKey(text);
  if (!/\b(add|create|log)\b/.test(key)) return null;

  const matchType = key.match(/\b(expense|income)\b/);
  const type = matchType ? matchType[1] : "";
  const category =
    findCategoryInText(text, type || "expense") ||
    findCategoryInText(text, "income") ||
    "";
  const dateMatch = text.match(/\b(on|date|for)\s+(\d{4}-\d{2}-\d{2}|today|yesterday)\b/i);
  const dateValue = dateMatch ? dateMatch[2] : null;
  const date =
    (dateValue ? relativeDateToISO(dateValue) || dateValue : null) ||
    parseMonthNameDate(text);
  const amount = extractAmountFromText(text);

  if (!type && !category && !date && (amount === null || Number.isNaN(amount))) {
    return null;
  }

  return {
    type: type || "",
    category: category || "",
    amount: Number.isNaN(amount) ? null : amount,
    date: date || null,
  };
};

const parseRecordDelete = (text) => {
  const match = text.match(
    new RegExp(`\\b(?:delete|remove)\\s+(?:record|transaction)\\s+#?${RECORD_ID_PATTERN}\\b`, "i")
  );
  if (!match) return null;
  return { id: match[1] };
};

const parseRecordIdReference = (text) => {
  const match = text.match(
    new RegExp(`\\b(?:record|transaction)\\s+#?${RECORD_ID_PATTERN}\\b`, "i")
  );
  return match ? match[1] : "";
};

const parseReferenceDate = (text) => {
  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2}|today|yesterday)\b/i);
  if (dateMatch) {
    const rel = relativeDateToISO(dateMatch[1]);
    return rel || dateMatch[1];
  }
  return parseMonthNameDate(text) || "";
};

const parseReferenceAmount = (text) => {
  const amountMatch =
    text.match(/\b(?:amount|for|of)\s+\$?([0-9]+(?:\.[0-9]{1,2})?)\b/i) ||
    text.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)\b/i);
  if (amountMatch) {
    const amount = Number(amountMatch[1]);
    return Number.isFinite(amount) ? amount : null;
  }
  const onlyNumber = String(text || "").trim().match(/^([0-9]+(?:\.[0-9]{1,2})?)$/);
  if (!onlyNumber) return null;
  const amount = Number(onlyNumber[1]);
  return Number.isFinite(amount) ? amount : null;
};

const parseBudgetCadence = (text) => {
  const key = normalizeText(text);
  for (const cadence of BUDGET_CADENCES) {
    if (key.includes(cadence.replace("-", " "))) return cadence;
    if (key.includes(cadence)) return cadence;
  }
  return "";
};

const parseBudgetPeriod = (text) => {
  const matchMonth = text.match(/\b(\d{4}-\d{2})\b/);
  if (matchMonth) return matchMonth[1];
  const matchDate = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (matchDate) return matchDate[1];
  const matchYear = text.match(/\b(20\d{2})\b/);
  if (matchYear) return matchYear[1];
  return "";
};

const startOfWeek = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getBudgetPeriodKey = (cadence, now = new Date()) => {
  if (cadence === "weekly" || cadence === "biweekly") {
    return formatDateKey(startOfWeek(now));
  }
  if (cadence === "monthly") {
    return formatMonthKey(now);
  }
  if (cadence === "quarterly") {
    const alignedMonth = Math.floor(now.getMonth() / 3) * 3;
    return formatMonthKey(new Date(now.getFullYear(), alignedMonth, 1));
  }
  if (cadence === "semi-annually") {
    const alignedMonth = Math.floor(now.getMonth() / 6) * 6;
    return formatMonthKey(new Date(now.getFullYear(), alignedMonth, 1));
  }
  if (cadence === "yearly") {
    return String(now.getFullYear());
  }
  return formatMonthKey(now);
};

const formatBudgetPeriodLabel = (cadence, period) => {
  if (!period) return "";
  if (cadence === "weekly" || cadence === "biweekly") {
    return `week of ${period}`;
  }
  if (cadence === "yearly") {
    return period;
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  return period;
};

const parseBudgetQuery = (text) => {
  const key = normalizeText(text);
  if (!key.includes("budget")) return null;
  if (!/\b(what|show|how much|total|budget)\b/.test(key)) return null;
  const category = findBudgetCategoryInText(text);
  let cadence = parseBudgetCadence(text);
  if (!cadence) {
    if (/\bthis month|current month|month\b/.test(key)) cadence = "monthly";
    else if (/\bthis quarter|current quarter|quarter\b/.test(key)) cadence = "quarterly";
    else if (/\bthis year|current year|year\b/.test(key)) cadence = "yearly";
    else if (/\bthis week|current week|week\b/.test(key)) cadence = "weekly";
  }
  const period = parseBudgetPeriod(text) || (cadence ? getBudgetPeriodKey(cadence) : "");
  return { category, cadence, period };
};

const normalizeBudgetCategory = (value) => {
  const key = normalizeText(value);
  if (!key) return null;
  if (NORMALIZED_BUDGET_CATEGORY.has(key)) {
    const label = NORMALIZED_BUDGET_CATEGORY.get(key);
    const column = Array.from(BUDGET_CATEGORY_COLUMNS.entries()).find(
      ([col, lbl]) => lbl === label
    )?.[0];
    return { label, column, isCustom: false };
  }
  for (const [labelKey, label] of NORMALIZED_BUDGET_CATEGORY.entries()) {
    if (labelKey.includes(key) || key.includes(labelKey)) {
      const column = Array.from(BUDGET_CATEGORY_COLUMNS.entries()).find(
        ([col, lbl]) => normalizeText(lbl) === labelKey
      )?.[0];
      return { label, column, isCustom: false };
    }
  }
  return { label: String(value || "").trim(), column: "", isCustom: true };
};

const findBudgetCategoryInText = (text) => {
  const key = normalizeText(text);
  for (const label of BUDGET_CATEGORY_LABELS) {
    const labelKey = normalizeText(label);
    if (key.includes(labelKey)) return normalizeBudgetCategory(label);
  }
  const match = text.match(/\bcategory\s+(.+?)(?:\s+(?:to|for|amount)\b|$)/i);
  if (match?.[1]) return normalizeBudgetCategory(match[1]);
  return null;
};

const sumBudgetSheet = (sheet) => {
  if (!sheet || typeof sheet !== "object") return 0;
  let total = 0;
  BUDGET_CATEGORY_COLUMNS.forEach((label, col) => {
    const value = Number(sheet?.[col]);
    if (Number.isFinite(value)) total += value;
  });
  const custom = Array.isArray(sheet.custom_categories) ? sheet.custom_categories : [];
  custom.forEach((entry) => {
    const value = Number(entry?.amount);
    if (Number.isFinite(value)) total += value;
  });
  return total;
};

const getBudgetCategoryAmount = (sheet, category) => {
  if (!sheet || !category) return null;
  if (!category.isCustom && category.column) {
    const value = Number(sheet?.[category.column]);
    return Number.isFinite(value) ? value : null;
  }
  const custom = Array.isArray(sheet?.custom_categories) ? sheet.custom_categories : [];
  const match = custom.find(
    (entry) => normalizeText(entry?.category) === normalizeText(category.label)
  );
  if (!match) return null;
  const value = Number(match?.amount);
  return Number.isFinite(value) ? value : null;
};

const parseBudgetCommand = (text) => {
  const key = normalizeText(text);
  if (!key.includes("budget")) return null;
  const idMatch = text.match(/\bbudget\s+#?([a-f0-9-]{8,}|\d+)\b/i);
  const amount = parseReferenceAmount(text);
  const category = findBudgetCategoryInText(text);
  const cadence = parseBudgetCadence(text);
  const period = parseBudgetPeriod(text);
  if (/\b(show|view|display)\b/.test(key) && (idMatch || (cadence && period))) {
    return { intent: "show", id: idMatch ? idMatch[1] : "", cadence, period };
  }
  if (/\b(delete|remove)\b/.test(key) && idMatch) {
    return { intent: "delete", id: idMatch[1] };
  }
  if (/\b(list|show|view|display|see)\b/.test(key) && /\bbudgets?\b/.test(key)) {
    return { intent: "list" };
  }
  if (/\b(set|update|change|edit)\b/.test(key)) {
    return {
      intent: "set",
      cadence,
      period,
      category,
      amount,
    };
  }
  if (/\b(create|add)\b/.test(key)) {
    return {
      intent: "create",
      cadence,
      period,
    };
  }
  return null;
};

const parseWeeklyValues = (text) => {
  const tokens = tokenize(text);
  const values = new Set();
  tokens.forEach((token) => {
    const value = WEEKDAY_TOKENS.get(token);
    if (value !== undefined) values.add(value);
  });
  return Array.from(values.values());
};

const parseMonthlyValues = (text) => {
  const values = [];
  const matches = text.match(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/g) || [];
  matches.forEach((m) => {
    const num = Number.parseInt(m, 10);
    if (Number.isInteger(num) && num >= 1 && num <= 31) values.push(num);
  });
  return Array.from(new Set(values));
};

const parseYearlyValues = (text) => {
  const values = [];
  const mdMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/g) || [];
  mdMatch.forEach((token) => {
    const [m, d] = token.split(/[\/\-]/).map((v) => Number.parseInt(v, 10));
    if (!m || !d || m < 1 || m > 12 || d < 1 || d > 31) return;
    values.push(`${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  });
  const named = parseMonthNameDate(text);
  if (named) {
    const [, m, d] = named.split("-");
    if (m && d) values.push(`${m}-${d}`);
  }
  return Array.from(new Set(values));
};

const parseRecurringSeed = (text) => {
  const key = normalizeText(text);
  if (!/\b(recurring|schedule)\b/.test(key)) return null;
  const typeMatch = key.match(/\b(expense|income)\b/);
  const type = typeMatch ? typeMatch[1] : "";
  const amount = parseReferenceAmount(text);
  const categoryMatch = text.match(/\bcategory\s+(.+?)(?:\s+(?:amount|date|start|frequency|on)\b|$)/i);
  const category = categoryMatch ? categoryMatch[1].trim() : "";
  const nameMatch = text.match(/\brecurring\s+(.+?)(?:\s+(?:for|amount|category|start|frequency|on)\b|$)/i);
  const name = nameMatch ? nameMatch[1].trim() : "";
  const frequencyMatch = key.match(/\b(weekly|monthly|yearly)\b/);
  const frequency = frequencyMatch ? frequencyMatch[1] : "";
  const startDateMatch = text.match(/\b(start|starting|from)\s+(\d{4}-\d{2}-\d{2}|today|tomorrow)\b/i);
  const startDateRaw = startDateMatch ? startDateMatch[2] : "";
  const startDate =
    (startDateRaw ? relativeDateToISO(startDateRaw) || startDateRaw : "") || "";
  const recurrenceValues =
    frequency === "weekly"
      ? parseWeeklyValues(text)
      : frequency === "monthly"
        ? parseMonthlyValues(text)
        : frequency === "yearly"
          ? parseYearlyValues(text)
          : [];
  return {
    name,
    type,
    amount,
    category,
    frequency,
    recurrenceValues,
    startDate,
  };
};

const parseRecurringCommand = (text) => {
  const key = normalizeText(text);
  if (!/\b(recurring|schedule)\b/.test(key)) return null;
  const idMatch = text.match(/\brecurring\s+#?([a-f0-9-]{8,}|\d+)\b/i);
  if (/\b(upcoming)\b/.test(key)) return { intent: "upcoming" };
  if (/\b(list|show|view|display)\b/.test(key)) return { intent: "list" };
  if (/\b(pause|resume|enable|disable)\b/.test(key) && idMatch) {
    return {
      intent: "toggle",
      id: idMatch[1],
      active: /\b(resume|enable)\b/.test(key),
    };
  }
  if (/\b(delete|remove)\b/.test(key) && idMatch) {
    return { intent: "delete", id: idMatch[1] };
  }
  if (/\b(create|add|new)\b/.test(key)) {
    return { intent: "create", seed: parseRecurringSeed(text) };
  }
  if (/\b(edit|update|change)\b/.test(key) && idMatch) {
    return { intent: "update", id: idMatch[1], seed: parseRecurringSeed(text) };
  }
  return null;
};

const parseNetWorthCommand = (text) => {
  const key = normalizeText(text);
  if (!/\b(net worth|networth|asset|liability)\b/.test(key)) return null;
  if (/\b(list|show|view|display)\b/.test(key)) return { intent: "list" };
  if (/\b(add|create|new|update|edit|change|delete|remove)\b/.test(key)) {
    return { intent: "blocked" };
  }
  return null;
};

const parseRuleCommand = (text) => {
  const key = normalizeText(text);
  if (!/\b(rule|rules)\b/.test(key)) return null;
  const idMatch = text.match(/\brule\s+#?([a-f0-9-]{8,}|\d+)\b/i);
  if (/\b(apply)\b/.test(key)) return { intent: "apply" };
  if (/\b(list|show|view|display)\b/.test(key)) return { intent: "list" };
  if (/\b(enable|disable)\b/.test(key) && idMatch) {
    return { intent: "toggle", id: idMatch[1], enabled: /\benable\b/.test(key) };
  }
  if (/\b(delete|remove)\b/.test(key) && idMatch) return { intent: "delete", id: idMatch[1] };
  if (/\b(create|add|new)\b/.test(key)) return { intent: "create" };
  if (/\b(update|edit|change)\b/.test(key) && idMatch) return { intent: "update", id: idMatch[1] };
  return null;
};

const parseReceiptCommand = (text) => {
  const key = normalizeText(text);
  if (!/\b(receipt|receipts)\b/.test(key)) return null;
  const idMatch = text.match(/\breceipt\s+#?([a-f0-9-]{8,}|\d+)\b/i);
  if (/\b(list|show|view|display)\b/.test(key)) return { intent: "list" };
  if (/\b(delete|remove)\b/.test(key) && idMatch) return { intent: "delete", id: idMatch[1] };
  return null;
};

const parseNotificationCommand = (text) => {
  const key = normalizeText(text);
  if (!/\b(notification|notifications|alert|alerts)\b/.test(key)) return null;
  if (/\b(list|show|view|display)\b/.test(key)) return { intent: "list" };
  if (/\b(dismiss|clear|update|edit|delete|remove)\b/.test(key)) return { intent: "blocked" };
  return null;
};

const parseActivityCommand = (text) => {
  const key = normalizeText(text);
  if (!/\b(activity|recent activity)\b/.test(key)) return null;
  return { intent: "list" };
};

const parseAchievementsCommand = (text) => {
  const key = normalizeText(text);
  if (!/\b(achievement|achievements|badge|badges)\b/.test(key)) return null;
  return { intent: "list" };
};

const parseRecordReferenceHints = (text, records = []) => {
  const key = normalizeText(text);
  const typeMatch = key.match(/\b(expense|expenses|income)\b/);
  const type =
    typeMatch && typeMatch[1].includes("income") ? "income" : typeMatch ? "expense" : "";
  const categories = [...new Set((records || []).map((r) => r.category).filter(Boolean))];
  const categoryHint = extractCategoryHint(text);
  const category =
    (categoryHint ? pickBestMatch(categoryHint, categories) : null) ||
    pickBestMatch(text, categories) ||
    "";
  const date = parseReferenceDate(text);
  const amount = parseReferenceAmount(text);
  const noteMatch = text.match(/\bnote\s+(.+)$/i);
  const note = noteMatch ? noteMatch[1].trim() : "";

  const freeText = text
    .replace(/\b(edit|update|change|delete|remove)\b/gi, " ")
    .replace(/\b(record|transaction)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { type, category, date, amount, note, freeText };
};

const filterRecordsByReferenceHints = (records, hints = {}) => {
  let out = records.slice();
  if (hints.type) {
    out = out.filter((r) => normalizeText(r.type) === normalizeText(hints.type));
  }
  if (hints.category) {
    out = out.filter(
      (r) => normalizeText(r.category || "") === normalizeText(hints.category || "")
    );
  }
  if (hints.date) {
    out = out.filter((r) => {
      const d = parseISODate(r?.date);
      if (!d || Number.isNaN(d.getTime())) return false;
      return formatDateOnly(d) === hints.date;
    });
  }
  if (hints.amount !== null && hints.amount !== undefined) {
    out = out.filter((r) => Math.abs(Number(r.amount || 0) - Number(hints.amount)) < 0.01);
  }
  if (hints.note) {
    out = out.filter((r) => scoreMatch(hints.note, r?.note || "") >= 0.45);
  }
  if (hints.freeText) {
    out = out.filter(
      (r) =>
        scoreMatch(hints.freeText, r?.note || "") >= 0.45 ||
        scoreMatch(hints.freeText, r?.category || "") >= 0.45
    );
  }
  return out;
};

const recordExactTs = (record) => {
  const d1 = parseISODate(record?.created_at || record?.createdAt);
  if (d1 && !Number.isNaN(d1.getTime())) return d1.getTime();
  const d2 = parseISODate(record?.date);
  if (d2 && !Number.isNaN(d2.getTime())) return d2.getTime();
  return 0;
};

const formatRecordWithExactTime = (record, orderLabel) => {
  const dt = parseISODate(record?.created_at || record?.createdAt || record?.date);
  const timeLabel = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : "unknown time";
  const typeLabel = record?.type === "income" ? "Income" : "Expense";
  const category = record?.category || "Uncategorized";
  const amountLabel = fmtMoney(record?.amount || 0, record?.currency || "USD");
  return `${orderLabel}. ${timeLabel} · ${typeLabel} · ${category} · ${amountLabel}`;
};

const parseRecordLookup = (text, records) => {
  const key = normalizeText(text);
  if (!/\b(edit|update|change)\b/.test(key)) return null;
  if (new RegExp(`\\brecord\\s+#?${RECORD_ID_PATTERN}\\b`, "i").test(text)) return null;

  const categoryHint = extractCategoryHint(text);
  const amountMatch = text.match(/\bamount\s+(?:to\s+)?([0-9]+(?:\.[0-9]+)?)\b/i);
  const dateMatch = text.match(/\bdate\s+(\d{4}-\d{2}-\d{2}|today|yesterday)\b/i);
  const noteMatch = text.match(/\bnote\s+(.+)$/i);

  const filters = {};
  if (categoryHint) filters.category = categoryHint;
  if (amountMatch) filters.amount = Number(amountMatch[1]);
  if (dateMatch) {
    const rel = relativeDateToISO(dateMatch[1]);
    filters.date = rel || dateMatch[1];
  }
  if (noteMatch) filters.note = noteMatch[1].trim();

  const freeText = text
    .replace(/\b(edit|update|change)\b/i, "")
    .trim();

  if (!Object.keys(filters).length && !freeText) return null;

  const candidates = records
    .map((r) => {
      let score = 0;
      if (filters.category && r.category) {
        score += scoreMatch(filters.category, r.category) * 2;
      }
      if (filters.amount !== undefined) {
        score += Math.abs(Number(r.amount || 0) - filters.amount) < 0.01 ? 2 : 0;
      }
      if (filters.date) {
        const d = parseISODate(r.date);
        if (d && formatDateOnly(d) === filters.date) score += 2;
      }
      if (filters.note && r.note) {
        score += scoreMatch(filters.note, r.note);
      }
      if (freeText) {
        if (r.note) score += scoreMatch(freeText, r.note) * 2;
        if (r.category) score += scoreMatch(freeText, r.category);
      }
      return { record: r, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 2) return null;
  return best.record;
};

const detectIntent = (text) => {
  const key = normalizeText(text);
  if (/\b(delete|remove)\b/.test(key)) {
    if (/\b(record|records|transaction|transactions|entry|entries|expense|expenses|income|incomes|receipt|receipts|category|categories)\b/.test(key)) {
      return "delete";
    }
    return "unknown";
  }
  if (/\b(edit|update|change)\b/.test(key)) {
    if (/\b(record|records|transaction|transactions|entry|entries|expense|expenses|income|incomes|category|categories|amount|note|date)\b/.test(key)) {
      return "edit";
    }
    return "unknown";
  }
  if (/\b(add|create|log)\b/.test(key)) {
    if (
      /\b(record|records|transaction|transactions|entry|entries|expense|expenses|income|incomes|category|categories|budget|budgets)\b/.test(key) ||
      /\$\s*\d|\b\d+(?:\.\d{1,2})?\b/.test(key)
    ) {
      return "create";
    }
  }
  if (
    /\brecord\s+(?:my|an?|expense|income)\b/.test(key) ||
    /\brecord\s+\$?\d/.test(key)
  ) {
    return "create";
  }
  if (/\b(what|which)\b/.test(key) && /\b(record|records|transaction|transactions|entries)\b/.test(key)) {
    return "list";
  }
  if (/\b(how many|count|number of)\b/.test(key) && /\b(record|records|transaction|transactions|entries|expense|expenses|income)\b/.test(key)) {
    return "list";
  }
  if (/\b(what|which)\b/.test(key) && /\b(spend|spent|spending|expenses|income|net|balance|budget)\b/.test(key)) {
    return "insight";
  }
  if (/\b(show|list|display)\b/.test(key)) {
    if (/\b(record|records|transaction|transactions|entry|entries)\b/.test(key)) return "list";
    if (/\b(spend|spent|spending|expenses|income|summary|insight|total|net|balance|budget|cash flow)\b/.test(key)) return "insight";
    return "unknown";
  }
  if (
    /\b(spend|spent|spending|overspend|expense|expenses|income|earned|earn|make|made|save|reduce|afford|top|insight|summary|total|net|balance|budget|cash flow|surplus|deficit|left over|average|trend)\b/.test(
      key
    )
  ) {
    return "insight";
  }
  return "unknown";
};

const isFinancialQuestion = (text) => {
  const key = normalizeText(text);
  return /\b(spend|spent|spending|overspend|expense|expenses|income|earned|earn|make|made|record|records|transaction|transactions|budget|budgets|category|categories|receipt|receipts|save|saving|savings|total|net|balance|cash flow|surplus|deficit|left over|average|trend|report|reports|finance|financial)\b/.test(
    key
  );
};

const isPrivateDataQuestion = (text) => {
  const key = normalizeText(text);
  const mutatingCommand =
    /\b(add|create|delete|remove|update|edit|change|list|show|view)\b/.test(key) &&
    /\b(record|records|transaction|transactions|budget|budgets|recurring|rules|receipt|receipts|net worth|networth|notification|notifications|settings|profile|activity|achievements)\b/.test(
      key
    );
  const personalFinanceQuery =
    /\b(my|me|mine)\b/.test(key) &&
    /\b(spending|income|expense|record|transaction|budget|recurring|rules|receipt|net worth|networth|notifications|settings|profile)\b/.test(
      key
    );
  return mutatingCommand || personalFinanceQuery;
};

const isLlmFinanceRelevant = (llmResult) => {
  if (!llmResult) return false;
  if (llmResult?.action?.kind) return true;
  if (llmResult?.relevant === true || llmResult?.isRelevant === true) return true;
  if (llmResult?.meta?.relevant === true || llmResult?.metadata?.relevant === true) return true;
  const intent = normalizeKey(llmResult?.intent);
  if (!intent) return false;
  return !["unknown", "refusal", "out_of_scope", "irrelevant", "other"].includes(intent);
};

const isReceiptCapabilityQuestion = (text) => {
  const key = normalizeText(text);
  return (
    /\b(receipt|receipts)\b/.test(key) &&
    /\b(can|does|support|supports|able|capable)\b/.test(key)
  );
};

const isReceiptHistoryQuestion = (text) => {
  const key = normalizeText(text);
  if (!/\b(receipt|receipts)\b/.test(key)) return false;
  if (/\b(what|which|show|list|have|did i|my)\b/.test(key) && /\b(scan|scanned|upload|uploaded)\b/.test(key)) {
    return true;
  }
  return /\b(what|which|show|list|my)\b/.test(key) && /\b(receipt|receipts)\b/.test(key);
};

const simulateMessageHandling = async (text, opts = {}) => {
  const raw = String(text || "").trim();
  const calls = [];
  const deps = {
    loadAllRecords: async () => [],
    walterChat: async () => null,
    listReceipts: async () => [],
    ...opts.deps,
  };
  const state = {
    isPublicMode: false,
    hasPendingAction: false,
    ...opts.state,
  };

  if (!raw) return { route: "empty", calls };

  const key = normalizeKey(raw);
  if (state.isPublicMode) {
    if (isPublicInfoQuestion(raw)) return { route: "public_info", calls };
    if (isPrivateDataQuestion(raw)) return { route: "public_private_data_blocked", calls };
    return { route: "public_fallback", calls };
  }

  if (state.hasPendingAction) {
    if (["yes", "y", "confirm", "ok", "okay", "do it"].includes(key)) {
      return { route: "pending_action_confirmed", calls };
    }
    if (["no", "n", "cancel", "stop"].includes(key)) {
      return { route: "pending_action_cancelled", calls };
    }
    return { route: "pending_action_needs_confirmation", calls };
  }

  if (isPublicInfoQuestion(raw)) return { route: "public_info", calls };
  if (isReceiptCapabilityQuestion(raw)) return { route: "receipt_capability", calls };
  if (isReceiptHistoryQuestion(raw)) {
    calls.push("listReceipts");
    await deps.listReceipts();
    return { route: "receipt_history", calls };
  }

  const earlyIntent = detectIntent(raw);
  if (earlyIntent === "edit" || earlyIntent === "delete") {
    const hasRecordScope =
      /\b(record|transaction|expense|income|category|amount|note|date|today|yesterday)\b/i.test(raw) ||
      Boolean(parseRecordIdReference(raw));
    if (hasRecordScope) {
      calls.push("loadAllRecords");
      await deps.loadAllRecords();
      return { route: `record_resolution_${earlyIntent}`, calls };
    }
  }

  calls.push("loadAllRecords");
  const records = await deps.loadAllRecords();
  const range = detectRange(raw);
  const context = buildLlmContext(records || [], range);
  calls.push("walterChat");
  const llmResult = await deps.walterChat({ message: raw, context });

  if (llmResult?.action?.kind) {
    return { route: `llm_action_${llmResult.action.kind}`, calls };
  }
  if (isLlmFinanceRelevant(llmResult) && llmResult?.reply && detectIntent(raw) === "unknown") {
    return { route: "llm_reply", calls };
  }

  const localIntent = detectIntent(raw);
  if (localIntent === "list") return { route: "local_list", calls };
  if (localIntent === "create") return { route: "local_create", calls };
  if (localIntent === "insight" || isFinancialQuestion(raw)) return { route: "local_insight", calls };
  return { route: "out_of_scope", calls };
};

export const __walterlensTest = {
  detectIntent,
  isFinancialQuestion,
  detectRange,
  isReceiptCapabilityQuestion,
  isReceiptHistoryQuestion,
  isPublicInfoQuestion,
  isLegalQuery,
  isPrivateDataQuestion,
  simulateMessageHandling,
};

const extractCategoryFromText = (text, categories) => {
  const hint = extractCategoryHint(text);
  if (hint) return pickBestMatch(hint, categories);
  return null;
};

const buildLlmContext = (records, range) => {
  const scoped = filterByRange(records, range);
  const { totalExp, totalInc, topCats } = summarizeSpending(scoped);
  const candidateRecords = scoped
    .slice()
    .sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0))
    .slice(0, 25)
    .map((r) => {
      const parsedDate = parseISODate(r?.date);
      const safeDate =
        parsedDate && !Number.isNaN(parsedDate.getTime()) ? formatDateOnly(parsedDate) : "";
      return {
        id: String(r?.id || ""),
        type: String(r?.type || ""),
        amount: Number(r?.amount || 0),
        category: String(r?.category || ""),
        date: safeDate,
        note: String(r?.note || ""),
      };
    });

  const rangeLabel = range?.label || "all time";
  const totals = {
    expenses: totalExp,
    income: totalInc,
    net: totalInc - totalExp,
  };
  return {
    totals,
    topCategories: topCats.slice(0, 5),
    dateRange: rangeLabel,
    currencyNote: hasMultipleCurrencies(scoped)
      ? "Totals include multiple currencies without conversion."
      : "",
    candidateRecords,
  };
};

export function initWalterLens() {
  const existing = document.getElementById("walterlens-widget");
  if (existing) return;
  const rawPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const currentPage = rawPage === "" ? "index.html" : rawPage;
  const isPublicMode = PUBLIC_PAGES.has(currentPage);
  const headerSubtitle = isPublicMode
    ? "Ask about WalletLens, privacy, or terms."
    : "General insights, not legal or tax advice.";
  const inputPlaceholder = isPublicMode
    ? "Ask about WalletLens, privacy, terms, or public pages..."
    : "Ask about spending, saving, or a record edit...";

  const root = document.createElement("div");
  root.id = "walterlens-widget";
  root.className = "walterlens-widget";
  root.innerHTML = `
    <button class="walterlens-fab" aria-expanded="false" aria-controls="walterlens-panel">
      <img class="walterlens-fab__logo" src="images/walterlens.jpeg" alt="WalterLens" />
    </button>
    <section id="walterlens-panel" class="walterlens-panel" aria-hidden="true" role="dialog" aria-label="WalterLens Advisor">
      <div class="walterlens-header">
        <div class="walterlens-title">
          <img class="walterlens-title__logo" src="images/walterlens.jpeg" alt="WalterLens" />
          <div>
            <h3>WalterLens</h3>
            <p>${headerSubtitle}</p>
          </div>
        </div>
        <button class="walterlens-close" type="button" aria-label="Close WalterLens">×</button>
      </div>
      <div class="walterlens-suggestions" aria-label="Suggested prompts"></div>
      <div class="walterlens-messages" aria-live="polite"></div>
      <div class="walterlens-input">
        <input type="text" placeholder="${inputPlaceholder}" />
        <button type="button" class="walterlens-send">Send</button>
      </div>
    </section>
  `;
  document.body.appendChild(root);

  const fab = root.querySelector(".walterlens-fab");
  const panel = root.querySelector(".walterlens-panel");
  const closeBtn = root.querySelector(".walterlens-close");
  const suggestions = root.querySelector(".walterlens-suggestions");
  const messages = root.querySelector(".walterlens-messages");
  const input = root.querySelector("input");
  const sendBtn = root.querySelector(".walterlens-send");

  let hasWelcomed = false;
  let pendingAction = null;
  let pendingEditTarget = null;
  let pendingCreate = null;
  let pendingEditField = null;
  let pendingEditRecord = null;
  let pendingRecordResolution = null;
  let pendingBudget = null;
  let pendingRecurring = null;
  let pendingRule = null;

  const WRITE_PAGE_MAP = {
    record: new Set(["records.html", "reports.html"]),
    budget: new Set(["budgeting.html", "reports.html"]),
    recurring: new Set(["recurring.html", "reports.html"]),
    rules: new Set(["rules.html", "reports.html"]),
  };

  const refreshIfOnPage = (resource) => {
    const pageMap = {
      record: new Set(["records.html"]),
      budget: new Set(["budgeting.html"]),
      recurring: new Set(["recurring.html"]),
      rules: new Set(["rules.html"]),
      receipts: new Set(["upload.html", "records.html"]),
      networth: new Set(["home.html"]),
      notifications: new Set(["home.html"]),
    };
    const targets = pageMap[resource];
    if (!targets || !targets.has(currentPage)) return;
    window.location.reload();
  };

  const canWriteResource = (resource) => {
    const targets = WRITE_PAGE_MAP[resource];
    if (!targets) return false;
    return targets.has(currentPage);
  };

  let isHandlingMessage = false;
  let responseBuffer = [];
  let messageQueue = Promise.resolve();

  const addMessage = (role, text) => {
    if (role === "assistant" && isHandlingMessage) {
      responseBuffer.push(text);
      return;
    }
    const msg = document.createElement("div");
    msg.className = `walterlens-msg walterlens-msg--${role}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  };

  const flushResponses = () => {
    if (!responseBuffer.length) {
      isHandlingMessage = false;
      return;
    }
    const combined = responseBuffer.join("\n");
    responseBuffer = [];
    isHandlingMessage = false;
    addMessage("assistant", combined);
  };

  const renderSuggestions = () => {
    if (!suggestions) return;
    suggestions.innerHTML = "";
    const prompts = isPublicMode ? PUBLIC_SUGGESTION_PROMPTS : SUGGESTION_PROMPTS;
    prompts.forEach((prompt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "walterlens-suggestion";
      btn.textContent = prompt;
      btn.addEventListener("click", () => {
        enqueueMessage(prompt);
      });
      suggestions.appendChild(btn);
    });
  };

  const togglePanel = (open) => {
    const isOpen = open ?? !panel.classList.contains("is-open");
    panel.classList.toggle("is-open", isOpen);
    panel.setAttribute("aria-hidden", String(!isOpen));
    fab.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      input.focus();
      renderSuggestions();
      if (!hasWelcomed) {
        addMessage(
          "assistant",
          isPublicMode
            ? "Hi! I can explain WalletLens and summarize public pages like Privacy, Terms, and Help."
            : pickWelcome()
        );
        hasWelcomed = true;
      }
    }
  };

  const confirmAction = (summary, action) => {
    const normalizedAction = {
      resource: action?.resource || "record",
      ...action,
    };
    if (!canWriteResource(normalizedAction.resource)) {
      addMessage(
        "assistant",
        "I can only make changes on the Records, Budgeting, Recurring, Rules, or Reports pages."
      );
      return;
    }
    pendingAction = normalizedAction;
    addMessage("assistant", `${summary} Reply "yes" to confirm or "no" to cancel.`);
  };

  const executePending = async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    pendingAction = null;
    pendingEditTarget = null;
    pendingCreate = null;
    pendingEditField = null;
    pendingEditRecord = null;
    pendingRecordResolution = null;
    pendingBudget = null;
    pendingRecurring = null;
    pendingRule = null;
    try {
      const resource = action.resource || "record";
      if (!canWriteResource(resource)) {
        addMessage(
          "assistant",
          "I can only make changes on the Records, Budgeting, Recurring, Rules, or Reports pages."
        );
        return;
      }
      if (resource === "record") {
        if (action.kind === "update") {
          await api.records.update(action.id, action.updates);
          recordsCache = { ts: 0, data: [] };
          addMessage("assistant", "Done. The record was updated.");
          refreshIfOnPage("record");
        } else if (action.kind === "delete") {
          await api.records.remove(action.id);
          recordsCache = { ts: 0, data: [] };
          addMessage("assistant", "Done. The record was deleted.");
          refreshIfOnPage("record");
        } else if (action.kind === "create") {
          await api.records.create(action.payload);
          recordsCache = { ts: 0, data: [] };
          addMessage("assistant", "Done. The record was created.");
          refreshIfOnPage("record");
        }
        return;
      }
      if (resource === "budget") {
        if (action.kind === "create") {
          await api.budgetSheets.create({
            cadence: action.cadence,
            period: action.period,
            categories: {},
            customCategories: [],
          });
          addMessage("assistant", "Budget created.");
          refreshIfOnPage("budget");
        } else if (action.kind === "delete") {
          await api.budgetSheets.delete(action.id);
          addMessage("assistant", "Budget deleted.");
          refreshIfOnPage("budget");
        } else if (action.kind === "set") {
          let sheet = null;
          try {
            sheet = await api.budgetSheets.lookup({
              cadence: action.cadence,
              period: action.period,
            });
          } catch (err) {
            if (err?.status !== 404) throw err;
          }
          const category = action.category;
          const amount = action.amount;
          if (!category || amount === null || amount === undefined) {
            throw new Error("Missing budget category or amount.");
          }
          if (sheet?.id) {
            if (category.isCustom) {
              const existing = Array.isArray(sheet.custom_categories) ? sheet.custom_categories : [];
              const next = existing.filter(
                (entry) => normalizeText(entry?.category) !== normalizeText(category.label)
              );
              next.push({ category: category.label, amount });
            await api.budgetSheets.update(sheet.id, { customCategories: next });
          } else {
            await api.budgetSheets.update(sheet.id, {
              categories: { [category.column]: amount },
            });
          }
          addMessage("assistant", "Budget updated.");
          refreshIfOnPage("budget");
        } else {
            const categories = category.isCustom ? {} : { [category.column]: amount };
            const customCategories = category.isCustom
              ? [{ category: category.label, amount }]
              : [];
            await api.budgetSheets.create({
              cadence: action.cadence,
              period: action.period,
              categories,
              customCategories,
            });
            addMessage("assistant", "Budget created.");
            refreshIfOnPage("budget");
          }
        }
        return;
      }
      if (resource === "recurring") {
        if (action.kind === "create") {
          await api.recurring.create(action.payload);
          addMessage("assistant", "Recurring schedule created.");
          refreshIfOnPage("recurring");
        } else if (action.kind === "update") {
          await api.recurring.update(action.id, action.updates);
          addMessage("assistant", "Recurring schedule updated.");
          refreshIfOnPage("recurring");
        } else if (action.kind === "delete") {
          await api.recurring.remove(action.id);
          addMessage("assistant", "Recurring schedule deleted.");
          refreshIfOnPage("recurring");
        }
        return;
      }
      if (resource === "rules") {
        if (action.kind === "create") {
          await api.rules.create(action.payload);
          addMessage("assistant", "Rule created.");
          refreshIfOnPage("rules");
        } else if (action.kind === "update") {
          await api.rules.update(action.id, action.updates);
          addMessage("assistant", "Rule updated.");
          refreshIfOnPage("rules");
        } else if (action.kind === "delete") {
          await api.rules.remove(action.id);
          addMessage("assistant", "Rule deleted.");
          refreshIfOnPage("rules");
        } else if (action.kind === "apply") {
          await api.rules.applyAll();
          addMessage("assistant", "Rules applied.");
          refreshIfOnPage("rules");
        }
        return;
      }
    } catch (err) {
      addMessage("assistant", `I couldn't complete that. ${err?.message || "Try again."}`);
    }
  };

  const cancelPending = () => {
    pendingAction = null;
    pendingEditTarget = null;
    pendingCreate = null;
    pendingEditField = null;
    pendingEditRecord = null;
    pendingRecordResolution = null;
    pendingBudget = null;
    pendingRecurring = null;
    pendingRule = null;
    addMessage("assistant", "Cancelled. No changes were made.");
  };

  const completeRecordResolution = (record, mode) => {
    const proposedUpdates =
      mode === "edit" &&
      pendingRecordResolution?.proposedUpdates &&
      Object.keys(pendingRecordResolution.proposedUpdates).length
        ? pendingRecordResolution.proposedUpdates
        : null;
    pendingRecordResolution = null;
    if (!record?.id) {
      addMessage("assistant", "I couldn't resolve a specific record. Please edit directly from Records.");
      return true;
    }

    if (mode === "delete") {
      confirmAction("I can delete that record.", { kind: "delete", id: record.id });
      return true;
    }

    if (proposedUpdates) {
      const fields = Object.entries(proposedUpdates)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      confirmAction(
        `I can update that record with ${fields}.`,
        { kind: "update", id: record.id, updates: proposedUpdates }
      );
      return true;
    }

    pendingEditTarget = { id: record.id };
    pendingEditRecord = record;
    pendingEditField = null;
    addMessage("assistant", `What would you like to edit for ${formatRecordDisplay(record)}?`);
    return true;
  };

  const askForResolutionDate = () => {
    addMessage(
      "assistant",
      "I found multiple matching records. Please provide the date first (YYYY-MM-DD, today, or yesterday)."
    );
  };

  const askForResolutionAmount = () => {
    addMessage(
      "assistant",
      "I still found multiple records. Please provide the exact amount next (for example, 24.99)."
    );
  };

  const askForResolutionOrder = (matches) => {
    const ordered = matches
      .slice()
      .sort((a, b) => recordExactTs(a) - recordExactTs(b))
      .slice(0, 2);
    addMessage(
      "assistant",
      [
        "There are still two exact matches. Choose by exact date/time order:",
        formatRecordWithExactTime(ordered[0], 1),
        formatRecordWithExactTime(ordered[1], 2),
        'Reply "1" or "2".',
      ].join("\n")
    );
    return ordered;
  };

  const failDuplicateResolution = () => {
    pendingRecordResolution = null;
    addMessage(
      "assistant",
      "I found duplicate records and can't safely choose one. Please edit or delete it directly in the Records page."
    );
    return true;
  };

  const advanceRecordResolution = () => {
    if (!pendingRecordResolution) return false;
    const state = pendingRecordResolution;
    const matches = filterRecordsByReferenceHints(state.records, state.hints);
    state.matches = matches;

    if (!matches.length) {
      addMessage("assistant", "No records matched those details. Please try a different date or amount.");
      return true;
    }
    if (matches.length === 1) {
      return completeRecordResolution(matches[0], state.mode);
    }

    if (!state.hints.date) {
      state.step = "need_date";
      askForResolutionDate();
      return true;
    }
    if (state.hints.amount === null || state.hints.amount === undefined) {
      state.step = "need_amount";
      askForResolutionAmount();
      return true;
    }
    if (matches.length === 2) {
      state.step = "choose_exact";
      state.ordered = askForResolutionOrder(matches);
      return true;
    }
    return failDuplicateResolution();
  };

  const startRecordResolution = (mode, rawText, records, options = {}) => {
    const hints = parseRecordReferenceHints(rawText, records);
    if (!hints.type && !hints.category && !hints.date && hints.amount === null && !hints.note && !hints.freeText) {
      addMessage(
        "assistant",
        "Please include identifying details like category, type, date, or amount so I can find the right record."
      );
      return true;
    }
    pendingRecordResolution = {
      mode,
      rawText,
      records,
      hints,
      proposedUpdates:
        options?.proposedUpdates && typeof options.proposedUpdates === "object"
          ? options.proposedUpdates
          : null,
      matches: [],
      ordered: [],
      step: "initial",
    };
    return advanceRecordResolution();
  };

  const continueRecordResolution = (rawInput) => {
    if (!pendingRecordResolution) return false;
    const state = pendingRecordResolution;
    const key = normalizeText(rawInput);

    if (["cancel", "stop"].includes(key)) {
      pendingRecordResolution = null;
      addMessage("assistant", "Cancelled target selection.");
      return true;
    }

    if (state.step === "need_date") {
      const date = parseReferenceDate(rawInput);
      if (!date) {
        askForResolutionDate();
        return true;
      }
      state.hints.date = date;
      return advanceRecordResolution();
    }

    if (state.step === "need_amount") {
      const amount = parseReferenceAmount(rawInput);
      if (amount === null || amount === undefined) {
        askForResolutionAmount();
        return true;
      }
      state.hints.amount = amount;
      return advanceRecordResolution();
    }

    if (state.step === "choose_exact") {
      const ordered = Array.isArray(state.ordered) ? state.ordered : [];
      const pickFirst = ["1", "first", "earliest", "older"].includes(key);
      const pickSecond = ["2", "second", "latest", "newer"].includes(key);
      if (!pickFirst && !pickSecond) {
        addMessage("assistant", 'Please reply "1" or "2".');
        return true;
      }
      const record = pickSecond ? ordered[1] : ordered[0];
      if (!record) return failDuplicateResolution();
      return completeRecordResolution(record, state.mode);
    }

    return advanceRecordResolution();
  };

  const parseUpdateFieldsOnly = (text) => {
    const amountMatch = text.match(/\bamount\s+(?:to\s+)?([0-9]+(?:\.[0-9]+)?)\b/i);
    const categoryMatch = text.match(
      /\bcategory\s+(.+?)(?:\s+(amount|date|note|type|as)\b|$)/i
    );
    const dateMatch = text.match(/\bdate\s+(\d{4}-\d{2}-\d{2}|today|yesterday)\b/i);
    const noteMatch = text.match(/\bnote\s+(.+)$/i);
    const typeMatch = text.match(/\b(type|as)\s+(income|expense)\b/i);

    const updates = {};
    if (amountMatch) updates.amount = Number(amountMatch[1]);
    if (categoryMatch) updates.category = categoryMatch[1].trim();
    if (dateMatch) {
      const rel = relativeDateToISO(dateMatch[1]);
      updates.date = rel || dateMatch[1];
    }
    if (noteMatch) updates.note = noteMatch[1].trim();
    if (typeMatch) updates.type = typeMatch[2];

    return updates;
  };

  const normalizeFieldName = (text) => {
    const key = normalizeText(text);
    if (key.includes("date")) return "date";
    if (key.includes("amount")) return "amount";
    if (key.includes("category")) return "category";
    if (key.includes("note") || key.includes("description")) return "note";
    if (key.includes("type")) return "type";
    return "";
  };

  const formatFieldValue = (record, field) => {
    if (!record) return "unknown";
    if (field === "date") {
      const d = parseISODate(record.date);
      return d ? formatDateOnly(d) : "unknown";
    }
    if (field === "amount") {
      return fmtMoney(record.amount || 0, record.currency || "USD");
    }
    if (field === "category") {
      return record.category || "Uncategorized";
    }
    if (field === "note") {
      return record.note || "empty";
    }
    if (field === "type") {
      return record.type || "unknown";
    }
    return "unknown";
  };

  const askEditField = () => {
    addMessage("assistant", "Which part should I update: date, amount, category, or note?");
  };

  const askEditNewValue = (field, record) => {
    const current = formatFieldValue(record, field);
    addMessage(
      "assistant",
      `Got it. The ${field} is currently ${current}. What should it be instead?`
    );
  };

  const askCreateType = () => {
    addMessage("assistant", "Are we adding an expense or income?");
  };

  const askCreateCategory = (type) => {
    addMessage(
      "assistant",
      `Which category fits best? Choose one of: ${formatCategoryList(type)}.`
    );
  };

  const askCreateAmount = () => {
    addMessage("assistant", "What’s the amount?");
  };

  const askCreateNoteConfirm = () => {
    addMessage("assistant", "Want to add a note? (yes/no)");
  };

  const askCreateNote = () => {
    addMessage("assistant", "What should the note say?");
  };

  const startCreateFlow = (seed = {}) => {
    pendingCreate = {
      step: "type",
      type: seed.type || "",
      category: seed.category || "",
      amount: seed.amount ?? null,
      date: seed.date || null,
      note: seed.note || "",
      rawText: seed.rawText || "",
    };

    if (pendingCreate.type) {
      const category =
        pickCategory(pendingCreate.category, pendingCreate.type) ||
        findCategoryInText(pendingCreate.rawText, pendingCreate.type);
      if (category) {
        pendingCreate.category = category;
        if (pendingCreate.amount !== null) {
          pendingCreate.step = "note_confirm";
          askCreateNoteConfirm();
          return;
        }
        pendingCreate.step = "amount";
        askCreateAmount();
        return;
      }
      pendingCreate.step = "category";
      askCreateCategory(pendingCreate.type);
      return;
    }

    askCreateType();
  };

  const continueCreateFlow = async (rawInput) => {
    if (!pendingCreate) return false;
    const key = normalizeText(rawInput);

    if (["cancel", "stop"].includes(key)) {
      cancelPending();
      return true;
    }

    if (pendingCreate.step === "type") {
      if (key.includes("expense")) pendingCreate.type = "expense";
      if (key.includes("income")) pendingCreate.type = "income";
      if (!pendingCreate.type) {
        addMessage("assistant", "Please reply with expense or income.");
        return true;
      }
      pendingCreate.step = "category";
      askCreateCategory(pendingCreate.type);
      return true;
    }

    if (pendingCreate.step === "category") {
      const category = pickCategory(rawInput, pendingCreate.type);
      if (!category) {
        addMessage(
          "assistant",
          `Choose one of the default categories: ${formatCategoryList(pendingCreate.type)}.`
        );
        return true;
      }
      pendingCreate.category = category;
      pendingCreate.step = "amount";
      askCreateAmount();
      return true;
    }

    if (pendingCreate.step === "amount") {
      const amountMatch = rawInput.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (!amountMatch) {
        addMessage("assistant", "Please enter a valid amount.");
        return true;
      }
      pendingCreate.amount = Number(amountMatch[1]);
      pendingCreate.step = "note_confirm";
      askCreateNoteConfirm();
      return true;
    }

    if (pendingCreate.step === "note_confirm") {
      if (["yes", "y"].includes(key)) {
        pendingCreate.step = "note";
        askCreateNote();
        return true;
      }
      if (["no", "n"].includes(key)) {
        const summary = `Create ${pendingCreate.type} ${fmtMoney(
          pendingCreate.amount
        )} in ${pendingCreate.category}${pendingCreate.date ? ` on ${pendingCreate.date}` : ""}.`;
        confirmAction(summary, {
          kind: "create",
          payload: {
            type: pendingCreate.type,
            amount: pendingCreate.amount,
            category: pendingCreate.category,
            date: pendingCreate.date,
            note: pendingCreate.note || "",
          },
        });
        return true;
      }
      addMessage("assistant", "Please reply yes or no.");
      return true;
    }

    if (pendingCreate.step === "note") {
      pendingCreate.note = rawInput.trim();
      const summary = `Create ${pendingCreate.type} ${fmtMoney(
        pendingCreate.amount
      )} in ${pendingCreate.category}${pendingCreate.date ? ` on ${pendingCreate.date}` : ""} with a note.`;
      confirmAction(summary, {
        kind: "create",
        payload: {
          type: pendingCreate.type,
          amount: pendingCreate.amount,
          category: pendingCreate.category,
          date: pendingCreate.date,
          note: pendingCreate.note,
        },
      });
      return true;
    }

    return false;
  };

  const startBudgetFlow = (seed = {}) => {
    pendingBudget = {
      step: "cadence",
      cadence: seed.cadence || "",
      period: seed.period || "",
      category: seed.category || null,
      amount: seed.amount ?? null,
      mode: seed.mode || "set",
    };
    if (!pendingBudget.cadence) {
      addMessage("assistant", "Which cadence? (weekly, biweekly, monthly, quarterly, semi-annually, yearly)");
      return;
    }
    if (!pendingBudget.period) {
      addMessage(
        "assistant",
        "Which period key? Use YYYY-MM for monthly/quarterly/semi-annually, YYYY for yearly, or YYYY-MM-DD for weekly/biweekly."
      );
      return;
    }
    if (pendingBudget.mode === "create") {
      confirmAction(
        `Create a ${pendingBudget.cadence} budget for ${pendingBudget.period}.`,
        {
          resource: "budget",
          kind: "create",
          cadence: pendingBudget.cadence,
          period: pendingBudget.period,
        }
      );
      return;
    }
    if (!pendingBudget.category) {
      addMessage("assistant", "Which budget category should I set?");
      return;
    }
    if (pendingBudget.amount === null || pendingBudget.amount === undefined) {
      addMessage("assistant", "What amount should I set for that category?");
      return;
    }
    confirmAction(
      `Set ${pendingBudget.category.label} budget to ${fmtMoney(pendingBudget.amount)} for ${pendingBudget.cadence} ${pendingBudget.period}.`,
      {
        resource: "budget",
        kind: "set",
        cadence: pendingBudget.cadence,
        period: pendingBudget.period,
        category: pendingBudget.category,
        amount: pendingBudget.amount,
      }
    );
  };

  const continueBudgetFlow = (rawInput) => {
    if (!pendingBudget) return false;
    const key = normalizeText(rawInput);
    if (["cancel", "stop"].includes(key)) {
      cancelPending();
      return true;
    }
    if (!pendingBudget.cadence) {
      const cadence = parseBudgetCadence(rawInput);
      if (!cadence) {
        addMessage("assistant", "Please provide a cadence like monthly or weekly.");
        return true;
      }
      pendingBudget.cadence = cadence;
      startBudgetFlow(pendingBudget);
      return true;
    }
    if (!pendingBudget.period) {
      const period = parseBudgetPeriod(rawInput);
      if (!period) {
        addMessage("assistant", "Please provide a period like 2026-03 or 2026-03-10.");
        return true;
      }
      pendingBudget.period = period;
      startBudgetFlow(pendingBudget);
      return true;
    }
    if (pendingBudget.mode !== "create" && !pendingBudget.category) {
      const category = normalizeBudgetCategory(rawInput);
      if (!category || !category.label) {
        addMessage("assistant", "Please provide a budget category name.");
        return true;
      }
      pendingBudget.category = category;
      startBudgetFlow(pendingBudget);
      return true;
    }
    if (pendingBudget.mode !== "create" && (pendingBudget.amount === null || pendingBudget.amount === undefined)) {
      const amount = parseReferenceAmount(rawInput);
      if (amount === null || amount === undefined) {
        addMessage("assistant", "Please provide a valid amount.");
        return true;
      }
      pendingBudget.amount = amount;
      startBudgetFlow(pendingBudget);
      return true;
    }
    return false;
  };

  const startRecurringFlow = (seed = {}) => {
    pendingRecurring = {
      step: "name",
      name: seed.name || "",
      type: seed.type || "",
      amount: seed.amount ?? null,
      category: seed.category || "",
      frequency: seed.frequency || "",
      recurrenceValues: Array.isArray(seed.recurrenceValues) ? seed.recurrenceValues : [],
      startDate: seed.startDate || "",
      note: seed.note || "",
    };
    if (!pendingRecurring.name) {
      addMessage("assistant", "What should this recurring item be called?");
      return;
    }
    if (!pendingRecurring.type) {
      addMessage("assistant", "Is this an expense or income?");
      return;
    }
    if (pendingRecurring.amount === null || pendingRecurring.amount === undefined) {
      addMessage("assistant", "What amount should I use?");
      return;
    }
    if (!pendingRecurring.category) {
      addMessage("assistant", "Which category should I use?");
      return;
    }
    if (!pendingRecurring.frequency) {
      addMessage("assistant", "What frequency? weekly, monthly, or yearly?");
      return;
    }
    if (!pendingRecurring.recurrenceValues.length) {
      addMessage(
        "assistant",
        pendingRecurring.frequency === "weekly"
          ? "Which weekdays? (e.g., Mon, Wed)"
          : pendingRecurring.frequency === "monthly"
            ? "Which days of month? (e.g., 1, 15)"
            : "Which yearly dates? (e.g., 12/25)"
      );
      return;
    }
    if (!pendingRecurring.startDate) {
      addMessage("assistant", "What start date? (YYYY-MM-DD)");
      return;
    }
    confirmAction(
      `Create recurring ${pendingRecurring.name} at ${fmtMoney(pendingRecurring.amount)}.`,
      {
        resource: "recurring",
        kind: "create",
        payload: {
          name: pendingRecurring.name,
          type: pendingRecurring.type,
          amount: pendingRecurring.amount,
          category: pendingRecurring.category,
          note: pendingRecurring.note || "",
          frequency: pendingRecurring.frequency,
          dayOfMonth:
            pendingRecurring.frequency === "monthly" && pendingRecurring.recurrenceValues.length
              ? Number(pendingRecurring.recurrenceValues[0])
              : null,
          recurrenceValues: pendingRecurring.recurrenceValues,
          startDate: pendingRecurring.startDate,
          endDate: null,
          active: true,
        },
      }
    );
  };

  const continueRecurringFlow = (rawInput) => {
    if (!pendingRecurring) return false;
    const key = normalizeText(rawInput);
    if (["cancel", "stop"].includes(key)) {
      cancelPending();
      return true;
    }
    if (!pendingRecurring.name) {
      pendingRecurring.name = rawInput.trim();
      startRecurringFlow(pendingRecurring);
      return true;
    }
    if (!pendingRecurring.type) {
      if (key.includes("expense")) pendingRecurring.type = "expense";
      if (key.includes("income")) pendingRecurring.type = "income";
      if (!pendingRecurring.type) {
        addMessage("assistant", "Please reply with expense or income.");
        return true;
      }
      startRecurringFlow(pendingRecurring);
      return true;
    }
    if (pendingRecurring.amount === null || pendingRecurring.amount === undefined) {
      const amount = parseReferenceAmount(rawInput);
      if (amount === null || amount === undefined) {
        addMessage("assistant", "Please provide a valid amount.");
        return true;
      }
      pendingRecurring.amount = amount;
      startRecurringFlow(pendingRecurring);
      return true;
    }
    if (!pendingRecurring.category) {
      const category =
        pickCategory(rawInput, pendingRecurring.type) ||
        pickCategory(rawInput, "expense") ||
        pickCategory(rawInput, "income");
      if (!category) {
        addMessage("assistant", "Please provide a valid category.");
        return true;
      }
      pendingRecurring.category = category;
      startRecurringFlow(pendingRecurring);
      return true;
    }
    if (!pendingRecurring.frequency) {
      const freq = normalizeText(rawInput);
      if (!RECURRING_FREQUENCIES.has(freq)) {
        addMessage("assistant", "Please reply weekly, monthly, or yearly.");
        return true;
      }
      pendingRecurring.frequency = freq;
      startRecurringFlow(pendingRecurring);
      return true;
    }
    if (!pendingRecurring.recurrenceValues.length) {
      const values =
        pendingRecurring.frequency === "weekly"
          ? parseWeeklyValues(rawInput)
          : pendingRecurring.frequency === "monthly"
            ? parseMonthlyValues(rawInput)
            : parseYearlyValues(rawInput);
      if (!values.length) {
        addMessage("assistant", "Please provide schedule values.");
        return true;
      }
      pendingRecurring.recurrenceValues = values;
      startRecurringFlow(pendingRecurring);
      return true;
    }
    if (!pendingRecurring.startDate) {
      const date = parseReferenceDate(rawInput);
      if (!date) {
        addMessage("assistant", "Please provide a start date in YYYY-MM-DD.");
        return true;
      }
      pendingRecurring.startDate = date;
      startRecurringFlow(pendingRecurring);
      return true;
    }
    return false;
  };

  const parseRuleCondition = (text) => {
    const key = normalizeText(text);
    if (/amount/.test(key)) {
      const between = text.match(/\bbetween\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)\b/i);
      if (between) {
        return {
          field: "amount",
          op: "between",
          value: { min: Number(between[1]), max: Number(between[2]) },
        };
      }
      const cmpMatch = text.match(/\b(>=|<=|>|<|gte|lte|gt|lt)\s*(\d+(?:\.\d+)?)\b/i);
      if (cmpMatch) {
        const opMap = { ">": "gt", "<": "lt", ">=": "gte", "<=": "lte" };
        const op = opMap[cmpMatch[1]] || cmpMatch[1].toLowerCase();
        return { field: "amount", op, value: Number(cmpMatch[2]) };
      }
    }
    const fieldMatch = text.match(/\b(category|note|type|origin)\b/i);
    if (!fieldMatch) return null;
    const field = fieldMatch[1].toLowerCase();
    const opMatch = text.match(/\b(contains|starts with|ends with|equals|is)\b/i);
    const opRaw = opMatch ? opMatch[1].toLowerCase() : "contains";
    const op =
      opRaw === "is" || opRaw === "equals"
        ? "equals"
        : opRaw === "starts with"
          ? "starts_with"
          : opRaw === "ends with"
            ? "ends_with"
            : "contains";
    const valueMatch = text.match(/\b(?:contains|starts with|ends with|equals|is)\s+(.+)$/i);
    const value = valueMatch ? valueMatch[1].trim() : "";
    if (!value) return null;
    return { field, op, value };
  };

  const parseRuleAction = (text) => {
    const matchCategory = text.match(/\bset\s+category\s+to\s+(.+)$/i);
    if (matchCategory) return { type: "setCategory", value: matchCategory[1].trim() };
    const matchAppend = text.match(/\bappend\s+note\s+(.+)$/i);
    if (matchAppend) return { type: "appendNote", value: matchAppend[1].trim() };
    const matchNote = text.match(/\bset\s+note\s+to\s+(.+)$/i);
    if (matchNote) return { type: "setNote", value: matchNote[1].trim() };
    const matchType = text.match(/\bset\s+type\s+to\s+(income|expense)\b/i);
    if (matchType) return { type: "setType", value: matchType[1].trim() };
    return null;
  };

  const startRuleFlow = (seed = {}) => {
    pendingRule = {
      step: "name",
      name: seed.name || "",
      condition: seed.condition || null,
      action: seed.action || null,
    };
    if (!pendingRule.name) {
      addMessage("assistant", "What should this rule be called?");
      return;
    }
    if (!pendingRule.condition) {
      addMessage(
        "assistant",
        "Describe the condition (e.g., category contains coffee, amount > 50, origin is receipt)."
      );
      return;
    }
    if (!pendingRule.action) {
      addMessage(
        "assistant",
        "What should the rule do? (set category to X, append note Y, set type to expense)"
      );
      return;
    }
    confirmAction(`Create rule "${pendingRule.name}".`, {
      resource: "rules",
      kind: "create",
      payload: {
        name: pendingRule.name,
        enabled: true,
        priority: 100,
        applyMode: "first",
        conditions: [pendingRule.condition],
        actions: [pendingRule.action],
      },
    });
  };

  const continueRuleFlow = (rawInput) => {
    if (!pendingRule) return false;
    const key = normalizeText(rawInput);
    if (["cancel", "stop"].includes(key)) {
      cancelPending();
      return true;
    }
    if (!pendingRule.name) {
      pendingRule.name = rawInput.trim();
      startRuleFlow(pendingRule);
      return true;
    }
    if (!pendingRule.condition) {
      const condition = parseRuleCondition(rawInput);
      if (!condition) {
        addMessage("assistant", "Please describe a valid condition.");
        return true;
      }
      pendingRule.condition = condition;
      startRuleFlow(pendingRule);
      return true;
    }
    if (!pendingRule.action) {
      const action = parseRuleAction(rawInput);
      if (!action) {
        addMessage("assistant", "Please describe a valid rule action.");
        return true;
      }
      pendingRule.action = action;
      startRuleFlow(pendingRule);
      return true;
    }
    return false;
  };


  const handleInsights = async (text) => {
    const key = normalizeText(text);
    let records = [];
    try {
      records = await loadAllRecords();
    } catch (err) {
      addMessage("assistant", "I couldn't load records. Please check your login.");
      return;
    }

    const range = detectRange(text);
    const scoped = filterByRange(records, range);
    const { totalExp, totalInc, topCats } = summarizeSpending(scoped);
    const categoryList = [...new Set((records || []).map((r) => r.category).filter(Boolean))];
    const category = extractCategoryFromText(text, categoryList);
    const scopedByCategory = category
      ? scoped.filter((r) => normalizeText(r.category) === normalizeText(category))
      : scoped;
    const categorySummary = category ? summarizeSpending(scopedByCategory) : null;
    const rangeLabel = range?.label ? ` for ${range.label}` : "";
    const hasExpenseTerms = /\b(spend|spent|spending|expense|expenses)\b/.test(key);
    const hasIncomeTerms = /\b(income|earned|earn|made|make)\b/.test(key);
    const asksHowMuch = /\b(how much|total|sum)\b/.test(key);
    const asksCount = /\b(how many|count|number of)\b/.test(key);

    if (!scoped.length) {
      addMessage("assistant", `I couldn't find any records${rangeLabel}.`);
      return;
    }

    if (key.includes("save") || key.includes("reduce") || key.includes("cut")) {
      const discretionary = topCats.filter((c) => !isProtectedCategory(c.name));
      if (!discretionary.length) {
        addMessage(
          "assistant",
          "Your spending looks essential-heavy. I don't recommend cutting rent or groceries."
        );
        return;
      }
      const pick = discretionary.slice(0, 2).map((c) => c.name).join(" and ");
      addMessage(
        "assistant",
        `Consider a gentle cap on ${pick}. These are typically more flexible.`
      );
      return;
    }

    if (asksHowMuch && hasIncomeTerms && !hasExpenseTerms) {
      addMessage("assistant", `You earned ${fmtMoney(totalInc)}${rangeLabel}.`);
      return;
    }

    if (asksCount) {
      const expenseCount = scoped.filter((r) => r?.type === "expense").length;
      const incomeCount = scoped.filter((r) => r?.type === "income").length;
      if (hasExpenseTerms && !hasIncomeTerms) {
        addMessage("assistant", `You have ${expenseCount} expense records${rangeLabel}.`);
        return;
      }
      if (hasIncomeTerms && !hasExpenseTerms) {
        addMessage("assistant", `You have ${incomeCount} income records${rangeLabel}.`);
        return;
      }
      addMessage("assistant", `You have ${scoped.length} total records${rangeLabel}.`);
      return;
    }

    if (asksHowMuch && hasExpenseTerms && categorySummary) {
      addMessage(
        "assistant",
        `You spent ${fmtMoney(categorySummary.totalExp)} on ${category}${rangeLabel}.`
      );
      return;
    }

    if (asksHowMuch && hasExpenseTerms) {
      addMessage("assistant", `You spent ${fmtMoney(totalExp)}${rangeLabel}.`);
      return;
    }

    if (hasExpenseTerms && !hasIncomeTerms) {
      addMessage("assistant", `You spent ${fmtMoney(totalExp)}${rangeLabel}.`);
      return;
    }

    if (hasIncomeTerms && !hasExpenseTerms) {
      addMessage("assistant", `You earned ${fmtMoney(totalInc)}${rangeLabel}.`);
      return;
    }

    if (/\b(net|balance|cash flow|surplus|deficit|left over)\b/.test(key)) {
      const net = totalInc - totalExp;
      if (net >= 0) {
        addMessage("assistant", `Your net is ${fmtMoney(net)}${rangeLabel}.`);
      } else {
        addMessage("assistant", `Your net is -${fmtMoney(Math.abs(net))}${rangeLabel}.`);
      }
      return;
    }

    if (
      key.includes("spend") ||
      key.includes("spent") ||
      key.includes("spending") ||
      key.includes("top") ||
      key.includes("where")
    ) {
      const summary = categorySummary || { topCats };
      const label = category ? `in ${category}` : "overall";
      if (!summary.topCats?.length) {
        addMessage("assistant", "No expenses found in this range.");
        return;
      }
      const top = summary.topCats[0];
      addMessage(
        "assistant",
        `Your top expense ${label} is ${top.name} at ${fmtMoney(top.amount)}.`
      );
      return;
    }

    const net = totalInc - totalExp;
    if (/\baverage\b/.test(key) && hasExpenseTerms) {
      const uniqueDays = new Set(
        scoped
          .filter((r) => r?.type === "expense")
          .map((r) => {
            const d = parseISODate(r?.date);
            return d && !Number.isNaN(d.getTime()) ? formatDateOnly(d) : "";
          })
          .filter(Boolean)
      ).size;
      const days = Math.max(1, uniqueDays);
      addMessage(
        "assistant",
        `Your average expense is ${fmtMoney(totalExp / days)} per active day${rangeLabel}.`
      );
      return;
    }

    if (net > 0) {
      addMessage(
        "assistant",
        `You saved ${fmtMoney(net)}${rangeLabel}.`
      );
    } else {
      addMessage(
        "assistant",
        `You're spending ${fmtMoney(Math.abs(net))} more than income${rangeLabel}.`
      );
    }
  };

  const handleListRecords = async (text) => {
    let records = [];
    try {
      records = await loadAllRecords();
    } catch (err) {
      addMessage("assistant", "I couldn't load records. Please check your login.");
      return;
    }

    const categories = [...new Set((records || []).map((r) => r.category).filter(Boolean))];
    const range = detectRange(text);
    const filter = parseRecordFilter(text, categories);
    const scoped = filterByRange(records, range);
    const filtered = filterRecords(scoped, filter);

    if (!filtered.length) {
      addMessage("assistant", "No records found for that filter.");
      return;
    }

    const total = filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const labelParts = [];
    if (filter?.type) labelParts.push(filter.type);
    if (filter?.category) labelParts.push(filter.category);
    if (range?.label) labelParts.push(range.label);
    const label = labelParts.length ? ` (${labelParts.join(", ")})` : "";

    addMessage(
      "assistant",
      `Found ${filtered.length} records${label}. Total: ${fmtMoney(total)}.`
    );

    const sorted = filtered
      .slice()
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 5);

    sorted.forEach((r) => {
      addMessage("assistant", formatRecordLine(r));
    });

    if (hasMultipleCurrencies(filtered)) {
      addMessage("assistant", "Note: totals are not converted across currencies.");
    }
  };

  const handleListReceipts = async () => {
    let receipts = [];
    try {
      receipts = await api.receipts.getAll();
    } catch (err) {
      addMessage("assistant", "I couldn't load receipts. Please try again in a moment.");
      return;
    }

    if (!Array.isArray(receipts) || !receipts.length) {
      addMessage("assistant", "You haven't scanned any receipts yet.");
      return;
    }

    const sorted = receipts
      .slice()
      .sort((a, b) => new Date(b?.created_at || b?.createdAt || 0) - new Date(a?.created_at || a?.createdAt || 0));

    addMessage("assistant", `You have ${sorted.length} scanned receipt${sorted.length === 1 ? "" : "s"}.`);

    sorted.slice(0, 5).forEach((receipt) => {
      const summary = api.getReceiptSummary ? api.getReceiptSummary(receipt) : {};
      const rawDate = summary?.date || receipt?.date || receipt?.created_at || receipt?.createdAt || "";
      const d = parseISODate(rawDate);
      const safeDate = d && !Number.isNaN(d.getTime()) ? formatDateOnly(d) : "unknown date";
      const source = summary?.source || "Unknown source";
      const amount = Number(summary?.amount || receipt?.amount || 0);
      const amountLabel = Number.isFinite(amount) && amount > 0 ? fmtMoney(amount) : "unknown amount";
      addMessage("assistant", `- ${source}: ${amountLabel} (${safeDate})`);
    });
  };

  const handleListBudgets = async () => {
    let sheets = [];
    try {
      const res = await api.budgetSheets.getAll({ limit: 20 });
      sheets = Array.isArray(res) ? res : res?.budgetSheets || res?.data || [];
    } catch (err) {
      addMessage("assistant", "I couldn't load budgets. Please try again.");
      return;
    }
    if (!sheets.length) {
      addMessage("assistant", "You don't have any budgets yet.");
      return;
    }
    addMessage("assistant", `You have ${sheets.length} budget sheet${sheets.length === 1 ? "" : "s"}.`);
    sheets.slice(0, 5).forEach((sheet) => {
      const total = sumBudgetSheet(sheet);
      addMessage(
        "assistant",
        `- ${sheet.cadence} ${sheet.period} · ${fmtMoney(total)}`
      );
    });
  };

  const handleShowBudget = async ({ id, cadence, period }) => {
    let sheet = null;
    try {
      if (id) {
        sheet = await api.budgetSheets.getOne(id);
      } else if (cadence && period) {
        sheet = await api.budgetSheets.lookup({ cadence, period });
      }
    } catch (err) {
      if (err?.status === 404) {
        addMessage("assistant", "I couldn't find that budget.");
        return;
      }
      addMessage("assistant", "I couldn't load that budget.");
      return;
    }
    if (!sheet) {
      addMessage("assistant", "I couldn't find that budget.");
      return;
    }
    addMessage(
      "assistant",
      `Budget ${sheet.cadence} ${sheet.period}. Total: ${fmtMoney(sumBudgetSheet(sheet))}.`
    );
  };

  const handleBudgetQuery = async ({ category, cadence, period }) => {
    const cadenceKey = cadence || "monthly";
    const periodKey = period || getBudgetPeriodKey(cadenceKey);
    let sheet = null;
    try {
      sheet = await api.budgetSheets.lookup({ cadence: cadenceKey, period: periodKey });
    } catch (err) {
      if (err?.status === 404) {
        addMessage("assistant", "I couldn't find a budget for that period.");
        return;
      }
      addMessage("assistant", "I couldn't load that budget.");
      return;
    }
    if (!sheet) {
      addMessage("assistant", "I couldn't find a budget for that period.");
      return;
    }
    const label = formatBudgetPeriodLabel(cadenceKey, periodKey);
    if (category) {
      const amount = getBudgetCategoryAmount(sheet, category);
      if (amount === null || amount === undefined) {
        addMessage(
          "assistant",
          `I couldn't find a ${category.label} budget for ${label || periodKey}.`
        );
        return;
      }
      addMessage(
        "assistant",
        `Your ${category.label} budget for ${label || periodKey} is ${fmtMoney(amount)}.`
      );
      return;
    }
    addMessage(
      "assistant",
      `Your total budget for ${label || periodKey} is ${fmtMoney(sumBudgetSheet(sheet))}.`
    );
  };

  const handleListRecurring = async () => {
    let items = [];
    try {
      const res = await api.recurring.list();
      items = Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      addMessage("assistant", "I couldn't load recurring schedules.");
      return;
    }
    if (!items.length) {
      addMessage("assistant", "You don't have any recurring schedules yet.");
      return;
    }
    addMessage(
      "assistant",
      `You have ${items.length} recurring schedule${items.length === 1 ? "" : "s"}.`
    );
    const formatRecurringSchedule = (item) => {
      const frequency = String(item?.frequency || "").toLowerCase();
      const values = Array.isArray(item?.recurrenceValues)
        ? item.recurrenceValues
        : Array.isArray(item?.recurrence_values)
          ? item.recurrence_values
          : [];
      if (frequency === "weekly") {
        const labels = values
          .map((v) => Number.parseInt(String(v), 10))
          .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
          .map((v) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][v]);
        return labels.length ? `weekly on ${labels.join(", ")}` : "weekly";
      }
      if (frequency === "monthly") {
        const day =
          (values.length ? Number(values[0]) : null) ||
          Number(item?.dayOfMonth ?? item?.day_of_month);
        return Number.isFinite(day) ? `monthly on ${day}` : "monthly";
      }
      if (frequency === "yearly") {
        const value = values.length ? String(values[0]) : "";
        return value ? `yearly on ${value}` : "yearly";
      }
      return frequency || "monthly";
    };

    items.slice(0, 5).forEach((item) => {
      const amountLabel = fmtMoney(item?.amount || 0);
      addMessage(
        "assistant",
        `- ${item.name || "Recurring"} · ${amountLabel} · ${formatRecurringSchedule(item)}`
      );
    });
  };

  const handleUpcomingRecurring = async () => {
    let items = [];
    try {
      const res = await api.recurring.upcoming({ days: 30 });
      items = Array.isArray(res) ? res : res?.items || res?.data || [];
    } catch (err) {
      addMessage("assistant", "I couldn't load upcoming recurring items.");
      return;
    }
    if (!items.length) {
      addMessage("assistant", "No upcoming recurring occurrences in the next 30 days.");
      return;
    }
    addMessage("assistant", `Upcoming recurring: ${items.length} item(s).`);
    items.slice(0, 5).forEach((item) => {
      const amountLabel = fmtMoney(item?.amount || 0);
      const date = item?.date || item?.occurrence_date || "";
      addMessage(
        "assistant",
        `- ${item.name || "Recurring"} · ${amountLabel} · ${date || "date unknown"}`
      );
    });
  };

  const handleListRules = async () => {
    let rules = [];
    try {
      rules = await api.rules.getAll();
    } catch (err) {
      addMessage("assistant", "I couldn't load rules.");
      return;
    }
    if (!rules.length) {
      addMessage("assistant", "You don't have any rules yet.");
      return;
    }
    addMessage("assistant", `You have ${rules.length} rule${rules.length === 1 ? "" : "s"}.`);
    rules.slice(0, 5).forEach((rule) => {
      const enabled = rule.enabled === false ? "disabled" : "enabled";
      addMessage(
        "assistant",
        `- ${rule.name || "Rule"} · ${enabled}`
      );
    });
  };

  const handleListNetWorth = async () => {
    let items = [];
    try {
      items = await api.netWorth.list();
    } catch (err) {
      addMessage("assistant", "I couldn't load net worth items.");
      return;
    }
    if (!items.length) {
      addMessage("assistant", "No net worth items yet.");
      return;
    }
    addMessage("assistant", `You have ${items.length} net worth item(s).`);
    items.slice(0, 5).forEach((item) => {
      const amountLabel = fmtMoney(item?.amount || 0);
      addMessage(
        "assistant",
        `- ${item.name || "Item"} · ${item.type || "asset"} · ${amountLabel}`
      );
    });
  };

  const handleListNotifications = async () => {
    let items = [];
    try {
      items = await api.notifications.getActive();
    } catch (err) {
      addMessage("assistant", "I couldn't load notifications.");
      return;
    }
    if (!items.length) {
      addMessage("assistant", "You have no active notifications.");
      return;
    }
    addMessage("assistant", `You have ${items.length} active notification(s).`);
    items.slice(0, 5).forEach((item) => {
      addMessage(
        "assistant",
        `- ${item.title || item.message || "Notification"}`
      );
    });
  };

  const handleListActivity = async () => {
    let items = [];
    try {
      items = await api.activity.getRecent(10);
    } catch (err) {
      addMessage("assistant", "I couldn't load recent activity.");
      return;
    }
    if (!items.length) {
      addMessage("assistant", "No recent activity found.");
      return;
    }
    addMessage("assistant", `Recent activity (${items.length}):`);
    items.slice(0, 5).forEach((item) => {
      const when = item?.created_at || item?.createdAt || "";
      addMessage(
        "assistant",
        `- ${item.action || "Activity"} ${when ? `(${new Date(when).toLocaleString()})` : ""}`
      );
    });
  };

  const handleListAchievements = async () => {
    let items = [];
    try {
      const res = await api.achievements.getAll();
      items = Array.isArray(res) ? res : res?.achievements || res?.data || [];
    } catch (err) {
      addMessage("assistant", "I couldn't load achievements.");
      return;
    }
    if (!items.length) {
      addMessage("assistant", "No achievements yet.");
      return;
    }
    addMessage("assistant", `Achievements (${items.length}):`);
    items.slice(0, 5).forEach((item) => {
      addMessage("assistant", `- ${item.name || item.key || "Achievement"}`);
    });
  };

  const handleShowProfile = async () => {
    try {
      const data = await api.auth.me();
      const user = data?.user || data || {};
      addMessage(
        "assistant",
        `Profile: ${user.full_name || user.fullName || "Unknown"} · ${user.email || "No email"}`
      );
    } catch (err) {
      addMessage("assistant", "I couldn't load your profile.");
    }
  };

  const handleShowSettings = async () => {
    try {
      const settings = await api.settings.get();
      const keys = settings && typeof settings === "object" ? Object.keys(settings) : [];
      addMessage(
        "assistant",
        keys.length
          ? `Settings loaded (${keys.length} fields).`
          : "Settings loaded."
      );
    } catch (err) {
      addMessage("assistant", "I couldn't load your settings.");
    }
  };

  const handleMessage = async (text) => {
    const raw = text.trim();
    if (!raw) return;

    addMessage("user", raw);
    isHandlingMessage = true;
    responseBuffer = [];

    try {
      const key = normalizeKey(raw);
      if (isPublicMode) {
        if (isPublicInfoQuestion(raw)) {
          const publicReply = await answerPublicQuestion(raw);
          addMessage("assistant", publicReply);
          return;
        }
        if (isPrivateDataQuestion(raw)) {
          addMessage(
            "assistant",
            "I can explain WalletLens on public pages, but account-specific records and insights require login."
          );
          return;
        }
        addMessage("assistant", buildPublicFallback(raw));
        return;
      }

      try {
        await loadCategories();
      } catch {
        addMessage(
          "assistant",
          "I couldn't load your categories. Please try again in a moment."
        );
        return;
      }
      if (pendingAction) {
        if (["yes", "y", "confirm", "ok", "okay", "do it"].includes(key)) {
          await executePending();
          return;
        }
        if (["no", "n", "cancel", "stop"].includes(key)) {
          cancelPending();
          return;
        }
        addMessage("assistant", "Please reply yes or no to confirm the last request.");
        return;
      }

    if (pendingCreate) {
      const handled = await continueCreateFlow(raw);
      if (handled) return;
    }

    if (pendingBudget) {
      const handled = continueBudgetFlow(raw);
      if (handled) return;
    }

    if (pendingRecurring) {
      const handled = continueRecurringFlow(raw);
      if (handled) return;
    }

    if (pendingRule) {
      const handled = continueRuleFlow(raw);
      if (handled) return;
    }


    if (pendingRecordResolution) {
      const handled = continueRecordResolution(raw);
      if (handled) return;
    }

    if (pendingEditTarget) {
      if (!pendingEditRecord && pendingEditTarget.id) {
        try {
          pendingEditRecord = await api.records.getOne(pendingEditTarget.id);
        } catch {
          addMessage("assistant", "I couldn't load that record. Please try again.");
          return;
        }
      }

      if (!pendingEditField) {
        const field = normalizeFieldName(raw);
        if (!field) {
          askEditField();
          return;
        }
        pendingEditField = field;
        askEditNewValue(field, pendingEditRecord);
        return;
      }

      const updates = parseUpdateFieldsOnly(`${pendingEditField} ${raw}`);
      if (Object.keys(updates).length) {
        if (updates.category) {
          const category =
            pickCategory(updates.category, updates.type) ||
            pickCategory(updates.category, "expense") ||
            pickCategory(updates.category, "income");
          if (!category) {
            addMessage(
              "assistant",
              `Choose one of the default categories. Expense: ${formatCategoryList(
                "expense"
              )}. Income: ${formatCategoryList("income")}.`
            );
            return;
          }
          updates.category = category;
        }
        const fields = Object.entries(updates)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        confirmAction(
          `I can update that record with ${fields}.`,
          { kind: "update", id: pendingEditTarget.id, updates }
        );
        return;
      }

      addMessage("assistant", "Please provide a new value.");
      return;
    }

      if (isPublicInfoQuestion(raw)) {
        const publicReply = await answerPublicQuestion(raw);
        addMessage("assistant", publicReply);
        return;
      }

      if (isReceiptCapabilityQuestion(raw)) {
        addMessage(
          "assistant",
          "Yes. WalletLens supports receipt scanning/upload with OCR extraction and can create linked records from parsed receipts."
        );
        return;
      }

      if (isReceiptHistoryQuestion(raw)) {
        await handleListReceipts();
        return;
      }

      if (/\b(edit|update|change)\b/.test(key) && /\b(profile|settings)\b/.test(key)) {
        addMessage("assistant", "I can’t edit profile or settings pages.");
        return;
      }

      if (
        /\b(edit|update|change|delete|remove|dismiss|clear|add|create)\b/.test(key) &&
        /\b(net worth|networth|notification|notifications|achievement|achievements|activity)\b/.test(
          key
        )
      ) {
        addMessage(
          "assistant",
          "I can view net worth, notifications, activity, and achievements, but I can’t edit them."
        );
        return;
      }

      if (/\b(show|view|display)\b/.test(key) && /\bprofile\b/.test(key)) {
        await handleShowProfile();
        return;
      }

      if (/\b(show|view|display)\b/.test(key) && /\bsettings\b/.test(key)) {
        await handleShowSettings();
        return;
      }

      const budgetCmd = parseBudgetCommand(raw);
      if (budgetCmd) {
        if (budgetCmd.intent === "list") {
          await handleListBudgets();
          return;
        }
        if (budgetCmd.intent === "show") {
          await handleShowBudget(budgetCmd);
          return;
        }
        if (budgetCmd.intent === "delete" && budgetCmd.id) {
          confirmAction("I can delete that budget.", {
            resource: "budget",
            kind: "delete",
            id: budgetCmd.id,
          });
          return;
        }
        if (budgetCmd.intent === "create") {
          startBudgetFlow({ cadence: budgetCmd.cadence, period: budgetCmd.period, mode: "create" });
          return;
        }
        if (budgetCmd.intent === "set") {
          startBudgetFlow({
            cadence: budgetCmd.cadence,
            period: budgetCmd.period,
            category: budgetCmd.category,
            amount: budgetCmd.amount,
            mode: "set",
          });
          return;
        }
      }

      const budgetQuery = parseBudgetQuery(raw);
      if (budgetQuery && (budgetQuery.cadence || budgetQuery.period || budgetQuery.category)) {
        await handleBudgetQuery(budgetQuery);
        return;
      }

      const recurringCmd = parseRecurringCommand(raw);
      if (recurringCmd) {
        if (recurringCmd.intent === "list") {
          await handleListRecurring();
          return;
        }
        if (recurringCmd.intent === "upcoming") {
          await handleUpcomingRecurring();
          return;
        }
        if (recurringCmd.intent === "delete" && recurringCmd.id) {
          confirmAction("I can delete that recurring schedule.", {
            resource: "recurring",
            kind: "delete",
            id: recurringCmd.id,
          });
          return;
        }
        if (recurringCmd.intent === "toggle" && recurringCmd.id) {
          confirmAction("I can update that recurring schedule.", {
            resource: "recurring",
            kind: "update",
            id: recurringCmd.id,
            updates: { active: recurringCmd.active },
          });
          return;
        }
        if (recurringCmd.intent === "update" && recurringCmd.id) {
          const seed = recurringCmd.seed || {};
          const updates = {};
          if (seed.name) updates.name = seed.name;
          if (seed.type) updates.type = seed.type;
          if (seed.amount !== null && seed.amount !== undefined) updates.amount = seed.amount;
          if (seed.category) updates.category = seed.category;
          if (seed.frequency) updates.frequency = seed.frequency;
          if (seed.recurrenceValues?.length) updates.recurrenceValues = seed.recurrenceValues;
          if (seed.startDate) updates.startDate = seed.startDate;
          if (Object.keys(updates).length) {
            confirmAction("I can update that recurring schedule.", {
              resource: "recurring",
              kind: "update",
              id: recurringCmd.id,
              updates,
            });
            return;
          }
          addMessage("assistant", "Please specify what to update for that recurring schedule.");
          return;
        }
        if (recurringCmd.intent === "create") {
          startRecurringFlow(recurringCmd.seed || {});
          return;
        }
      }

      const ruleCmd = parseRuleCommand(raw);
      if (ruleCmd) {
        if (ruleCmd.intent === "list") {
          await handleListRules();
          return;
        }
        if (ruleCmd.intent === "apply") {
          confirmAction("I can apply all rules to existing records.", {
            resource: "rules",
            kind: "apply",
          });
          return;
        }
        if (ruleCmd.intent === "toggle" && ruleCmd.id) {
          confirmAction("I can update that rule.", {
            resource: "rules",
            kind: "update",
            id: ruleCmd.id,
            updates: { enabled: ruleCmd.enabled },
          });
          return;
        }
        if (ruleCmd.intent === "delete" && ruleCmd.id) {
          confirmAction("I can delete that rule.", {
            resource: "rules",
            kind: "delete",
            id: ruleCmd.id,
          });
          return;
        }
        if (ruleCmd.intent === "update" && ruleCmd.id) {
          addMessage("assistant", "Please describe the updates for that rule.");
          return;
        }
        if (ruleCmd.intent === "create") {
          const ruleMatch = raw.match(/\bif\s+(.+?)\s+then\s+(.+)$/i);
          if (ruleMatch) {
            const condition = parseRuleCondition(ruleMatch[1]);
            const action = parseRuleAction(ruleMatch[2]);
            if (condition && action) {
              startRuleFlow({
                name: "Custom rule",
                condition,
                action,
              });
              return;
            }
          }
          startRuleFlow({});
          return;
        }
      }

      const netCmd = parseNetWorthCommand(raw);
      if (netCmd) {
        if (netCmd.intent === "list") {
          await handleListNetWorth();
          return;
        }
        addMessage("assistant", "I can only view net worth items, not edit them.");
        return;
      }

      const receiptCmd = parseReceiptCommand(raw);
      if (receiptCmd) {
        if (receiptCmd.intent === "list") {
          await handleListReceipts();
          return;
        }
        addMessage("assistant", "I can only view receipts, not edit them.");
        return;
      }

      const notifCmd = parseNotificationCommand(raw);
      if (notifCmd) {
        if (notifCmd.intent === "list") {
          await handleListNotifications();
          return;
        }
        addMessage("assistant", "I can only view notifications, not dismiss them.");
        return;
      }

      const activityCmd = parseActivityCommand(raw);
      if (activityCmd) {
        await handleListActivity();
        return;
      }

      const achievementsCmd = parseAchievementsCommand(raw);
      if (achievementsCmd) {
        await handleListAchievements();
        return;
      }

      const earlyIntent = detectIntent(raw);
      if (earlyIntent === "edit" || earlyIntent === "delete") {
        const hasRecordScope =
          /\b(record|transaction|expense|income|category|amount|note|date|today|yesterday)\b/i.test(
            raw
          ) || Boolean(parseRecordIdReference(raw));
        if (!hasRecordScope) {
          // Skip record resolution for non-record uses of "edit/delete/change".
        } else {
        let records = [];
        try {
          records = await loadAllRecords();
        } catch {
          addMessage("assistant", "I couldn't load records. Please check your login.");
          return;
        }

        const idRef = parseRecordIdReference(raw);
        if (idRef) {
          const byId =
            (records || []).find((r) => String(r?.id || "").toLowerCase() === String(idRef).toLowerCase()) ||
            null;
          if (!byId) {
            addMessage("assistant", "I couldn't find that record id.");
            return;
          }
          if (earlyIntent === "delete") {
            confirmAction("I can delete that record.", { kind: "delete", id: byId.id });
            return;
          }
          pendingEditTarget = { id: byId.id };
          pendingEditRecord = byId;
          pendingEditField = null;
          addMessage(
            "assistant",
            `What would you like to edit for ${formatRecordDisplay(byId)}?`
          );
          return;
        }

        const resolved = startRecordResolution(earlyIntent, raw, records);
        if (resolved) return;
        }
      }

      let llmResult = null;
      let llmRecords = [];
      try {
        llmRecords = await loadAllRecords();
        const range = detectRange(raw);
        const context = buildLlmContext(llmRecords, range);
        llmResult = await api.walterlens.chat({ message: raw, context });
      } catch (err) {
        llmResult = null;
      }

      if (llmResult?.action?.kind) {
        const summary =
          llmResult.actionSummary ||
          `I can ${llmResult.action.kind} a record.`;
        if (llmResult.action.kind === "update" && llmResult.action.id) {
          const userProvidedId = Boolean(parseRecordIdReference(raw));
          const idMatch = (llmRecords || []).find(
            (r) =>
              String(r?.id || "").toLowerCase() ===
              String(llmResult.action.id || "").toLowerCase()
          );
          if (!userProvidedId) {
            const resolved = startRecordResolution("edit", raw, llmRecords || [], {
              proposedUpdates: llmResult.action.updates || {},
            });
            if (resolved) return;
          }
          if (!idMatch) {
            addMessage(
              "assistant",
              "I couldn't safely identify a single record from that request. Please include date and amount, or edit it directly in Records."
            );
            return;
          }
          confirmAction(summary, {
            kind: "update",
            id: llmResult.action.id,
            updates: llmResult.action.updates || {},
          });
          return;
        }
        if (llmResult.action.kind === "delete" && llmResult.action.id) {
          const userProvidedId = Boolean(parseRecordIdReference(raw));
          const idMatch = (llmRecords || []).find(
            (r) =>
              String(r?.id || "").toLowerCase() ===
              String(llmResult.action.id || "").toLowerCase()
          );
          if (!userProvidedId) {
            const resolved = startRecordResolution("delete", raw, llmRecords || []);
            if (resolved) return;
          }
          if (!idMatch) {
            addMessage(
              "assistant",
              "I couldn't safely identify a single record from that request. Please include date and amount, or delete it directly in Records."
            );
            return;
          }
          confirmAction(summary, {
            kind: "delete",
            id: llmResult.action.id,
          });
          return;
        }
        if (llmResult.action.kind === "create") {
          const payload = llmResult.action.payload || {};
          if (payload?.type && payload?.category && payload?.amount !== undefined) {
            const category = pickCategory(payload.category, payload.type);
            if (!category) {
              addMessage(
                "assistant",
                `Choose one of the default categories: ${formatCategoryList(payload.type)}.`
              );
              return;
            }
          }
          if (!payload?.type || !payload?.category || payload?.amount === undefined) {
            startCreateFlow(payload);
            return;
          }
          confirmAction(summary, { kind: "create", payload });
          return;
        }
        addMessage("assistant", summary);
        return;
      }

      const localIntent = detectIntent(raw);
      const parsedSeed = parseRecordCreateSeed(raw);
      const parsedCreate = parseRecordCreate(raw);
      const parsedDelete = parseRecordDelete(raw);
      const parsedEdits = parseRecordEdits(raw);
      const hasDeterministicPath =
        localIntent !== "unknown" ||
        Boolean(parsedSeed) ||
        Boolean(parsedCreate) ||
        Boolean(parsedDelete) ||
        Boolean(parsedEdits && Object.keys(parsedEdits.updates || {}).length);
      const llmRelevant = isLlmFinanceRelevant(llmResult);

      if (!hasDeterministicPath && llmRelevant && llmResult?.reply) {
        addMessage("assistant", llmResult.reply);
        return;
      }

      // Fallback path: deterministic logic when AI is unavailable/uncertain.
      if (isPublicInfoQuestion(raw)) {
        const publicReply = await answerPublicQuestion(raw);
        addMessage("assistant", publicReply);
        return;
      }

      if (isLegalQuery(key)) {
        addMessage(
          "assistant",
          "I can’t help with legal or tax advice. I can help with spending insights or records."
        );
        return;
      }

      const createSeed = parsedSeed;
      if (createSeed) {
        startCreateFlow({ ...createSeed, rawText: raw });
        return;
      }

      const earlyCreate = parsedCreate;
      if (earlyCreate && earlyCreate.amount !== undefined) {
        const category =
          pickCategory(earlyCreate.category, earlyCreate.type) ||
          findCategoryInText(raw, earlyCreate.type);
        if (category) {
          startCreateFlow({
            ...earlyCreate,
            category,
          });
          return;
        }
      }

      const intent = localIntent;

      const deleteIntent = parsedDelete;
      if (deleteIntent) {
        confirmAction("I can delete that record.", { kind: "delete", id: deleteIntent.id });
        return;
      }

      const editIntent = parsedEdits;
      if (editIntent && Object.keys(editIntent.updates || {}).length) {
        if (editIntent.updates.category) {
          const category =
            pickCategory(editIntent.updates.category, editIntent.updates.type) ||
            pickCategory(editIntent.updates.category, "expense") ||
            pickCategory(editIntent.updates.category, "income");
          if (!category) {
            addMessage(
              "assistant",
              `Choose one of the default categories. Expense: ${formatCategoryList(
                "expense"
              )}. Income: ${formatCategoryList("income")}.`
            );
            return;
          }
          editIntent.updates.category = category;
        }
        const fields = Object.entries(editIntent.updates)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        confirmAction(
          `I can update that record with ${fields}.`,
          { kind: "update", id: editIntent.id, updates: editIntent.updates }
        );
        return;
      }

      const createIntent = parsedCreate;
      if (createIntent) {
        startCreateFlow(createIntent);
        return;
      }

      if (intent === "create") {
        startCreateFlow();
        return;
      }

      if (intent === "list") {
        await handleListRecords(raw);
        return;
      }

      if (intent === "edit") {
        let records = [];
        try {
          records = await loadAllRecords();
        } catch {
          addMessage("assistant", "I couldn't load records. Please check your login.");
          return;
        }
        const lookup = parseRecordLookup(raw, records);
        if (lookup) {
          pendingEditTarget = { id: lookup.id };
          pendingEditRecord = lookup;
          pendingEditField = null;
          addMessage(
            "assistant",
            `What would you like to edit for ${formatRecordDisplay(lookup)}?`
          );
          return;
        }
      }

      if (intent === "insight") {
        await handleInsights(raw);
        return;
      }

      if (isFinancialQuestion(raw)) {
        await handleInsights(raw);
        return;
      }

      addMessage(
        "assistant",
        "I can't do that. I can help with records, budgets, recurring schedules, rules, receipts, net worth, and notifications."
      );
    } finally {
      flushResponses();
    }
  };

  const enqueueMessage = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return;
    messageQueue = messageQueue
      .then(() => handleMessage(raw))
      .catch((err) => {
        console.error("WalterLens queue error:", err);
      });
  };

  fab.addEventListener("click", () => togglePanel());
  closeBtn.addEventListener("click", () => togglePanel(false));
  sendBtn.addEventListener("click", () => {
    enqueueMessage(input.value);
    input.value = "";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      enqueueMessage(input.value);
      input.value = "";
    }
  });
}

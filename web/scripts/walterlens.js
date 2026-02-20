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
  "I can help with spending insights, listing records, or edits. Try asking about your top category.",
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
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
  );
  if (!match) return null;
  const monthKey = match[1].toLowerCase();
  const month = MONTHS.get(monthKey);
  const day = Number(match[2]);
  if (!month || !day || day < 1 || day > 31) return null;
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  // Prefer the most recent occurrence for month/day mentions.
  if (candidate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    year -= 1;
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

const detectRange = (text) => {
  const key = normalizeText(text);
  const explicit = parseExplicitRange(text);
  if (explicit) return explicit;

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
  { page: "about.html", topic: "about" },
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
  if (
    /\b(walletlens|walletwise|this app|app for|what is walletlens|what does walletlens)\b/.test(
      key
    ) ||
    (/\b(feature|features|about|scan|receipt|ocr|upload)\b/.test(key) &&
      /\b(walletlens|walletwise|this app|your app)\b/.test(key))
  ) {
    return "about";
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

  if (topic === "about") {
    const mentionsReceipts = hasAny(corpus, /\breceipt|ocr|scan|upload\b/);
    const mentionsInsights = hasAny(corpus, /\binsight|trend|report|dashboard|analytics\b/);
    const mentionsRecords = hasAny(corpus, /\brecord|expense|income|track|budget\b/);
    const asksReceipts = /\b(scan|receipt|ocr|upload)\b/.test(q);
    const parts = [`${appName} is a personal finance app focused on organizing everyday money activity.`];
    if (asksReceipts) {
      return mentionsReceipts
        ? `Yes, ${appName} supports receipt scanning/upload workflows with extraction capabilities.`
        : `${appName} supports finance tracking workflows, and receipt features are described in the public product pages.`;
    }
    if (mentionsRecords) parts.push("It helps you track records and keep spending/income structured.");
    if (mentionsReceipts) parts.push("It also supports receipt capture and extraction workflows.");
    if (mentionsInsights) parts.push("You can review summaries and trends to understand where your money is going.");
    return parts.slice(0, 2).join(" ");
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
    return `${appName} helps track finances by organizing records, receipts, and spending insights. See the About page for a full overview.`;
  }
  return `I can answer questions about ${appName} public pages like About, Privacy, Terms, Help, login, and registration.`;
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
  const idLabel = record?.id ? `id:${record.id}` : "id:unknown";
  return `${idLabel} · ${dateLabel} · ${typeLabel} · ${category} · ${amountLabel}`;
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
  const idLabel = record?.id ? `id:${record.id}` : "id:unknown";
  const dt = parseISODate(record?.created_at || record?.createdAt || record?.date);
  const timeLabel = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : "unknown time";
  const typeLabel = record?.type === "income" ? "Income" : "Expense";
  const category = record?.category || "Uncategorized";
  const amountLabel = fmtMoney(record?.amount || 0, record?.currency || "USD");
  return `${orderLabel}. ${idLabel} · ${timeLabel} · ${typeLabel} · ${category} · ${amountLabel}`;
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
  if (/\b(delete|remove)\b/.test(key)) return "delete";
  if (/\b(add|create|log)\b/.test(key)) return "create";
  if (/\b(edit|update|change)\b/.test(key)) return "edit";
  if (/\b(what|which)\b/.test(key) && /\b(record|records|transaction|transactions|entries)\b/.test(key)) {
    return "list";
  }
  if (/\b(what|which)\b/.test(key) && /\b(spend|spent|spending|expenses|income|net|balance|budget)\b/.test(key)) {
    return "insight";
  }
  if (/\b(show|list|display)\b/.test(key)) {
    if (/\b(record|transaction|entries)\b/.test(key)) return "list";
    if (/\b(spend|spent|spending|expenses|income|summary|insight|total|net|balance|budget|cash flow)\b/.test(key)) return "insight";
    return "list";
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

export const __walterlensTest = {
  detectIntent,
  isFinancialQuestion,
  detectRange,
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
    /\b(scan|scanned|upload|uploaded|ocr|parse|extract|support|can|does|able)\b/.test(key)
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
    ? "Ask about WalletLens, features, privacy, or terms."
    : "General insights, not legal or tax advice.";
  const inputPlaceholder = isPublicMode
    ? "Ask about WalletLens, privacy, terms, or public pages..."
    : "Ask about spending, saving, or a record edit...";

  const root = document.createElement("div");
  root.id = "walterlens-widget";
  root.className = "walterlens-widget";
  root.innerHTML = `
    <button class="walterlens-fab" aria-expanded="false" aria-controls="walterlens-panel">
      <span class="walterlens-fab__logo">WL</span>
    </button>
    <section id="walterlens-panel" class="walterlens-panel" aria-hidden="true" role="dialog" aria-label="WalterLens Advisor">
      <div class="walterlens-header">
        <div class="walterlens-title">
          <span class="walterlens-title__logo">WL</span>
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
            ? "Hi! I can explain WalletLens and summarize public pages like About, Privacy, and Terms."
            : pickWelcome()
        );
        hasWelcomed = true;
      }
    }
  };

  const confirmAction = (summary, action) => {
    pendingAction = action;
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
    try {
      if (action.kind === "update") {
        await api.records.update(action.id, action.updates);
        recordsCache = { ts: 0, data: [] };
        addMessage("assistant", "Done. The record was updated.");
      } else if (action.kind === "delete") {
        await api.records.remove(action.id);
        recordsCache = { ts: 0, data: [] };
        addMessage("assistant", "Done. The record was deleted.");
      } else if (action.kind === "create") {
        await api.records.create(action.payload);
        recordsCache = { ts: 0, data: [] };
        addMessage("assistant", "Done. The record was created.");
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

  const isPrivateDataQuestion = (text) => {
    const key = normalizeText(text);
    const mutatingRecordCommand =
      /\b(add|create|delete|remove|update|edit|change|list|show)\b/.test(key) &&
      /\b(record|transaction)\b/.test(key);
    const personalFinanceQuery =
      /\b(my|me|mine)\b/.test(key) &&
      /\b(spending|income|expense|record|transaction|budget)\b/.test(key);
    return mutatingRecordCommand || personalFinanceQuery;
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
        "I can't do that. I can help with finance questions about spending, income, budgets, and records."
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

/* ===============================================
<AppName> – default.js
Shared script for all pages.
Loads header/footer, sets active nav link,
manages account dropdown, updates auth state,
renders initials avatar, applies global theme,
and manages dashboard view preference.
=============================================== */

import { api } from "./api.js";

/* ===============================================
  DEVELOPMENT AUTH GUARD TOGGLE
  =============================================== */

// Set to false while developing pages to bypass login requirement
const AUTH_GUARD_ENABLED = true;
const DEFAULT_APP_NAME = "<AppName>";
const APP_NAME_REGEX = /<AppName>/g;
const APP_NAME_TEST = /<AppName>/;

/**
 * Pages that do NOT require authentication
 */
const PUBLIC_PAGES = [
  "index.html",
  "login.html",
  "register.html",
  "privacy.html",
  "terms.html",
  "about.html",
  "careers.html",
  "help.html",
  "",
];

/**
 * If the page is not public, check login status BEFORE loading anything else.
 * Redirect to index.html if the user is not authenticated.
 */
async function runAuthGuard() {
  if (!AUTH_GUARD_ENABLED) return;

  const rawPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const currentPage = rawPage === "" ? "index.html" : rawPage;

  if (PUBLIC_PAGES.includes(currentPage)) return;

  try {
    await api.auth.me(); // succeeds if logged in
  } catch {
    console.warn("User not authenticated. Redirecting to index.html");
    window.location.href = "index.html";
  }
}

// Run immediately (before DOMContentLoaded)
runAuthGuard();


/* ===============================================
  THEME LOADING — Global
  =============================================== */

/**
* Apply saved theme from localStorage.
* Defaults to "light" if nothing is saved.
*/
export function applySavedTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
}

// Apply theme immediately on script load
applySavedTheme();


/* ===============================================
  HEADER + FOOTER LOADING
  =============================================== */

document.addEventListener("DOMContentLoaded", () => {
  cachePageTitle();
  loadHeaderAndFooter();
  initLiveNavigation();
  applyCachedAppName();
  updateAppName();
});

/**
* Fetch and inject header & footer, then init UI
*/
function loadHeaderAndFooter() {
  const headerEl = document.getElementById("header");
  const footerEl = document.getElementById("footer");
  const cachedHeader = sessionStorage.getItem("cachedHeaderHtml");
  const cachedFooter = sessionStorage.getItem("cachedFooterHtml");

  if (headerEl && cachedHeader) {
    if (headerEl.innerHTML !== cachedHeader) {
      headerEl.innerHTML = cachedHeader;
    }
    setActiveNavLink();
    initMobileNavMenu();
    initAccountMenu();
    updateHeaderAuthState();
    updateAppName();
    wireLogoutButton();
    wireDashboardViewSelector();
    updateMobileNavActiveState();
  }

  if (footerEl && cachedFooter) {
    if (footerEl.innerHTML !== cachedFooter) {
      footerEl.innerHTML = cachedFooter;
    }
    setActiveFooterLink();
  }

  // --- Load Header ---
  fetch("components/header.html")
    .then((res) => {
      if (!res.ok) throw new Error("Header not found");
      return res.text();
    })
    .then((html) => {
      if (headerEl && headerEl.innerHTML !== html) {
        headerEl.innerHTML = html;
      }
      sessionStorage.setItem("cachedHeaderHtml", html);

      setActiveNavLink();
      initMobileNavMenu();
      initAccountMenu();
      updateHeaderAuthState();
      updateAppName();
      wireLogoutButton();
      wireDashboardViewSelector(); // NEW: Wire dashboard view selector
      updateMobileNavActiveState();
    })
    .catch((err) => console.error("Header load failed:", err));

  // --- Load Footer ---
  fetch("components/footer.html")
    .then((res) => {
      if (!res.ok) throw new Error("Footer not found");
      return res.text();
    })
    .then((html) => {
      if (!footerEl) return;
      if (footerEl.innerHTML !== html) {
        footerEl.innerHTML = html;
      }
      sessionStorage.setItem("cachedFooterHtml", html);
      setActiveFooterLink();
    })
    .catch((err) => console.error("Footer load failed:", err));
}

function cachePageTitle() {
  const rawPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const currentPage = rawPage === "" ? "index.html" : rawPage;
  if (document.title) {
    sessionStorage.setItem(`pageTitle:${currentPage}`, document.title);
  }
}


/* ===============================================
  ACTIVE NAV LINK
  =============================================== */

function setActiveNavLink() {
  const rawPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const currentPage = rawPage === "" ? "index.html" : rawPage;
  const navLinks = document.querySelectorAll("#header nav a");

  navLinks.forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    // Support both relative ("records.html") and root-relative ("/records.html") hrefs
    const linkPage = href.startsWith("/") ? href.slice(1) : href;

    if (linkPage === currentPage) link.classList.add("active");
    else link.classList.remove("active");
  });
}

function setActiveFooterLink() {
  const rawPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const currentPage = rawPage === "" ? "index.html" : rawPage;
  const footerLinks = document.querySelectorAll("#footer a[href]");

  footerLinks.forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    const linkPage = href.startsWith("/") ? href.slice(1) : href;

    if (linkPage === currentPage) link.classList.add("active");
    else link.classList.remove("active");
  });
}

function initMobileNavMenu() {
  const toggle = document.getElementById("mobileNavToggle");
  const menu = document.getElementById("mobileNavMenu");
  if (!toggle || !menu) return;

  if (toggle.dataset.bound === "true") {
    updateMobileNavActiveState();
    return;
  }

  updateMobileNavActiveState();

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("show");
    toggle.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen);
  });

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest(".mobile-nav-link");
    if (!btn || !menu.contains(btn)) return;
    const href = btn.getAttribute("data-href");
    if (!href) return;
    menu.classList.remove("show");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    if (LIVE_NAV_ENABLED) {
      const url = new URL(href, window.location.href).href;
      navigateLive(url, { pushState: true });
      return;
    }
    window.location.assign(href);
  });

  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("show");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  toggle.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu.classList.remove("show");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.blur();
    }
  });

  toggle.dataset.bound = "true";
}

function updateMobileNavActiveState() {
  const menu = document.getElementById("mobileNavMenu");
  if (!menu) return;
  const rawPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const currentPage = rawPage === "" ? "index.html" : rawPage;
  menu.querySelectorAll(".mobile-nav-link").forEach((btn) => {
    const href = (btn.getAttribute("data-href") || "").toLowerCase();
    const btnPage = href.startsWith("/") ? href.slice(1) : href.replace(/^\.\//, "");
    btn.classList.toggle("active", btnPage === currentPage);
  });
}

/* ===============================================
  ACCOUNT MENU DROPDOWN
  =============================================== */

function initAccountMenu() {
  const icon = document.getElementById("account-icon");
  const menu = document.getElementById("account-menu");
  if (!icon || !menu) return;
  if (icon.dataset.bound === "true") return;

  icon.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("show");
    icon.setAttribute("aria-expanded", isOpen);
  });

  // Click outside closes menu
  document.addEventListener("click", (e) => {
    if (!icon.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("show");
      icon.setAttribute("aria-expanded", "false");
    }
  });

  // ESC key closes
  icon.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu.classList.remove("show");
      icon.setAttribute("aria-expanded", "false");
      icon.blur();
    }
  });

  icon.dataset.bound = "true";
}


/* ===============================================
  INITIALS HELPER
  =============================================== */

function getInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function applyAccountAvatar(avatarUrl, fallbackName) {
  const accountIcon = document.getElementById("account-icon");
  const avatarLetters = document.getElementById("avatarLetters");
  if (!accountIcon || !avatarLetters) return;

  if (avatarUrl) {
    if (accountIcon.dataset.avatarUrl === avatarUrl && accountIcon.classList.contains("has-avatar")) {
      return;
    }
    accountIcon.dataset.avatarUrl = avatarUrl;
    avatarLetters.textContent = getInitials(fallbackName);

    const img = new Image();
    img.onload = () => {
      if (accountIcon.dataset.avatarUrl !== avatarUrl) return;
      accountIcon.style.backgroundImage = `url(${avatarUrl})`;
      accountIcon.classList.add("has-avatar");
      avatarLetters.textContent = "";
    };
    img.onerror = () => {
      if (accountIcon.dataset.avatarUrl !== avatarUrl) return;
      accountIcon.style.backgroundImage = "";
      accountIcon.classList.remove("has-avatar");
      avatarLetters.textContent = getInitials(fallbackName);
    };
    img.src = avatarUrl;
    return;
  }

  accountIcon.dataset.avatarUrl = "";
  accountIcon.style.backgroundImage = "";
  accountIcon.classList.remove("has-avatar");
  avatarLetters.textContent = getInitials(fallbackName);
}


/* ===============================================
  AUTH STATE IN HEADER
  =============================================== */

async function updateHeaderAuthState() {
  try {
    const cachedUserRaw = sessionStorage.getItem("cachedUser");
    if (cachedUserRaw) {
      try {
        const cachedUser = JSON.parse(cachedUserRaw);
        const nameEl = document.getElementById("headerUserName");
        if (nameEl) {
          nameEl.textContent = cachedUser.fullName || cachedUser.full_name || cachedUser.username || "Account";
        }
        applyAccountAvatar(
          cachedUser.avatarUrl || cachedUser.avatar_url || "",
          cachedUser.fullName || cachedUser.full_name || cachedUser.username || ""
        );
      } catch {
        sessionStorage.removeItem("cachedUser");
      }
    }

    const { user } = await api.auth.me();

    // --- SHOW LOGGED-IN UI ---
    document.querySelectorAll(".auth-logged-in")
      .forEach((el) => el.classList.remove("hidden"));

    // --- HIDE LOGGED-OUT UI ---
    document.querySelectorAll(".auth-logged-out")
      .forEach((el) => el.classList.add("hidden"));

    // --- Username in dropdown ---
    const nameEl = document.getElementById("headerUserName");
    if (nameEl) {
      nameEl.textContent = user.fullName || user.full_name || user.username || "Account";
    }

    const avatarUrl = user.avatarUrl || user.avatar_url || "";
    applyAccountAvatar(avatarUrl, user.fullName || user.full_name || user.username || "");
    sessionStorage.setItem("cachedUser", JSON.stringify(user));
    setAdminVisibility(user?.role === "admin");

  } catch {
    // Not authenticated
    document.querySelectorAll(".auth-logged-in")
      .forEach((el) => el.classList.add("hidden"));

    document.querySelectorAll(".auth-logged-out")
      .forEach((el) => el.classList.remove("hidden"));

    applyAccountAvatar("", "");
    setAdminVisibility(false);
  }
}

function setAdminVisibility(isAdmin) {
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("is-hidden", !isAdmin);
  });
}

async function updateAppName() {
  const cached = sessionStorage.getItem("appName");
  if (cached) {
    const nameEl = document.getElementById("appName");
    if (nameEl) nameEl.textContent = cached;
    applyAppName(cached);
  }

  try {
    const data = await api.appSettings.getPublic();
    const nextName = data?.appName || DEFAULT_APP_NAME;
    const nameEl = document.getElementById("appName");
    if (nameEl) nameEl.textContent = nextName;
    sessionStorage.setItem("appName", nextName);
    applyAppName(nextName);
  } catch {
    // ignore public settings failure
  }
}

function applyCachedAppName() {
  const cached = sessionStorage.getItem("appName");
  if (cached) {
    applyAppName(cached);
  }
}

function applyAppName(appName) {
  if (!appName) return;

  // Title
  if (document.title && APP_NAME_TEST.test(document.title)) {
    document.title = document.title.replace(APP_NAME_REGEX, appName);
  }

  // Header brand
  const nameEl = document.getElementById("appName");
  if (nameEl) {
    nameEl.textContent = appName;
  }

  // Meta tags
  const metaDescription = document.querySelector("meta[name='description']");
  if (metaDescription?.content && APP_NAME_TEST.test(metaDescription.content)) {
    metaDescription.content = metaDescription.content.replace(APP_NAME_REGEX, appName);
  }

  const metaAuthor = document.querySelector("meta[name='author']");
  if (metaAuthor?.content && APP_NAME_TEST.test(metaAuthor.content)) {
    metaAuthor.content = metaAuthor.content.replace(APP_NAME_REGEX, appName);
  }

  // Attributes
  const attrTargets = ["title", "placeholder", "aria-label", "alt", "content"];
  document.querySelectorAll("*").forEach((el) => {
    attrTargets.forEach((attr) => {
      const val = el.getAttribute(attr);
      if (val && APP_NAME_TEST.test(val)) {
        el.setAttribute(attr, val.replace(APP_NAME_REGEX, appName));
      }
    });
  });

  // Text nodes in body
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }

  nodes.forEach((textNode) => {
    const parent = textNode.parentElement;
    if (!parent) return;
    const tag = parent.tagName;
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(tag)) return;

    const value = textNode.nodeValue;
    if (value && APP_NAME_TEST.test(value)) {
      textNode.nodeValue = value.replace(APP_NAME_REGEX, appName);
    }
  });
}

window.addEventListener("appName:updated", (event) => {
  const nextName = event?.detail?.appName || sessionStorage.getItem("appName");
  if (nextName) {
    sessionStorage.setItem("appName", nextName);
    applyAppName(nextName);
  }
});

window.addEventListener("avatar:updated", (event) => {
  const newUrl = event?.detail?.avatarUrl || "";
  const fallbackName = event?.detail?.fallbackName || "";
  let nextFallback = fallbackName;
  if (!nextFallback) {
    const cachedUserRaw = sessionStorage.getItem("cachedUser");
    if (cachedUserRaw) {
      try {
        const cachedUser = JSON.parse(cachedUserRaw);
        nextFallback = cachedUser.fullName || cachedUser.full_name || cachedUser.username || "";
      } catch {
        sessionStorage.removeItem("cachedUser");
      }
    }
  }

  applyAccountAvatar(newUrl, nextFallback);
  const cachedUserRaw = sessionStorage.getItem("cachedUser");
  if (cachedUserRaw) {
    try {
      const cachedUser = JSON.parse(cachedUserRaw);
      cachedUser.avatarUrl = newUrl;
      sessionStorage.setItem("cachedUser", JSON.stringify(cachedUser));
    } catch {
      sessionStorage.removeItem("cachedUser");
    }
  }
});


/* ===============================================
  LOGOUT BUTTON
  =============================================== */

function wireLogoutButton() {
  if (document.body.dataset.logoutBound === "true") return;
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("#logoutBtn");
    if (!btn) return;

    try {
      await api.auth.logout();
      window.location.href = "login.html";
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Could not log out.");
    }
  });

  document.body.dataset.logoutBound = "true";
}


/* ===============================================
  DASHBOARD VIEW SELECTOR (NEW)
  =============================================== */

function wireDashboardViewSelector() {
  const selector = document.getElementById("dashboardViewSelect");
  if (!selector) return;
  if (selector.dataset.bound === "true") return;

  // Load saved setting
  const savedSettings = JSON.parse(localStorage.getItem("userSettings")) || {};
  selector.value = savedSettings.dashboardView || "Monthly";

  // Listen for changes
  selector.addEventListener("change", async () => {
    const newView = selector.value;
    savedSettings.dashboardView = newView;
    localStorage.setItem("userSettings", JSON.stringify(savedSettings));

    // Dispatch custom event to notify home.js
    document.dispatchEvent(new CustomEvent("dashboardViewChanged", {
      detail: { newView }
    }));
  });

  selector.dataset.bound = "true";
}


/* ===============================================
  LIVE NAVIGATION (NO HEADER/FOOTER FLICKER)
  =============================================== */

const LIVE_NAV_ENABLED = false;
const LIVE_PAGE_CONTAINER_ID = "page-content";
let liveNavInFlight = null;
const liveNavCache = new Map();
const liveNavPrefetching = new Set();
const LIVE_NAV_CACHE_LIMIT = Infinity;

function initLiveNavigation() {
  if (!LIVE_NAV_ENABLED) return;
  const headerEl = document.getElementById("header");
  const footerEl = document.getElementById("footer");
  if (!headerEl || !footerEl) return;

  ensureLivePageContainer();
  markInitialPageStyles();

  document.addEventListener("click", handleLiveNavClick);
  document.addEventListener("mouseover", handleLiveNavPrefetch, { passive: true });
  document.addEventListener("touchstart", handleLiveNavPrefetch, { passive: true });
  prefetchAllLinks();
  window.addEventListener("popstate", () => {
    navigateLive(window.location.href, { pushState: false });
  });
}

function ensureLivePageContainer() {
  if (document.getElementById(LIVE_PAGE_CONTAINER_ID)) return;
  const headerEl = document.getElementById("header");
  const footerEl = document.getElementById("footer");
  if (!headerEl || !footerEl) return;

  const container = document.createElement("div");
  container.id = LIVE_PAGE_CONTAINER_ID;

  const bodyNodes = Array.from(document.body.childNodes);
  bodyNodes.forEach((node) => {
    if (node === headerEl || node === footerEl) return;
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "SCRIPT") return;
    container.appendChild(node);
  });

  footerEl.parentNode.insertBefore(container, footerEl);
}

function handleLiveNavClick(event) {
  const link = event.target.closest("a");
  if (!link) return;
  if (event.defaultPrevented) return;
  if (link.target && link.target !== "_self") return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.hasAttribute("download")) return;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return;
  }

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (!url.pathname.endsWith(".html")) return;
  const currentUrl = new URL(window.location.href);
  if (url.pathname === currentUrl.pathname && url.search === currentUrl.search && url.hash) {
    return;
  }

  event.preventDefault();
  navigateLive(url.href, { pushState: true });
}

function handleLiveNavPrefetch(event) {
  const link = event.target.closest("a");
  if (!link) return;
  if (link.target && link.target !== "_self") return;
  if (link.hasAttribute("download")) return;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return;
  }

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (!url.pathname.endsWith(".html")) return;

  const key = url.href;
  if (liveNavCache.has(key) || liveNavPrefetching.has(key)) return;
  liveNavPrefetching.add(key);

  fetch(key, { cache: "force-cache" })
    .then((res) => (res.ok ? res.text() : null))
    .then((html) => {
      if (!html) return;
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const assets = extractPageAssets(parsed);
      cacheLiveHtml(key, html, assets);
      preloadAssets(assets);
    })
    .catch(() => {})
    .finally(() => {
      liveNavPrefetching.delete(key);
    });
}

async function navigateLive(targetUrl, { pushState }) {
  if (liveNavInFlight) liveNavInFlight.abort();
  const controller = new AbortController();
  liveNavInFlight = controller;

  try {
    const currentUrl = new URL(window.location.href);
    const nextUrl = new URL(targetUrl, window.location.href);
    if (currentUrl.pathname === nextUrl.pathname && currentUrl.search === nextUrl.search && !nextUrl.hash) {
      if (pushState) window.history.pushState({}, "", targetUrl);
      return;
    }

    const cached = liveNavCache.get(targetUrl);
    let html = cached?.html;
    if (!html) {
      const response = await fetch(targetUrl, { signal: controller.signal, cache: "force-cache" });
      if (!response.ok) throw new Error("Page fetch failed");
      html = await response.text();
      const parsedForCache = new DOMParser().parseFromString(html, "text/html");
      const assets = extractPageAssets(parsedForCache);
      cacheLiveHtml(targetUrl, html, assets);
      preloadAssets(assets);
    }
    const parsed = new DOMParser().parseFromString(html, "text/html");

    const headerEl = parsed.getElementById("header");
    const footerEl = parsed.getElementById("footer");
    if (!headerEl || !footerEl) {
      window.location.assign(targetUrl);
      return;
    }

    const newContent = extractLiveContent(parsed);
    if (!newContent) {
      window.location.assign(targetUrl);
      return;
    }

    const container = document.getElementById(LIVE_PAGE_CONTAINER_ID);
    if (!container) {
      window.location.assign(targetUrl);
      return;
    }

    container.innerHTML = "";
    container.appendChild(newContent);

    syncPageStyles(parsed);
    syncPageScripts(parsed);
    updateDocumentMetadata(parsed);

    if (pushState) {
      window.history.pushState({}, "", targetUrl);
    }

    setActiveNavLink();
    setActiveFooterLink();
    updateMobileNavActiveState();
    prefetchAllLinks();

    const targetHash = new URL(targetUrl).hash;
    if (targetHash) {
      const targetEl = document.querySelector(targetHash);
      if (targetEl) {
        targetEl.scrollIntoView({ block: "start" });
      }
    } else {
      window.scrollTo(0, 0);
    }
  } catch (err) {
    if (err?.name === "AbortError") return;
    console.error("Live navigation failed:", err);
    window.location.assign(targetUrl);
  } finally {
    liveNavInFlight = null;
  }
}

function extractLiveContent(parsedDoc) {
  const headerEl = parsedDoc.getElementById("header");
  const footerEl = parsedDoc.getElementById("footer");
  if (!headerEl || !footerEl) return null;

  const fragment = document.createDocumentFragment();
  Array.from(parsedDoc.body.childNodes).forEach((node) => {
    if (node === headerEl || node === footerEl) return;
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "SCRIPT") return;
    fragment.appendChild(document.importNode(node, true));
  });
  return fragment;
}

function updateDocumentMetadata(parsedDoc) {
  if (parsedDoc.title) {
    document.title = parsedDoc.title;
  }

  const newDescription = parsedDoc.querySelector('meta[name="description"]');
  if (newDescription) {
    let currentDescription = document.querySelector('meta[name="description"]');
    if (!currentDescription) {
      currentDescription = document.createElement("meta");
      currentDescription.setAttribute("name", "description");
      document.head.appendChild(currentDescription);
    }
    currentDescription.setAttribute("content", newDescription.getAttribute("content") || "");
  }
}

function markInitialPageStyles() {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href.endsWith("styles/default.css")) {
      link.dataset.pageStyle = "true";
    }
  });
}

function syncPageStyles(parsedDoc) {
  document.querySelectorAll('link[rel="stylesheet"][data-page-style="true"]').forEach((link) => {
    link.remove();
  });

  parsedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (href.endsWith("styles/default.css")) return;
    const newLink = document.createElement("link");
    newLink.rel = "stylesheet";
    newLink.href = href;
    newLink.dataset.pageStyle = "true";
    document.head.appendChild(newLink);
  });
}

function syncPageScripts(parsedDoc) {
  document.querySelectorAll('script[data-page-script="true"]').forEach((script) => {
    script.remove();
  });

  parsedDoc.querySelectorAll("script[src]").forEach((script) => {
    const src = script.getAttribute("src") || "";
    if (src.endsWith("scripts/default.js")) return;
    const newScript = document.createElement("script");
    newScript.src = src;
    const scriptType = script.getAttribute("type");
    if (scriptType) newScript.type = scriptType;
    newScript.defer = script.hasAttribute("defer");
    newScript.dataset.pageScript = "true";
    document.body.appendChild(newScript);
  });
}

function cacheLiveHtml(key, html, assets) {
  if (liveNavCache.has(key)) {
    liveNavCache.delete(key);
  }
  liveNavCache.set(key, { html, assets });
  if (liveNavCache.size > LIVE_NAV_CACHE_LIMIT) {
    const oldestKey = liveNavCache.keys().next().value;
    liveNavCache.delete(oldestKey);
  }
}

function extractPageAssets(parsedDoc) {
  const styles = [];
  parsedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href || href.endsWith("styles/default.css")) return;
    styles.push(href);
  });

  const scripts = [];
  parsedDoc.querySelectorAll("script[src]").forEach((script) => {
    const src = script.getAttribute("src") || "";
    if (!src || src.endsWith("scripts/default.js")) return;
    scripts.push({ src, type: script.getAttribute("type") || "" });
  });

  return { styles, scripts };
}

function preloadAssets(assets) {
  if (!assets) return;

  assets.styles.forEach((href) => {
    if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "style";
    preload.href = href;
    document.head.appendChild(preload);
  });

  assets.scripts.forEach(({ src, type }) => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    if (document.querySelector(`link[rel="preload"][href="${src}"]`)) return;
    if (document.querySelector(`link[rel="modulepreload"][href="${src}"]`)) return;
    const preload = document.createElement("link");
    preload.rel = type === "module" ? "modulepreload" : "preload";
    if (preload.rel === "preload") preload.as = "script";
    preload.href = src;
    document.head.appendChild(preload);
  });
}

function prefetchAllLinks() {
  document.querySelectorAll("a[href]").forEach((link) => {
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (!url.pathname.endsWith(".html")) return;

    const key = url.href;
    if (liveNavCache.has(key) || liveNavPrefetching.has(key)) return;
    liveNavPrefetching.add(key);

    fetch(key, { cache: "force-cache" })
      .then((res) => (res.ok ? res.text() : null))
      .then((html) => {
        if (!html) return;
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const assets = extractPageAssets(parsed);
        cacheLiveHtml(key, html, assets);
        preloadAssets(assets);
      })
      .catch(() => {})
      .finally(() => {
        liveNavPrefetching.delete(key);
      });
  });
}

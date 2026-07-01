import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../scripts/api.js";
import AboutPage from "./pages/AboutPage.jsx";
import AcceptInvitePage from "./pages/AcceptInvitePage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import BudgetingPage from "./pages/BudgetingPage.jsx";
import CareersPage from "./pages/CareersPage.jsx";
import ExpiredPage from "./pages/ExpiredPage.jsx";
import HelpPage from "./pages/HelpPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import IndexPage from "./pages/IndexPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import PlanningPage from "./pages/PlanningPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import RecordsPage from "./pages/RecordsPage.jsx";
import RecurringPage from "./pages/RecurringPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import RegisterWhoPage from "./pages/RegisterWhoPage.jsx";
import RegisterBusinessPage from "./pages/RegisterBusinessPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import RulesPage from "./pages/RulesPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import TermsPage from "./pages/TermsPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import TimeoutPage from "./pages/TimeoutPage.jsx";
import UploadPage from "./pages/UploadPage.jsx";

const ROUTES = {
  "/": { title: "WalletLens", Page: IndexPage },
  "/index": { title: "WalletLens", Page: IndexPage },
  "/login": { title: "WalletLens - Login", Page: LoginPage },
  "/register": { title: "WalletLens - Register", Page: RegisterPage },
  "/registerwho": { title: "WalletLens - Choose Account Type", Page: RegisterWhoPage },
  "/registerbusiness": { title: "WalletLens - Business Registration", Page: RegisterBusinessPage },
  "/acceptinvite": { title: "WalletLens - Accept Invitation", Page: AcceptInvitePage },
  "/home": { title: "WalletLens - Home", Page: HomePage },
  "/upload": { title: "WalletLens - Upload", Page: UploadPage },
  "/records": { title: "WalletLens - Records", Page: RecordsPage },
  "/recurring": { title: "WalletLens - Recurring", Page: RecurringPage },
  "/rules": { title: "WalletLens - Rules", Page: RulesPage },
  "/planning": { title: "WalletLens - Planning", Page: PlanningPage },
  "/budgeting": { title: "WalletLens - Budgeting", Page: BudgetingPage },
  "/reports": { title: "WalletLens - Reports", Page: ReportsPage },
  "/profile": { title: "WalletLens - Profile", Page: ProfilePage },
  "/settings": { title: "WalletLens - Settings", Page: SettingsPage },
  "/admin": { title: "WalletLens - Admin", Page: AdminPage },
  "/team": { title: "WalletLens - Team", Page: TeamPage },
  "/about": { title: "WalletLens - About", Page: AboutPage },
  "/careers": { title: "WalletLens - Careers", Page: CareersPage },
  "/help": { title: "WalletLens - Help", Page: HelpPage },
  "/privacy": { title: "WalletLens - Privacy", Page: PrivacyPage },
  "/terms": { title: "WalletLens - Terms", Page: TermsPage },
  "/timeout": { title: "WalletLens - Timeout", Page: TimeoutPage },
  "/expired": { title: "WalletLens - Expired", Page: ExpiredPage },
};
const PUBLIC_ROUTES = new Set([
  "/",
  "/index",
  "/login",
  "/register",
  "/registerwho",
  "/registerbusiness",
  "/acceptinvite",
  "/about",
  "/careers",
  "/help",
  "/privacy",
  "/terms",
  "/timeout",
  "/expired",
]);
const MAINTENANCE_MODE_ENABLED_KEY = "maintenanceModeEnabled";
const MAINTENANCE_MODE_BANNER_TEXT_KEY = "maintenanceModeBannerText";
const MAINTENANCE_MODE_PAGE_IDS_KEY = "maintenanceModePageIds";
const MAINTENANCE_MODE_BACKGROUND_COLOR_KEY = "maintenanceModeBackgroundColor";
const MAINTENANCE_MODE_TEXT_COLOR_KEY = "maintenanceModeTextColor";
const AUTH_TOKEN_KEY = "auth_token";
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function normalizePath(pathname) {
  let path = pathname || "/";
  if (path.length > 1) path = path.replace(/\/$/, "");
  if (path.endsWith(".html")) {
    const base = path.slice(0, -5);
    return base === "/index" ? "/" : base;
  }
  return path || "/";
}

function cleanHref(url) {
  if (url.pathname.endsWith(".html")) {
    const next = normalizePath(url.pathname);
    return `${next}${url.search}${url.hash}`;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function isProtectedRoute(path) {
  const normalized = normalizePath(path);
  return Boolean(ROUTES[normalized]) && !PUBLIC_ROUTES.has(normalized);
}

function hasClientAuthHint() {
  return Boolean(sessionStorage.getItem(AUTH_TOKEN_KEY));
}

function normalizeMaintenanceColor(value, fallback) {
  const color = String(value || "").trim();
  return HEX_COLOR_RE.test(color) ? color.toLowerCase() : fallback;
}

function getPageToken(path) {
  const normalized = normalizePath(path);
  if (normalized === "/" || normalized === "/index") return "index";
  return normalized.replace(/^\//, "").toLowerCase();
}

function normalizeMaintenancePageIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((pageId) => String(pageId || "").trim().toLowerCase()).filter(Boolean))
  );
}

function readJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return normalizeMaintenancePageIds(parsed);
  } catch {
    return [];
  }
}

function readCachedMaintenanceSettings() {
  return {
    enabled: sessionStorage.getItem(MAINTENANCE_MODE_ENABLED_KEY) === "true",
    text: String(sessionStorage.getItem(MAINTENANCE_MODE_BANNER_TEXT_KEY) || "").trim(),
    pageIds: readJsonArray(sessionStorage.getItem(MAINTENANCE_MODE_PAGE_IDS_KEY)),
    backgroundColor: normalizeMaintenanceColor(sessionStorage.getItem(MAINTENANCE_MODE_BACKGROUND_COLOR_KEY), "#ff8a00"),
    textColor: normalizeMaintenanceColor(sessionStorage.getItem(MAINTENANCE_MODE_TEXT_COLOR_KEY), "#ffffff"),
  };
}

function toMaintenanceSettings(data) {
  return {
    enabled: Boolean(data?.maintenanceModeEnabled),
    text: String(data?.maintenanceModeBannerText || "").trim(),
    pageIds: normalizeMaintenancePageIds(data?.maintenanceModePageIds),
    backgroundColor: normalizeMaintenanceColor(data?.maintenanceModeBackgroundColor, "#ff8a00"),
    textColor: normalizeMaintenanceColor(data?.maintenanceModeTextColor, "#ffffff"),
  };
}

function cacheMaintenanceSettings(settings) {
  sessionStorage.setItem(MAINTENANCE_MODE_ENABLED_KEY, String(Boolean(settings.enabled)));
  sessionStorage.setItem(MAINTENANCE_MODE_BANNER_TEXT_KEY, settings.text || "");
  sessionStorage.setItem(MAINTENANCE_MODE_PAGE_IDS_KEY, JSON.stringify(normalizeMaintenancePageIds(settings.pageIds)));
  sessionStorage.setItem(MAINTENANCE_MODE_BACKGROUND_COLOR_KEY, normalizeMaintenanceColor(settings.backgroundColor, "#ff8a00"));
  sessionStorage.setItem(MAINTENANCE_MODE_TEXT_COLOR_KEY, normalizeMaintenanceColor(settings.textColor, "#ffffff"));
}

function shouldShowMaintenanceBanner(settings, path) {
  if (!settings?.enabled) return false;
  if (!settings?.text) return false;
  const pageIds = normalizeMaintenancePageIds(settings.pageIds);
  if (!pageIds.length) return true;
  return pageIds.includes(getPageToken(path));
}

function PublicContactForm() {
  const [form, setForm] = useState({ subject: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus("Please add subject, email, and message.");
      return;
    }
    setSending(true);
    setStatus("Sending your message...");
    try {
      await api.support.contactPublic({ ...form, name: "Guest User" });
      setStatus("Thanks. Your message has been sent to support.");
      setForm({ subject: "", email: "", message: "" });
    } catch (err) {
      setStatus(err?.message || "Unable to send message right now.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="nf-contact-form" onSubmit={submit}>
      <label>
        <span className="label">Subject</span>
        <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} autoComplete="off" placeholder="What can we help with?" required />
      </label>
      <label>
        <span className="label">Email</span>
        <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" placeholder="you@example.com" required />
      </label>
      <label>
        <span className="label">Message</span>
        <textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows="5" placeholder="Tell us what happened." required />
      </label>
      {status ? <p className="subtle" aria-live="polite">{status}</p> : null}
      <button type="submit" className="nf-btn" disabled={sending}>{sending ? "Sending..." : "Send Message"}</button>
    </form>
  );
}

function PublicInfoModal({ kind, onClose, hasMaintenanceBanner = false }) {
  if (!kind) return null;
  const title = kind === "about" ? "About WalletLens" : kind === "privacy" ? "Privacy Policy" : "Contact";
  return (
    <div
      className={`nf-modal public-info-modal${hasMaintenanceBanner ? " public-info-modal--with-maintenance" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="publicInfoModalTitle"
    >
      <button type="button" className="nf-modal-backdrop" aria-label="Close" onClick={onClose}></button>
      <div className="nf-modal-content public-info-modal-content" role="document">
        <div className="nf-modal-header">
          <h2 id="publicInfoModalTitle">{title}</h2>
          <button type="button" className="nf-modal-close" onClick={onClose}>Back</button>
        </div>
        <div className="nf-modal-body public-info-modal-body">
          {kind === "contact" ? (
            <PublicContactForm />
          ) : (
            <iframe title={title} src={`/${kind}?embedded=1`} />
          )}
        </div>
      </div>
    </div>
  );
}

function ensureMaintenanceBannerHost() {
  if (!document.body) return null;

  let host = document.getElementById("maintenanceBannerHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "maintenanceBannerHost";
    host.className = "maintenance-banner-host";
  }

  const header = document.querySelector("header.nf-header") || document.querySelector("#header");
  if (header?.parentNode) {
    const headerStyle = window.getComputedStyle(header);
    const headerOffset = headerStyle.position === "fixed"
      ? `${Math.ceil(header.getBoundingClientRect().height)}px`
      : "0px";
    host.style.setProperty("--maintenance-header-offset", headerOffset);
    header.insertAdjacentElement("afterend", host);
    return host;
  }

  host.style.setProperty("--maintenance-header-offset", "0px");
  const main = document.querySelector("main");
  if (main?.parentNode) {
    main.parentNode.insertBefore(host, main);
    return host;
  }

  const root = document.getElementById("root");
  if (root) {
    root.insertBefore(host, root.firstChild);
    return host;
  }

  document.body.insertBefore(host, document.body.firstChild);
  return host;
}

export default function App() {
  const [locationState, setLocationState] = useState(() => ({
    path: normalizePath(window.location.pathname),
    search: window.location.search,
    hash: window.location.hash,
  }));
  const [authGateChecking, setAuthGateChecking] = useState(() =>
    isProtectedRoute(window.location.pathname) && !hasClientAuthHint()
  );
  const [maintenanceSettings, setMaintenanceSettings] = useState(() => ({
    ...readCachedMaintenanceSettings(),
  }));
  const [maintenanceBannerHost, setMaintenanceBannerHost] = useState(null);
  const [publicModal, setPublicModal] = useState("");
  const path = locationState.path;
  const route = useMemo(() => ROUTES[path] || ROUTES["/"], [path]);
  const Page = route.Page;
  const showMaintenanceBanner = shouldShowMaintenanceBanner(maintenanceSettings, path);

  useEffect(() => {
    const cleanPath = normalizePath(window.location.pathname);
    if (cleanPath !== window.location.pathname) {
      window.history.replaceState({}, "", `${cleanPath}${window.location.search}${window.location.hash}`);
    }

    const verifyAuthForProtectedRoute = async () => {
      if (hasClientAuthHint()) return true;
      try {
        const { user } = await api.auth.me();
        if (user) sessionStorage.setItem("cachedUser", JSON.stringify(user));
        return true;
      } catch {
        return false;
      }
    };

    const routeTo = async (href, { replace = false } = {}) => {
      let url = new URL(href, window.location.href);
      const nextPath = normalizePath(url.pathname);
      if (!ROUTES[nextPath]) {
        window.location.href = href;
        return;
      }
      if (isProtectedRoute(nextPath) && !(await verifyAuthForProtectedRoute())) {
        url = new URL("/", window.location.href);
      }
      const safePath = normalizePath(url.pathname);
      if (replace) window.history.replaceState({}, "", cleanHref(url));
      else window.history.pushState({}, "", cleanHref(url));
      setLocationState({ path: safePath, search: url.search, hash: url.hash });
      setAuthGateChecking(false);
      window.scrollTo({ top: 0, left: 0 });
    };

    window.__walletlensNavigate = (href) => routeTo(href);

    if (isProtectedRoute(cleanPath) && !hasClientAuthHint()) {
      setAuthGateChecking(true);
      routeTo(`${cleanPath}${window.location.search}${window.location.hash}`, { replace: true });
    } else {
      setAuthGateChecking(false);
    }

    const onPopState = async () => {
      const nextPath = normalizePath(window.location.pathname);
      if (isProtectedRoute(nextPath) && !(await verifyAuthForProtectedRoute())) {
        routeTo("/", { replace: true });
        return;
      }
      setAuthGateChecking(false);
      setLocationState({
        path: nextPath,
        search: window.location.search,
        hash: window.location.hash,
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      delete window.__walletlensNavigate;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    document.title = route.title;
    const landingRoutes = new Set(["/", "/index", "/login", "/register", "/registerwho", "/registerbusiness", "/acceptinvite", "/timeout", "/expired"]);
    document.body.classList.toggle("landing-light", landingRoutes.has(path));
    window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent("walletlens:template-ready"));
    }, 0);
  }, [path, route]);

  useEffect(() => {
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target.closest?.("a[href], [data-href], [data-public-modal]");
      if (!target) return;
      const publicModalKind = target.getAttribute("data-public-modal");
      if (publicModalKind && ["about", "privacy", "contact"].includes(publicModalKind)) {
        if (!hasClientAuthHint()) {
          event.preventDefault();
          setPublicModal(publicModalKind);
          return;
        }
      }
      const rawHref = target.getAttribute("href") || target.getAttribute("data-href") || "";
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;
      const url = new URL(rawHref, window.location.href);
      if (url.origin !== window.location.origin) return;
      const nextPath = normalizePath(url.pathname);
      if (!ROUTES[nextPath]) return;

      event.preventDefault();
      window.__walletlensNavigate(cleanHref(url));
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    let active = true;
    let rafId = 0;

    const updateBannerHost = () => {
      rafId = window.requestAnimationFrame(() => {
        if (active) setMaintenanceBannerHost(ensureMaintenanceBannerHost());
      });
    };

    updateBannerHost();
    document.addEventListener("walletlens:template-ready", updateBannerHost);

    return () => {
      active = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      document.removeEventListener("walletlens:template-ready", updateBannerHost);
    };
  }, [path]);

  useEffect(() => {
    let active = true;
    const applyPublicSettings = (data) => {
      if (!active) return;
      const settings = toMaintenanceSettings(data);
      cacheMaintenanceSettings(settings);
      setMaintenanceSettings(settings);
    };

    api.appSettings.getPublic().then(applyPublicSettings).catch(() => {});

    const onMaintenanceUpdated = (event) => {
      const settings = toMaintenanceSettings({
        maintenanceModeEnabled: event?.detail?.enabled,
        maintenanceModeBannerText: event?.detail?.text,
        maintenanceModePageIds: event?.detail?.pageIds,
        maintenanceModeBackgroundColor: event?.detail?.backgroundColor,
        maintenanceModeTextColor: event?.detail?.textColor,
      });
      cacheMaintenanceSettings(settings);
      if (active) setMaintenanceSettings(settings);
    };
    window.addEventListener("maintenanceSettings:updated", onMaintenanceUpdated);

    return () => {
      active = false;
      window.removeEventListener("maintenanceSettings:updated", onMaintenanceUpdated);
    };
  }, []);

  return (
    <>
      {authGateChecking ? null : <Page key={`${locationState.path}${locationState.search}${locationState.hash}`} />}
      {showMaintenanceBanner && maintenanceBannerHost ? createPortal(
        <div
          id="maintenanceBanner"
          className="maintenance-banner"
          style={{
            backgroundColor: maintenanceSettings.backgroundColor,
            borderColor: maintenanceSettings.backgroundColor,
            color: maintenanceSettings.textColor,
          }}
        >
          {maintenanceSettings.text}
        </div>,
        maintenanceBannerHost
      ) : null}
      <PublicInfoModal kind={publicModal} onClose={() => setPublicModal("")} hasMaintenanceBanner={showMaintenanceBanner} />
    </>
  );
}

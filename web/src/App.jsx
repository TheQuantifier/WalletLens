import { useEffect, useMemo, useState } from "react";
import AboutPage from "./pages/AboutPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import BudgetingPage from "./pages/BudgetingPage.jsx";
import CareersPage from "./pages/CareersPage.jsx";
import ExpiredPage from "./pages/ExpiredPage.jsx";
import HelpPage from "./pages/HelpPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import IndexPage from "./pages/IndexPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
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
import TimeoutPage from "./pages/TimeoutPage.jsx";
import UploadPage from "./pages/UploadPage.jsx";

const ROUTES = {
  "/": { title: "WalletLens", Page: IndexPage },
  "/index": { title: "WalletLens", Page: IndexPage },
  "/login": { title: "WalletLens - Login", Page: LoginPage },
  "/register": { title: "WalletLens - Register", Page: RegisterPage },
  "/registerwho": { title: "WalletLens - Choose Account Type", Page: RegisterWhoPage },
  "/registerbusiness": { title: "WalletLens - Business Registration", Page: RegisterBusinessPage },
  "/home": { title: "WalletLens - Home", Page: HomePage },
  "/upload": { title: "WalletLens - Upload", Page: UploadPage },
  "/records": { title: "WalletLens - Records", Page: RecordsPage },
  "/recurring": { title: "WalletLens - Recurring", Page: RecurringPage },
  "/rules": { title: "WalletLens - Rules", Page: RulesPage },
  "/budgeting": { title: "WalletLens - Budgeting", Page: BudgetingPage },
  "/reports": { title: "WalletLens - Reports", Page: ReportsPage },
  "/profile": { title: "WalletLens - Profile", Page: ProfilePage },
  "/settings": { title: "WalletLens - Settings", Page: SettingsPage },
  "/admin": { title: "WalletLens - Admin", Page: AdminPage },
  "/about": { title: "WalletLens - About", Page: AboutPage },
  "/careers": { title: "WalletLens - Careers", Page: CareersPage },
  "/help": { title: "WalletLens - Help", Page: HelpPage },
  "/privacy": { title: "WalletLens - Privacy", Page: PrivacyPage },
  "/terms": { title: "WalletLens - Terms", Page: TermsPage },
  "/timeout": { title: "WalletLens - Timeout", Page: TimeoutPage },
  "/expired": { title: "WalletLens - Expired", Page: ExpiredPage },
};

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

export default function App() {
  const [locationState, setLocationState] = useState(() => ({
    path: normalizePath(window.location.pathname),
    search: window.location.search,
    hash: window.location.hash,
  }));
  const path = locationState.path;
  const route = useMemo(() => ROUTES[path] || ROUTES["/"], [path]);
  const Page = route.Page;

  useEffect(() => {
    const cleanPath = normalizePath(window.location.pathname);
    if (cleanPath !== window.location.pathname) {
      window.history.replaceState({}, "", `${cleanPath}${window.location.search}${window.location.hash}`);
    }

    window.__walletlensNavigate = (href) => {
      const url = new URL(href, window.location.href);
      const nextPath = normalizePath(url.pathname);
      if (!ROUTES[nextPath]) {
        window.location.href = href;
        return;
      }
      window.history.pushState({}, "", cleanHref(url));
      setLocationState({ path: nextPath, search: url.search, hash: url.hash });
      window.scrollTo({ top: 0, left: 0 });
    };

    const onPopState = () =>
      setLocationState({
        path: normalizePath(window.location.pathname),
        search: window.location.search,
        hash: window.location.hash,
      });
    window.addEventListener("popstate", onPopState);
    return () => {
      delete window.__walletlensNavigate;
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    document.title = route.title;
    const landingRoutes = new Set(["/", "/index", "/login", "/register", "/registerwho", "/registerbusiness", "/timeout", "/expired"]);
    document.body.classList.toggle("landing-light", landingRoutes.has(path));
    window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent("walletlens:template-ready"));
    }, 0);
  }, [path, route]);

  useEffect(() => {
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target.closest?.("a[href], [data-href]");
      if (!target) return;
      const rawHref = target.getAttribute("href") || target.getAttribute("data-href") || "";
      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;
      const url = new URL(rawHref, window.location.href);
      if (url.origin !== window.location.origin) return;
      const nextPath = normalizePath(url.pathname);
      if (!ROUTES[nextPath]) return;

      event.preventDefault();
      const nextHref = cleanHref(url);
      window.history.pushState({}, "", nextHref);
      setLocationState({ path: nextPath, search: url.search, hash: url.hash });
      window.scrollTo({ top: 0, left: 0 });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <Page key={`${locationState.path}${locationState.search}${locationState.hash}`} />;
}

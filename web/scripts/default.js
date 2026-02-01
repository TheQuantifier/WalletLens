/* ===============================================
WalletWise – default.js
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

/**
 * Pages that do NOT require authentication
 */
const PUBLIC_PAGES = ["index.html", "login.html", "register.html", ""];

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
  loadHeaderAndFooter();
});

/**
* Fetch and inject header & footer, then init UI
*/
function loadHeaderAndFooter() {
  // --- Load Header ---
  fetch("components/header.html")
    .then((res) => {
      if (!res.ok) throw new Error("Header not found");
      return res.text();
    })
    .then((html) => {
      document.getElementById("header").innerHTML = html;

      setActiveNavLink();
      initAccountMenu();
      updateHeaderAuthState();
      wireLogoutButton();
      wireDashboardViewSelector(); // NEW: Wire dashboard view selector
    })
    .catch((err) => console.error("Header load failed:", err));

  // --- Load Footer ---
  fetch("components/footer.html")
    .then((res) => {
      if (!res.ok) throw new Error("Footer not found");
      return res.text();
    })
    .then((html) => {
      const footerEl = document.getElementById("footer");
      if (footerEl) footerEl.innerHTML = html;
    })
    .catch((err) => console.error("Footer load failed:", err));
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


/* ===============================================
  ACCOUNT MENU DROPDOWN
  =============================================== */

function initAccountMenu() {
  const icon = document.getElementById("account-icon");
  const menu = document.getElementById("account-menu");
  if (!icon || !menu) return;

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
}


/* ===============================================
  INITIALS HELPER
  =============================================== */

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


/* ===============================================
  AUTH STATE IN HEADER
  =============================================== */

async function updateHeaderAuthState() {
  try {
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
      nameEl.textContent = user.fullName || user.username || "Account";
    }

    // --- Avatar initials ---
    const avatar = document.getElementById("avatarLetters");
    if (avatar) {
      avatar.textContent = getInitials(user.fullName || user.username);
    }

  } catch {
    // Not authenticated
    document.querySelectorAll(".auth-logged-in")
      .forEach((el) => el.classList.add("hidden"));

    document.querySelectorAll(".auth-logged-out")
      .forEach((el) => el.classList.remove("hidden"));
  }
}


/* ===============================================
  LOGOUT BUTTON
  =============================================== */

function wireLogoutButton() {
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
}


/* ===============================================
  DASHBOARD VIEW SELECTOR (NEW)
  =============================================== */

function wireDashboardViewSelector() {
  const selector = document.getElementById("dashboardViewSelect");
  if (!selector) return;

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
}

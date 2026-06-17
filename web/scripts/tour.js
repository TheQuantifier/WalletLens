const TOUR_STORAGE_KEY = "app_tour_state_v1";
const TOUR_ACTIVE_KEY = "app_tour_active_v1";
const TOUR_WELCOME_KEY = "app_tour_welcome_seen_v1";
const SPOTLIGHT_PADDING = 10;

let resizeHandler = null;
let scrollHandler = null;
let spotlightEl = null;
let observerStarted = false;

const TOUR_STEPS = [
  {
    id: "walterlens-fab",
    page: null,
    selector: ".walterlens-fab",
    title: "Meet WalterLens AI",
    body: "WalterLens is your AI finance co-pilot. Ask questions about spending, categories, and trends anytime.",
    placement: "left",
    onEnter: () => openWalterLensPanel(),
  },
  {
    id: "walterlens-panel",
    page: null,
    selector: "#walterlens-panel",
    title: "Ask in plain English",
    body:
      "Try prompts like \"What changed most this month?\" or \"Find duplicate subscriptions.\" WalterLens pulls answers from your data.",
    placement: "left",
    onEnter: () => openWalterLensPanel(),
  },
  {
    id: "home-overview",
    page: "home",
    selector: ".hero-primary",
    title: "Home dashboard",
    body:
      "Your home dashboard summarizes projected savings, cashflow health, and key metrics that update as new transactions arrive.",
    placement: "bottom",
  },
  {
    id: "home-focus",
    page: "home",
    selector: ".hero-secondary",
    title: "Focus this week",
    body: "Weekly priorities surface here so you know what to tighten up or optimize next.",
    placement: "bottom",
    onEnter: () => closeWalterLensPanel(),
  },
  {
    id: "upload-uploader",
    page: "upload",
    selector: ".upload-primary",
    title: "Upload receipts",
    body: "Drop receipts or PDFs here. Review pending files, then upload when everything looks right.",
    placement: "right",
  },
  {
    id: "upload-recent",
    page: "upload",
    selector: ".recent",
    title: "Recent uploads",
    body: "Track OCR status and retry files that need attention.",
    placement: "bottom",
  },
  {
    id: "records-actions",
    page: "records",
    selector: ".records-actions",
    title: "Quick actions",
    body: "Add expenses or income instantly. Export when you need a CSV backup.",
    placement: "bottom",
  },
  {
    id: "records-filters",
    page: "records",
    selector: "#filtersForm",
    title: "Filter records",
    body: "Search by category, notes, dates, or payment method to pinpoint transactions.",
    placement: "bottom",
  },
  {
    id: "records-table",
    page: "records",
    selector: ".records-table",
    title: "Records table",
    body: "Sort columns to spot patterns quickly across expenses and income.",
    placement: "bottom",
  },
  {
    id: "recurring-hero",
    page: "recurring",
    selector: ".recurring-hero",
    title: "Automate recurring bills",
    body: "Create schedules for subscriptions or payroll, then manage them as they change.",
    placement: "bottom",
  },
  {
    id: "recurring-list",
    page: "recurring",
    selector: "#recurringList",
    title: "Your active schedules",
    body: "Review what's already set up, then edit, pause, or delete when things change.",
    placement: "bottom",
  },
  {
    id: "rules-hero",
    page: "rules",
    selector: ".rules-hero",
    title: "Rules engine",
    body: "Create rules to auto-categorize and apply them in bulk when you need a cleanup.",
    placement: "bottom",
  },
  {
    id: "rules-list",
    page: "rules",
    selector: ".rules-section",
    title: "Active rules",
    body: "Each rule can set categories, tags, or notes when conditions match.",
    placement: "bottom",
  },
  {
    id: "budget-hero",
    page: "budgeting",
    selector: ".budget-hero",
    title: "Pick the budget period",
    body: "Switch between months or cycles and add new budgets as you go.",
    placement: "bottom",
  },
  {
    id: "budget-table",
    page: "budgeting",
    selector: ".budget-table",
    title: "Category budgets",
    body: "Edit category budgets, reallocate unused funds, and save changes.",
    placement: "bottom",
  },
  {
    id: "reports-hero",
    page: "reports",
    selector: ".report-hero",
    title: "Report controls + KPIs",
    body: "Pick a date range and refresh to update KPIs, insights, and totals.",
    placement: "bottom",
  },
  {
    id: "reports-bars",
    page: "reports",
    selector: ".chart-section--split",
    title: "Category pulse",
    body: "Compare expenses and income sources side-by-side for fast insights.",
    placement: "bottom",
  },
  {
    id: "reports-timeline",
    page: "reports",
    selector: "#monthlyChart",
    title: "Cashflow timeline",
    body: "Toggle income or expenses to focus the trend line.",
    placement: "bottom",
  },
];

export function initAppTour() {
  attachStartButtons();
  resumeTourIfNeeded();
}

function attachStartButtons() {
  const wireButtons = () => {
    document.querySelectorAll("[data-tour-start]").forEach((btn) => {
      if (btn.dataset.tourBound) return;
      btn.dataset.tourBound = "true";
      btn.addEventListener("click", () => startTourAt(0));
    });
  };

  wireButtons();

  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => wireButtons());
  observer.observe(document.body, { childList: true, subtree: true });
}

function startTourAt(index) {
  localStorage.setItem(TOUR_ACTIVE_KEY, "true");
  localStorage.setItem(TOUR_WELCOME_KEY, "true");
  setTourState({ index });
  showTourStep(index);
}

function resumeTourIfNeeded() {
  if (localStorage.getItem(TOUR_ACTIVE_KEY) !== "true") return;
  const state = getTourState();
  const index = Number(state.index || 0);
  if (index === 0 && localStorage.getItem(TOUR_WELCOME_KEY) !== "true") {
    showWelcomeModal(index);
    return;
  }
  showTourStep(index);
}

function getTourState() {
  try {
    return JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setTourState(next) {
  const state = { ...getTourState(), ...next };
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
}

function clearTourState() {
  localStorage.removeItem(TOUR_ACTIVE_KEY);
  localStorage.removeItem(TOUR_STORAGE_KEY);
}

function showTourStep(index) {
  const step = TOUR_STEPS[index];
  if (!step) {
    teardownTour();
    clearTourState();
    return;
  }

  const currentPage = getCurrentPage();
  if (step.page && step.page !== currentPage) {
    setTourState({ index });
    navigateToPage(step.page);
    return;
  }

  const target = resolveTarget(step);
  if (!target) {
    showTourStep(index + 1);
    return;
  }

  step.onEnter?.();
  if (step.page === "rules") {
    const onboardingModal = document.getElementById("rulesOnboardingModal");
    onboardingModal?.classList.add("hidden");
  }

  focusTarget(target);
  renderTourUI(index, target);
}

function renderTourUI(index, target) {
  teardownTour();

  const tooltip = document.createElement("div");
  tooltip.className = "app-tour-tooltip";
  tooltip.setAttribute("role", "dialog");
  tooltip.setAttribute("aria-live", "polite");

  const step = TOUR_STEPS[index];
  const total = TOUR_STEPS.length;
  tooltip.innerHTML = `
    <div class="app-tour-step">Step ${index + 1} of ${total}</div>
    <h3>${step.title}</h3>
    <p>${step.body}</p>
    <div class="app-tour-actions">
      <button type="button" class="btn app-tour-skip">Skip</button>
      ${index > 0 ? '<button type="button" class="btn app-tour-back">Back</button>' : ""}
      <button type="button" class="btn btn--primary app-tour-next">${index === total - 1 ? "Finish" : "Next"}</button>
    </div>
  `;

  spotlightEl = document.createElement("div");
  spotlightEl.className = "app-tour-spotlight";
  document.body.appendChild(spotlightEl);
  document.body.appendChild(tooltip);

  tooltip.querySelector(".app-tour-next")?.addEventListener("click", () => advanceStep(index + 1));
  tooltip.querySelector(".app-tour-back")?.addEventListener("click", () => advanceStep(index - 1));
  tooltip.querySelector(".app-tour-skip")?.addEventListener("click", () => finishTour());

  positionSpotlight(spotlightEl, target);
  positionTooltip(tooltip, target, step.placement);
  resizeHandler = () => {
    positionSpotlight(spotlightEl, target);
    positionTooltip(tooltip, target, step.placement);
  };
  scrollHandler = () => {
    positionSpotlight(spotlightEl, target);
    positionTooltip(tooltip, target, step.placement);
  };
  window.addEventListener("resize", resizeHandler);
  window.addEventListener("scroll", scrollHandler, true);
}

function advanceStep(nextIndex) {
  if (nextIndex < 0) return;
  setTourState({ index: nextIndex });
  showTourStep(nextIndex);
}

function finishTour() {
  teardownTour();
  clearTourState();
}

function teardownTour() {
  document.querySelectorAll(".app-tour-spotlight, .app-tour-tooltip").forEach((el) => el.remove());
  document.querySelectorAll(".app-tour-target").forEach((el) => {
    el.classList.remove("app-tour-target");
  });
  if (resizeHandler) {
    window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
  }
  if (scrollHandler) {
    window.removeEventListener("scroll", scrollHandler, true);
    scrollHandler = null;
  }
  spotlightEl = null;
}

function focusTarget(target) {
  target.classList.add("app-tour-target");
  target.scrollIntoView({ behavior: "smooth", block: "center" });
}

function positionTooltip(tooltip, target, placement) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const padding = 14;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = rect.bottom + padding;
  let left = rect.left;
  let finalPlacement = placement || "bottom";

  if (placement === "left") {
    top = rect.top;
    left = rect.left - tooltipRect.width - padding;
  } else if (placement === "right") {
    top = rect.top;
    left = rect.right + padding;
  } else if (placement === "top") {
    top = rect.top - tooltipRect.height - padding;
    left = rect.left;
  }

  if (left + tooltipRect.width > viewportWidth - padding) {
    left = viewportWidth - tooltipRect.width - padding;
  }
  if (left < padding) {
    left = padding;
  }
  if (top + tooltipRect.height > viewportHeight - padding) {
    top = Math.max(padding, rect.top - tooltipRect.height - padding);
    finalPlacement = "top";
  }
  if (top < padding) {
    top = rect.bottom + padding;
    finalPlacement = "bottom";
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.dataset.placement = finalPlacement;
}

function positionSpotlight(spotlight, target) {
  if (!spotlight || !target) return;
  const rect = target.getBoundingClientRect();
  const padding = SPOTLIGHT_PADDING;
  const top = Math.max(0, rect.top - padding);
  const left = Math.max(0, rect.left - padding);
  const width = Math.min(window.innerWidth, rect.width + padding * 2);
  const height = Math.min(window.innerHeight, rect.height + padding * 2);

  spotlight.style.top = `${top}px`;
  spotlight.style.left = `${left}px`;
  spotlight.style.width = `${width}px`;
  spotlight.style.height = `${height}px`;
}

function getCurrentPage() {
  const path = window.location.pathname.replace(/\/$/, "");
  const rawPage = (path.split("/").pop() || "").toLowerCase();
  if (!rawPage || rawPage === "index.html") return "index";
  return rawPage.endsWith(".html") ? rawPage.slice(0, -5) : rawPage;
}

function navigateToPage(page) {
  const target = `/${String(page || "").replace(/^\/+/, "").replace(/\.html$/i, "")}`;
  if (typeof window.__walletlensNavigate === "function") {
    window.__walletlensNavigate(target);
    return;
  }
  window.history.pushState({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function showWelcomeModal(startIndex) {
  if (document.querySelector(".app-tour-welcome")) return;

  const overlay = document.createElement("div");
  overlay.className = "app-tour-welcome-overlay";

  const modal = document.createElement("div");
  modal.className = "app-tour-welcome";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <button class="app-tour-welcome-close" type="button" aria-label="Close">x</button>
    <p class="app-tour-welcome-kicker">Welcome to WalletLens</p>
    <h3>Your quick guided tour is ready</h3>
    <p class="app-tour-welcome-body">
      We'll show you the essentials in under 2 minutes, including WalterLens AI and the dashboards that matter.
    </p>
    <div class="app-tour-welcome-actions">
      <button type="button" class="btn app-tour-welcome-skip">Maybe later</button>
      <button type="button" class="btn btn--primary app-tour-welcome-start">Start the tour</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  const closeAll = () => {
    overlay.remove();
    modal.remove();
  };

  modal.querySelector(".app-tour-welcome-start")?.addEventListener("click", () => {
    localStorage.setItem(TOUR_WELCOME_KEY, "true");
    closeAll();
    showTourStep(startIndex);
  });

  const skip = () => {
    closeAll();
    clearTourState();
  };

  modal.querySelector(".app-tour-welcome-skip")?.addEventListener("click", skip);
  modal.querySelector(".app-tour-welcome-close")?.addEventListener("click", skip);
}

function resolveTarget(step) {
  if (!step?.selector) return null;
  const selectors = Array.isArray(step.selector) ? step.selector : [step.selector];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (el.offsetWidth > 0 && el.offsetHeight > 0) return el;
    if (el.getClientRects().length > 0) return el;
  }

  return document.querySelector(selectors[0]) || null;
}

function openWalterLensPanel() {
  const fab = document.querySelector(".walterlens-fab");
  const panel = document.querySelector("#walterlens-panel");
  if (!fab || !panel) return;
  const expanded = fab.getAttribute("aria-expanded") === "true";
  if (!expanded) {
    fab.click();
  }
}

function closeWalterLensPanel() {
  const fab = document.querySelector(".walterlens-fab");
  const panel = document.querySelector("#walterlens-panel");
  if (!fab || !panel) return;
  const expanded = fab.getAttribute("aria-expanded") === "true";
  if (expanded) {
    const closeBtn = panel.querySelector(".walterlens-close");
    if (closeBtn) {
      closeBtn.click();
      return;
    }
    fab.click();
  }
}

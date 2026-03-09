// web/scripts/admin.js
import { api } from "./api.js";

const els = {
  statsUsers: document.getElementById("statsUsers"),
  statsRecords: document.getElementById("statsRecords"),
  statsReceipts: document.getElementById("statsReceipts"),
  statsStatus: document.getElementById("statsStatus"),

  usersTbody: document.getElementById("usersTbody"),
  usersPanel: document.getElementById("usersPanel"),
  usersPanelBody: document.getElementById("usersPanelBody"),
  toggleUsersPanelCaret: document.getElementById("toggleUsersPanelCaret"),
  usersStatus: document.getElementById("usersStatus"),
  userSearch: document.getElementById("userSearch"),
  userSearchBtn: document.getElementById("userSearchBtn"),
  userClearBtn: document.getElementById("userClearBtn"),
  userOptions: document.getElementById("adminUserOptions"),
  usersPrevPage: document.getElementById("usersPrevPage"),
  usersNextPage: document.getElementById("usersNextPage"),
  usersPageInfo: document.getElementById("usersPageInfo"),
  userDataSections: document.getElementById("userDataSections"),
  achievementsPanel: document.getElementById("achievementsPanel"),
  achievementsPanelBody: document.getElementById("achievementsPanelBody"),
  toggleAchievementsPanelCaret: document.getElementById("toggleAchievementsPanelCaret"),
  notificationsPanel: document.getElementById("notificationsPanel"),
  notificationsPanelBody: document.getElementById("notificationsPanelBody"),
  toggleNotificationsPanelCaret: document.getElementById("toggleNotificationsPanelCaret"),

  recordsTbody: document.getElementById("recordsTbody"),
  recordsStatus: document.getElementById("recordsStatus"),
  recordsContext: document.getElementById("recordsContext"),
  recordsType: document.getElementById("recordsType"),
  recordsSearchBtn: document.getElementById("recordsSearchBtn"),

  receiptsTbody: document.getElementById("receiptsTbody"),
  receiptsStatus: document.getElementById("receiptsStatus"),

  budgetsTbody: document.getElementById("budgetsTbody"),
  budgetsStatus: document.getElementById("budgetsStatus"),

  settingsPanel: document.getElementById("settingsPanel"),
  settingsPanelBody: document.getElementById("settingsPanelBody"),
  toggleSettingsPanelCaret: document.getElementById("toggleSettingsPanelCaret"),
  settingsForm: document.getElementById("settingsForm"),
  appNameInput: document.getElementById("appNameInput"),
  receiptKeepFilesInput: document.getElementById("receiptKeepFilesInput"),
  sessionTimeoutMinutesInput: document.getElementById("sessionTimeoutMinutesInput"),
  achievementKeyInput: document.getElementById("achievementKeyInput"),
  achievementKeyStatus: document.getElementById("achievementKeyStatus"),
  achievementTitleInput: document.getElementById("achievementTitleInput"),
  achievementDescriptionInput: document.getElementById("achievementDescriptionInput"),
  achievementIconInput: document.getElementById("achievementIconInput"),
  achievementMetricInput: document.getElementById("achievementMetricInput"),
  achievementTargetInput: document.getElementById("achievementTargetInput"),
  achievementTargetBooleanInput: document.getElementById("achievementTargetBooleanInput"),
  achievementTargetNumberWrap: document.getElementById("achievementTargetNumberWrap"),
  achievementTargetBooleanWrap: document.getElementById("achievementTargetBooleanWrap"),
  addAchievementBtn: document.getElementById("addAchievementBtn"),
  adminAchievementsList: document.getElementById("adminAchievementsList"),
  achievementStatus: document.getElementById("achievementStatus"),
  notificationEditor: document.getElementById("notificationEditor"),
  notificationTypeInput: document.getElementById("notificationTypeInput"),
  publishNotificationBtn: document.getElementById("publishNotificationBtn"),
  notificationHistoryList: document.getElementById("notificationHistoryList"),
  notificationAdminStatus: document.getElementById("notificationAdminStatus"),
  settingsStatus: document.getElementById("settingsStatus"),

  userModal: document.getElementById("adminUserModal"),
  userForm: document.getElementById("adminUserForm"),
  userId: document.getElementById("adminUserId"),
  userFullName: document.getElementById("adminUserFullName"),
  userEmail: document.getElementById("adminUserEmail"),
  userUsername: document.getElementById("adminUserUsername"),
  userRole: document.getElementById("adminUserRole"),
  userStatus: document.getElementById("adminUserStatus"),

  recordModal: document.getElementById("adminRecordModal"),
  recordForm: document.getElementById("adminRecordForm"),
  recordId: document.getElementById("adminRecordId"),
  recordDate: document.getElementById("adminRecordDate"),
  recordType: document.getElementById("adminRecordType"),
  recordCategory: document.getElementById("adminRecordCategory"),
  recordAmount: document.getElementById("adminRecordAmount"),
  recordNote: document.getElementById("adminRecordNote"),
  recordStatus: document.getElementById("adminRecordStatus"),
};

const state = {
  selectedUserId: "",
  selectedUser: null,
  usersQuery: "",
  usersPage: 1,
  usersPageSize: 10,
  usersTotal: 0,
  userOptions: [],
  users: [],
  records: [],
  receipts: [],
  budgetSheets: [],
  settingsAchievements: [],
  notificationsHistory: [],
  sorts: {
    users: { key: "", dir: "" },
    records: { key: "", dir: "" },
  },
};

const ACHIEVEMENT_METRICS = new Set([
  "records_total",
  "records_income",
  "records_expense",
  "receipts_total",
  "budgets_total",
  "net_worth_items",
  "account_age_years",
  "two_fa_enabled",
  "google_signin_enabled",
  "avatar_selected",
]);
const BOOLEAN_ACHIEVEMENT_METRICS = new Set([
  "two_fa_enabled",
  "google_signin_enabled",
  "avatar_selected",
]);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(el, message, variant = "info") {
  if (!el) return;
  el.textContent = message;
  el.classList.remove("is-hidden", "is-error", "is-ok");
  if (variant === "error") el.classList.add("is-error");
  if (variant === "ok") el.classList.add("is-ok");
  if (!message) el.classList.add("is-hidden");
}

function setText(el, value) {
  if (!el) return;
  el.textContent = String(value ?? "");
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");
}

function bindModalClose() {
  document.addEventListener("click", (event) => {
    const closeBtn = event.target.closest("[data-close-modal]");
    if (closeBtn) {
      closeModal(closeBtn.closest(".modal"));
      return;
    }

    if (event.target.classList.contains("modal")) {
      closeModal(event.target);
    }
  });
}

async function ensureAdmin() {
  try {
    const { user } = await api.auth.me();
    if (user?.role !== "admin") {
      window.location.href = "home.html";
      return false;
    }
    return true;
  } catch {
    window.location.href = "login.html";
    return false;
  }
}

function formatDate(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function formatNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(Number.isFinite(num) ? num : 0);
}

function getUserLabel(user) {
  return user?.display_name || user?.full_name || user?.fullName || user?.username || user?.email || user?.id;
}

function toggleUserDataSections(show) {
  if (!els.userDataSections) return;
  els.userDataSections.classList.toggle("is-hidden", !show);
}

function setUsersPanelCollapsed(collapsed) {
  if (!els.usersPanel) return;
  els.usersPanel.classList.toggle("is-collapsed", collapsed);
  if (els.usersPanelBody) {
    els.usersPanelBody.hidden = collapsed;
  }
  if (els.toggleUsersPanelCaret) {
    els.toggleUsersPanelCaret.textContent = collapsed ? ">" : "v";
    els.toggleUsersPanelCaret.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.toggleUsersPanelCaret.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} Users section`
    );
  }
}

function setAchievementsPanelCollapsed(collapsed) {
  if (!els.achievementsPanel) return;
  els.achievementsPanel.classList.toggle("is-collapsed", collapsed);
  if (els.achievementsPanelBody) {
    els.achievementsPanelBody.hidden = collapsed;
  }
  if (els.toggleAchievementsPanelCaret) {
    els.toggleAchievementsPanelCaret.textContent = collapsed ? ">" : "v";
    els.toggleAchievementsPanelCaret.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.toggleAchievementsPanelCaret.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} Achievements section`
    );
  }
}

function setSettingsPanelCollapsed(collapsed) {
  if (!els.settingsPanel) return;
  els.settingsPanel.classList.toggle("is-collapsed", collapsed);
  if (els.settingsPanelBody) {
    els.settingsPanelBody.hidden = collapsed;
  }
  if (els.toggleSettingsPanelCaret) {
    els.toggleSettingsPanelCaret.textContent = collapsed ? ">" : "v";
    els.toggleSettingsPanelCaret.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.toggleSettingsPanelCaret.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} App Settings section`
    );
  }
}

function setNotificationsPanelCollapsed(collapsed) {
  if (!els.notificationsPanel) return;
  els.notificationsPanel.classList.toggle("is-collapsed", collapsed);
  if (els.notificationsPanelBody) {
    els.notificationsPanelBody.hidden = collapsed;
  }
  if (els.toggleNotificationsPanelCaret) {
    els.toggleNotificationsPanelCaret.textContent = collapsed ? ">" : "v";
    els.toggleNotificationsPanelCaret.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.toggleNotificationsPanelCaret.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} Notifications section`
    );
  }
}

function getSortableValue(table, row, key) {
  if (table === "users") {
    if (key === "name") return normalizeText(row.full_name || row.fullName || row.username || "");
    if (key === "email") return normalizeText(row.email);
    if (key === "role") return normalizeText(row.role);
    if (key === "created") return new Date(row.created_at || row.createdAt || 0).getTime() || 0;
  }

  if (table === "records") {
    if (key === "date") return new Date(row.date || 0).getTime() || 0;
    if (key === "userName") {
      return normalizeText(row.user_name || row.full_name || row.username || row.email || row.user_id);
    }
    if (key === "type") return normalizeText(row.type);
    if (key === "category") return normalizeText(row.category);
    if (key === "amount") return Number(row.amount || 0);
  }

  return "";
}

function sortRows(table, rows) {
  const cfg = state.sorts[table];
  if (!cfg?.key || !cfg?.dir) return rows;

  const dir = cfg.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = getSortableValue(table, a, cfg.key);
    const bv = getSortableValue(table, b, cfg.key);

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function updateSortArrows() {
  document.querySelectorAll(".sort-arrow[data-arrow-for]").forEach((el) => {
    const token = el.getAttribute("data-arrow-for") || "";
    const [table, key] = token.split(":");
    const cfg = state.sorts[table];
    if (!cfg || cfg.key !== key) {
      el.textContent = "↕";
      return;
    }
    el.textContent = cfg.dir === "asc" ? "↑" : "↓";
  });
}

function toggleSort(table, key) {
  const cfg = state.sorts[table];
  if (!cfg) return;

  if (cfg.key !== key) {
    cfg.key = key;
    cfg.dir = "asc";
  } else {
    cfg.dir = cfg.dir === "asc" ? "desc" : "asc";
  }

  updateSortArrows();
  if (table === "users") renderUsers();
  if (table === "records") renderRecords();
}

function getUsersTotalPages() {
  const total = Math.max(0, Number(state.usersTotal) || 0);
  return Math.max(1, Math.ceil(total / state.usersPageSize));
}

function renderUsersPager() {
  const totalPages = getUsersTotalPages();
  if (els.usersPageInfo) {
    els.usersPageInfo.textContent = `Page ${state.usersPage} of ${totalPages}`;
  }
  if (els.usersPrevPage) {
    els.usersPrevPage.disabled = state.usersPage <= 1;
  }
  if (els.usersNextPage) {
    els.usersNextPage.disabled = state.usersPage >= totalPages || state.usersTotal === 0;
  }
}

function renderUsers() {
  if (!els.usersTbody) return;
  const rows = sortRows("users", state.users);
  if (!rows.length) {
    const message = state.usersQuery ? "No users found." : "No users available.";
    els.usersTbody.innerHTML = `<tr><td colspan="5" class="subtle">${message}</td></tr>`;
    renderUsersPager();
    return;
  }

  els.usersTbody.innerHTML = rows
    .map(
      (user) => `
        <tr>
          <td>${getUserLabel(user)}</td>
          <td>${user.email || "—"}</td>
          <td>${user.role || "user"}</td>
          <td>${formatDate(user.created_at || user.createdAt)}</td>
          <td>
            <button class="btn btn--link" data-action="view-user" data-id="${user.id}">View Data</button>
            <button class="btn btn--link" data-action="edit-user" data-id="${user.id}">Edit</button>
          </td>
        </tr>
      `
    )
    .join("");
  renderUsersPager();
}

function renderUserOptions() {
  if (!els.userOptions) return;
  els.userOptions.innerHTML = state.userOptions
    .map((user) => {
      const value = getUserLabel(user);
      return `<option value="${value}"></option>`;
    })
    .join("");
}

function updateRecordsContext() {
  if (!els.recordsContext) return;
  const user = state.selectedUser;
  if (!user) {
    els.recordsContext.textContent = "Search for a user to view records.";
    return;
  }
  els.recordsContext.textContent = `Showing records for ${getUserLabel(user)}.`;
}

function renderRecords() {
  if (!els.recordsTbody) return;
  const rows = sortRows("records", state.records);
  if (!rows.length) {
    const message = state.selectedUserId
      ? "No records found for this user."
      : "Search and select a user to view records.";
    els.recordsTbody.innerHTML = `<tr><td colspan="6" class="subtle">${message}</td></tr>`;
    return;
  }

  els.recordsTbody.innerHTML = rows
    .map(
      (record) => `
        <tr>
          <td>${formatDate(record.date)}</td>
          <td>${record.user_name || record.full_name || record.username || record.email || record.user_id}</td>
          <td>${record.type}</td>
          <td>${record.category || "—"}</td>
          <td class="num">${Number(record.amount || 0).toFixed(2)}</td>
          <td>
            <button class="btn btn--link" data-action="edit-record" data-id="${record.id}">Edit</button>
            <button class="btn btn--link" data-action="delete-record" data-id="${record.id}">Delete</button>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderReceipts() {
  if (!els.receiptsTbody) return;
  if (!state.receipts.length) {
    els.receiptsTbody.innerHTML = `<tr><td colspan="4" class="subtle">No receipts found for this user.</td></tr>`;
    return;
  }

  els.receiptsTbody.innerHTML = state.receipts
    .map((receipt) => {
      const source =
        receipt.source ||
        receipt.parsed_data?.source ||
        receipt.original_filename ||
        receipt.object_key ||
        "—";
      const status = receipt.processing_status || "processed";
      return `
        <tr>
          <td>${formatDate(receipt.created_at || receipt.date_added || receipt.updated_at)}</td>
          <td>${source}</td>
          <td>${status}</td>
          <td class="num">${Number(receipt.amount || 0).toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderBudgetSheets() {
  if (!els.budgetsTbody) return;
  if (!state.budgetSheets.length) {
    els.budgetsTbody.innerHTML = `<tr><td colspan="4" class="subtle">No budget sheets found for this user.</td></tr>`;
    return;
  }

  els.budgetsTbody.innerHTML = state.budgetSheets
    .map(
      (sheet) => `
        <tr>
          <td>${sheet.cadence || "—"}</td>
          <td>${sheet.period || "—"}</td>
          <td>${formatDate(sheet.created_at)}</td>
          <td>${formatDate(sheet.updated_at)}</td>
        </tr>
      `
    )
    .join("");
}

function resetUserScopedData() {
  state.selectedUserId = "";
  state.selectedUser = null;
  state.records = [];
  state.receipts = [];
  state.budgetSheets = [];
  toggleUserDataSections(false);
  updateRecordsContext();
  renderRecords();
  renderReceipts();
  renderBudgetSheets();
}

function normalizeAchievementKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
}

function updateAchievementKeyValidation() {
  const raw = els.achievementKeyInput?.value || "";
  const key = normalizeAchievementKey(raw);
  const isTaken = Boolean(key) && state.settingsAchievements.some((item) => item.key === key);

  if (els.achievementKeyInput) {
    els.achievementKeyInput.classList.toggle("is-invalid", isTaken);
  }
  if (els.achievementKeyStatus) {
    if (isTaken) {
      els.achievementKeyStatus.textContent = "Key is taken";
      els.achievementKeyStatus.classList.remove("is-hidden");
      els.achievementKeyStatus.classList.add("is-error");
    } else {
      els.achievementKeyStatus.textContent = "";
      els.achievementKeyStatus.classList.add("is-hidden");
      els.achievementKeyStatus.classList.remove("is-error");
    }
  }

  return { key, isTaken };
}

function isBooleanAchievementMetric(metric) {
  return BOOLEAN_ACHIEVEMENT_METRICS.has(String(metric || "").trim());
}

function syncAchievementTargetInput() {
  const metric = String(els.achievementMetricInput?.value || "").trim();
  const isBoolean = isBooleanAchievementMetric(metric);
  if (els.achievementTargetNumberWrap) {
    els.achievementTargetNumberWrap.classList.toggle("is-hidden", isBoolean);
  }
  if (els.achievementTargetBooleanWrap) {
    els.achievementTargetBooleanWrap.classList.toggle("is-hidden", !isBoolean);
  }
}

function renderSettingsAchievements() {
  if (!els.adminAchievementsList) return;
  if (!state.settingsAchievements.length) {
    els.adminAchievementsList.innerHTML =
      '<p class="subtle">No achievements configured. Add one above, then save settings.</p>';
    return;
  }

  const groupedByMetric = new Map();
  for (const item of state.settingsAchievements) {
    const metric = String(item.metric || "").trim() || "unknown_metric";
    if (!groupedByMetric.has(metric)) groupedByMetric.set(metric, []);
    groupedByMetric.get(metric).push(item);
  }

  const targetRank = (target) => {
    if (typeof target === "number") return target;
    if (typeof target === "boolean") return target ? 1 : 0;
    return Number.NaN;
  };

  const renderAchievementCard = (item) => `
    <div class="admin-achievement-item">
      <button
        class="admin-achievement-remove"
        data-action="remove-achievement"
        data-key="${escapeHtml(item.key)}"
        type="button"
        aria-label="Remove achievement ${escapeHtml(item.title || item.key)}"
        title="Remove achievement"
      >
        X
      </button>
      <div>
        <strong>${escapeHtml(item.icon || "🏆")} ${escapeHtml(item.title)}</strong>
        <p class="meta">${escapeHtml(item.key)} • ${escapeHtml(item.metric)} • target ${escapeHtml(String(item.target))}</p>
        <p class="meta">${escapeHtml(item.description)}</p>
      </div>
    </div>
  `;

  const metricGroups = [...groupedByMetric.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([metric, items]) => {
      const isBooleanMetric = isBooleanAchievementMetric(metric);
      const visibleItems = isBooleanMetric
        ? items.filter((item) => item.target === true)
        : items;
      const sortedItems = [...visibleItems].sort((a, b) => {
        const aRank = targetRank(a.target);
        const bRank = targetRank(b.target);
        if (Number.isFinite(aRank) && Number.isFinite(bRank) && aRank !== bRank) {
          return aRank - bRank;
        }
        return String(a.target).localeCompare(String(b.target));
      });
      if (!sortedItems.length) return null;

      const cardsHtml = `
        <div class="admin-achievement-metric-grid">
          ${sortedItems.map(renderAchievementCard).join("")}
        </div>
      `;

      return {
        isBooleanMetric,
        html: `
        <section class="admin-achievement-metric-group ${isBooleanMetric ? "admin-achievement-metric-group--boolean" : ""}">
          <h3 class="admin-achievement-metric-title">${escapeHtml(metric)}</h3>
          ${cardsHtml}
        </section>
      `,
      };
    })
    .filter(Boolean);

  const nonBooleanGroupsHtml = metricGroups
    .filter((group) => !group.isBooleanMetric)
    .map((group) => group.html)
    .join("");
  const booleanGroupsHtml = metricGroups
    .filter((group) => group.isBooleanMetric)
    .map((group) => group.html)
    .join("");

  els.adminAchievementsList.innerHTML = `
    ${nonBooleanGroupsHtml}
    ${booleanGroupsHtml ? `<div class="admin-achievement-boolean-metrics">${booleanGroupsHtml}</div>` : ""}
  `;
}

function extractNotificationTextFromHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  return String(container.textContent || "").trim();
}

function renderNotificationHistory() {
  if (!els.notificationHistoryList) return;
  if (!state.notificationsHistory.length) {
    els.notificationHistoryList.innerHTML = '<p class="subtle">No notifications yet.</p>';
    return;
  }

  els.notificationHistoryList.innerHTML = state.notificationsHistory
    .map((item) => {
      const html = String(item.message_html || "").trim();
      const fallback = escapeHtml(String(item.message_text || "").trim());
      const content = html || fallback;
      const creator = escapeHtml(String(item.created_by_username || "admin"));
      const createdAt = escapeHtml(formatDateTime(item.created_at));
      const type = escapeHtml(String(item.notification_type || "general"));
      return `
        <article class="admin-notification-item">
          <div class="admin-notification-meta">${createdAt} • ${type} • by ${creator}</div>
          <p>${content}</p>
        </article>
      `;
    })
    .join("");
}

async function loadNotificationHistory() {
  if (!els.notificationHistoryList) return;
  try {
    const { notifications } = await api.admin.listNotifications();
    state.notificationsHistory = Array.isArray(notifications) ? notifications : [];
    renderNotificationHistory();
  } catch (err) {
    console.error(err);
    els.notificationHistoryList.innerHTML = `<p class="subtle">${escapeHtml(err.message || "Failed to load notifications.")}</p>`;
  }
}

async function publishNotificationFromEditor() {
  const html = String(els.notificationEditor?.innerHTML || "").trim();
  const text = extractNotificationTextFromHtml(html);
  const notificationType = String(els.notificationTypeInput?.value || "general").trim().toLowerCase();
  if (!text) {
    setStatus(els.notificationAdminStatus, "Notification text is required.", "error");
    return;
  }
  if (!["security", "general", "updates"].includes(notificationType)) {
    setStatus(els.notificationAdminStatus, "Notification type is invalid.", "error");
    return;
  }

  if (els.publishNotificationBtn) {
    els.publishNotificationBtn.disabled = true;
  }
  setStatus(els.notificationAdminStatus, "Publishing notification...");
  try {
    await api.admin.createNotification({ messageHtml: html, notificationType });
    if (els.notificationEditor) {
      els.notificationEditor.innerHTML = "";
    }
    if (els.notificationTypeInput) {
      els.notificationTypeInput.value = "general";
    }
    await loadNotificationHistory();
    setStatus(els.notificationAdminStatus, "Notification published.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(els.notificationAdminStatus, err.message || "Failed to publish notification.", "error");
  } finally {
    if (els.publishNotificationBtn) {
      els.publishNotificationBtn.disabled = false;
    }
  }
}

async function persistAchievementsCatalog(nextCatalog, successMessage) {
  const previousCatalog = state.settingsAchievements;
  if (!Array.isArray(nextCatalog) || !nextCatalog.length) {
    setStatus(els.achievementStatus, "At least one achievement is required.", "error");
    return false;
  }

  state.settingsAchievements = nextCatalog;
  renderSettingsAchievements();
  updateAchievementKeyValidation();
  setStatus(els.achievementStatus, "Saving achievements...");

  try {
    const { settings } = await api.admin.updateSettings({ achievementsCatalog: nextCatalog });
    state.settingsAchievements = Array.isArray(settings?.achievements_catalog)
      ? settings.achievements_catalog
      : nextCatalog;
    renderSettingsAchievements();
    updateAchievementKeyValidation();
    setStatus(els.achievementStatus, successMessage, "ok");
    return true;
  } catch (err) {
    console.error(err);
    state.settingsAchievements = previousCatalog;
    renderSettingsAchievements();
    updateAchievementKeyValidation();
    setStatus(els.achievementStatus, err.message || "Failed to save achievements.", "error");
    return false;
  }
}

async function addAchievementFromInputs() {
  const keyCheck = updateAchievementKeyValidation();
  const key = keyCheck.key;
  const title = String(els.achievementTitleInput?.value || "").trim();
  const description = String(els.achievementDescriptionInput?.value || "").trim();
  const icon = String(els.achievementIconInput?.value || "🏆").trim() || "🏆";
  const metric = String(els.achievementMetricInput?.value || "").trim();
  const isBoolean = isBooleanAchievementMetric(metric);
  const target = isBoolean
    ? true
    : Number(els.achievementTargetInput?.value || 0);

  const hasValidTarget = isBoolean
    ? typeof target === "boolean"
    : Number.isFinite(target) && target > 0;
  if (!key || !title || !description || !ACHIEVEMENT_METRICS.has(metric) || !hasValidTarget) {
    setStatus(els.achievementStatus, "Fill all achievement fields with valid values.", "error");
    return;
  }

  if (keyCheck.isTaken || state.settingsAchievements.some((item) => item.key === key)) {
    setStatus(els.achievementStatus, `Achievement key "${key}" already exists.`, "error");
    return;
  }

  const nextCatalog = [...state.settingsAchievements, {
    key,
    title,
    description,
    icon,
    metric,
    target,
  }];

  const saved = await persistAchievementsCatalog(nextCatalog, "Achievement added.");
  if (!saved) return;

  if (els.achievementKeyInput) els.achievementKeyInput.value = "";
  if (els.achievementTitleInput) els.achievementTitleInput.value = "";
  if (els.achievementDescriptionInput) els.achievementDescriptionInput.value = "";
  if (els.achievementIconInput) els.achievementIconInput.value = "";
  if (els.achievementTargetInput) els.achievementTargetInput.value = "1";
  if (els.achievementTargetBooleanInput) els.achievementTargetBooleanInput.value = "true";
  if (els.achievementKeyStatus) {
    els.achievementKeyStatus.textContent = "";
    els.achievementKeyStatus.classList.add("is-hidden");
    els.achievementKeyStatus.classList.remove("is-error");
  }
  if (els.achievementKeyInput) {
    els.achievementKeyInput.classList.remove("is-invalid");
  }
  syncAchievementTargetInput();
}

function resolveUserForQuery(users, query) {
  const normalized = normalizeText(query);
  if (!normalized) return users.length === 1 ? users[0] : null;

  const exact = users.find((user) => {
    const display = normalizeText(getUserLabel(user));
    return (
      normalizeText(user.username) === normalized ||
      normalizeText(user.email) === normalized ||
      normalizeText(user.full_name || user.fullName || "") === normalized ||
      display === normalized
    );
  });
  return exact || (users.length === 1 ? users[0] : null);
}

async function loadStats() {
  try {
    const { stats } = await api.admin.getStats();
    setText(els.statsUsers, formatNumber(stats?.total_users));
    setText(els.statsRecords, formatNumber(stats?.total_records));
    setText(els.statsReceipts, formatNumber(stats?.total_receipts));
    setStatus(els.statsStatus, "");
  } catch (err) {
    console.error(err);
    setStatus(els.statsStatus, err.message || "Failed to load overview stats.", "error");
  }
}

async function loadUserOptions() {
  try {
    const { users } = await api.admin.listUserOptions();
    state.userOptions = users || [];
    renderUserOptions();
  } catch (err) {
    console.error(err);
    setStatus(els.usersStatus, err.message || "Failed to load user dropdown options.", "error");
  }
}

function findUserFromSearchInput(raw) {
  const normalized = normalizeText(raw);
  if (!normalized) return null;
  return (
    state.userOptions.find((user) => {
      return (
        normalizeText(user.username) === normalized ||
        normalizeText(user.email) === normalized ||
        normalizeText(getUserLabel(user)) === normalized
      );
    }) || null
  );
}

async function loadUsers({ resetPage = false, evaluateSelection = true } = {}) {
  const q = els.userSearch?.value?.trim() || "";
  if (resetPage) {
    state.usersPage = 1;
  }
  state.usersQuery = q;

  const offset = (state.usersPage - 1) * state.usersPageSize;
  setStatus(els.usersStatus, q ? "Searching users..." : "Loading users...");

  try {
    const { users, total } = await api.admin.listUsers({
      q,
      limit: state.usersPageSize,
      offset,
    });
    state.users = users || [];
    state.usersTotal = Number(total || 0);
    renderUsers();

    if (!state.users.length) {
      setStatus(els.usersStatus, q ? "No users found." : "No users available.", "error");
      if (evaluateSelection) {
        resetUserScopedData();
      }
      return;
    }

    if (!q) {
      setStatus(els.usersStatus, "");
      return;
    }

    if (!evaluateSelection) {
      setStatus(els.usersStatus, `Found ${state.usersTotal} user(s).`);
      return;
    }

    const optionMatch = findUserFromSearchInput(q);
    const targetUser = optionMatch || resolveUserForQuery(state.users, q);
    if (targetUser) {
      await loadUserDataForUser(targetUser);
      setStatus(els.usersStatus, `Found ${state.usersTotal} user(s).`);
    } else {
      resetUserScopedData();
      setStatus(els.usersStatus, "Multiple users matched. Select one with View Data.");
    }
  } catch (err) {
    console.error(err);
    state.users = [];
    state.usersTotal = 0;
    renderUsers();
    if (evaluateSelection) {
      resetUserScopedData();
    }
    setStatus(els.usersStatus, err.message || "Failed to load users.", "error");
  }
}

function openUserModal(user) {
  if (!user) return;
  els.userId.value = user.id;
  els.userFullName.value = user.full_name || user.fullName || "";
  els.userEmail.value = user.email || "";
  els.userUsername.value = user.username || "";
  els.userRole.value = user.role || "user";
  setStatus(els.userStatus, "");
  openModal(els.userModal);
}

async function saveUser(event) {
  event.preventDefault();
  const id = els.userId.value;
  if (!id) return;

  setStatus(els.userStatus, "Saving user...");
  try {
    await api.admin.updateUser(id, {
      fullName: els.userFullName.value,
      email: els.userEmail.value,
      username: els.userUsername.value,
      role: els.userRole.value,
    });
    setStatus(els.userStatus, "User updated.", "ok");
    await Promise.all([loadUsers(), loadUserOptions(), loadStats()]);
    closeModal(els.userModal);
  } catch (err) {
    console.error(err);
    setStatus(els.userStatus, err.message || "Failed to update user.", "error");
  }
}

async function loadRecords() {
  if (!state.selectedUserId) {
    state.records = [];
    renderRecords();
    return;
  }

  setStatus(els.recordsStatus, "Loading records...");
  try {
    const type = els.recordsType?.value || "";
    const params = { limit: 100, offset: 0, userId: state.selectedUserId };
    if (type) params.type = type;

    const { records } = await api.admin.listRecords(params);
    state.records = records || [];
    renderRecords();
    setStatus(els.recordsStatus, "");
  } catch (err) {
    console.error(err);
    setStatus(els.recordsStatus, err.message || "Failed to load records.", "error");
  }
}

async function loadReceipts() {
  if (!state.selectedUserId) {
    state.receipts = [];
    renderReceipts();
    return;
  }

  setStatus(els.receiptsStatus, "Loading receipts...");
  try {
    const { receipts } = await api.admin.listReceipts({
      userId: state.selectedUserId,
      limit: 100,
      offset: 0,
    });
    state.receipts = receipts || [];
    renderReceipts();
    setStatus(els.receiptsStatus, "");
  } catch (err) {
    console.error(err);
    setStatus(els.receiptsStatus, err.message || "Failed to load receipts.", "error");
  }
}

async function loadBudgetSheets() {
  if (!state.selectedUserId) {
    state.budgetSheets = [];
    renderBudgetSheets();
    return;
  }

  setStatus(els.budgetsStatus, "Loading budgets...");
  try {
    const { budgetSheets } = await api.admin.listBudgetSheets({
      userId: state.selectedUserId,
      limit: 100,
    });
    state.budgetSheets = budgetSheets || [];
    renderBudgetSheets();
    setStatus(els.budgetsStatus, "");
  } catch (err) {
    console.error(err);
    setStatus(els.budgetsStatus, err.message || "Failed to load budgets.", "error");
  }
}

async function loadUserDataForUser(user) {
  if (!user?.id) {
    resetUserScopedData();
    return;
  }

  state.selectedUserId = user.id;
  state.selectedUser = user;
  toggleUserDataSections(true);
  updateRecordsContext();
  await Promise.all([loadRecords(), loadReceipts(), loadBudgetSheets()]);
}

function openRecordModal(record) {
  if (!record) return;
  els.recordId.value = record.id;
  els.recordDate.value = formatDate(record.date) === "—" ? "" : formatDate(record.date);
  els.recordType.value = record.type || "expense";
  els.recordCategory.value = record.category || "";
  els.recordAmount.value = Number(record.amount || 0);
  els.recordNote.value = record.note || "";
  setStatus(els.recordStatus, "");
  openModal(els.recordModal);
}

async function saveRecord(event) {
  event.preventDefault();
  const id = els.recordId.value;
  if (!id) return;

  setStatus(els.recordStatus, "Saving record...");
  try {
    await api.admin.updateRecord(id, {
      date: els.recordDate.value,
      type: els.recordType.value,
      category: els.recordCategory.value,
      amount: els.recordAmount.value,
      note: els.recordNote.value,
    });
    setStatus(els.recordStatus, "Record updated.", "ok");
    await loadRecords();
    closeModal(els.recordModal);
  } catch (err) {
    console.error(err);
    setStatus(els.recordStatus, err.message || "Failed to update record.", "error");
  }
}

async function deleteRecord(id) {
  if (!id) return;
  const ok = window.confirm("Delete this record?");
  if (!ok) return;
  const deleteReceipt = window.confirm("Also delete the linked receipt (if any)?");

  setStatus(els.recordsStatus, "Deleting record...");
  try {
    await api.admin.deleteRecord(id, deleteReceipt);
    await Promise.all([loadRecords(), loadReceipts(), loadStats()]);
    setStatus(els.recordsStatus, "Record deleted.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(els.recordsStatus, err.message || "Failed to delete record.", "error");
  }
}

async function loadSettings() {
  setStatus(els.settingsStatus, "");
  try {
    const { settings } = await api.admin.getSettings();
    if (els.appNameInput) {
      els.appNameInput.value = settings?.app_name || settings?.appName || "<AppName>";
    }
    if (els.receiptKeepFilesInput) {
      const keep = settings?.receipt_keep_files;
      els.receiptKeepFilesInput.checked = typeof keep === "boolean" ? keep : true;
    }
    if (els.sessionTimeoutMinutesInput) {
      const timeout = Number(settings?.session_timeout_minutes);
      els.sessionTimeoutMinutesInput.value = String(
        Number.isFinite(timeout) && timeout >= 1 && timeout <= 60 ? timeout : 15
      );
    }
    state.settingsAchievements = Array.isArray(settings?.achievements_catalog)
      ? settings.achievements_catalog
      : [];
    renderSettingsAchievements();
    updateAchievementKeyValidation();
  } catch (err) {
    console.error(err);
    setStatus(els.settingsStatus, err.message || "Failed to load settings.", "error");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const appName = els.appNameInput?.value?.trim();
  if (!appName) {
    setStatus(els.settingsStatus, "App name is required.", "error");
    return;
  }
  const timeout = Number(els.sessionTimeoutMinutesInput?.value || 0);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60) {
    setStatus(els.settingsStatus, "Session timeout must be an integer between 1 and 60.", "error");
    return;
  }

  setStatus(els.settingsStatus, "Saving settings...");
  try {
    await api.admin.updateSettings({
      appName,
      receiptKeepFiles: Boolean(els.receiptKeepFilesInput?.checked),
      sessionTimeoutMinutes: timeout,
      achievementsCatalog: state.settingsAchievements,
    });
    sessionStorage.setItem("appName", appName);
    localStorage.setItem("sessionTimeoutMinutes", String(timeout));
    window.dispatchEvent(new CustomEvent("appName:updated", { detail: { appName } }));
    setStatus(els.settingsStatus, "Settings updated.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(els.settingsStatus, err.message || "Failed to update settings.", "error");
  }
}

function tryOpenUserDropdown() {
  if (!els.userSearch) return;
  if (typeof els.userSearch.showPicker === "function") {
    try {
      els.userSearch.showPicker();
    } catch {
      // no-op
    }
  }
}

function clearSelectedUserPanels() {
  if (els.userSearch) {
    els.userSearch.value = "";
  }
  resetUserScopedData();
  setStatus(els.usersStatus, "");
}

function bindEvents() {
  document.querySelectorAll(".admin-sort-btn[data-table][data-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleSort(btn.dataset.table, btn.dataset.key);
    });
  });

  if (els.userSearchBtn) {
    els.userSearchBtn.addEventListener("click", () => {
      loadUsers({ resetPage: true, evaluateSelection: true });
    });
  }

  if (els.userClearBtn) {
    els.userClearBtn.addEventListener("click", () => {
      clearSelectedUserPanels();
      loadUsers({ resetPage: true, evaluateSelection: false });
    });
  }

  if (els.userSearch) {
    els.userSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadUsers({ resetPage: true, evaluateSelection: true });
      }
    });

    els.userSearch.addEventListener("change", () => {
      loadUsers({ resetPage: true, evaluateSelection: true });
    });

    els.userSearch.addEventListener("click", tryOpenUserDropdown);
    els.userSearch.addEventListener("focus", tryOpenUserDropdown);
  }

  if (els.recordsSearchBtn) {
    els.recordsSearchBtn.addEventListener("click", loadRecords);
  }

  if (els.usersPrevPage) {
    els.usersPrevPage.addEventListener("click", () => {
      if (state.usersPage <= 1) return;
      state.usersPage -= 1;
      loadUsers({ resetPage: false, evaluateSelection: false });
    });
  }

  if (els.usersNextPage) {
    els.usersNextPage.addEventListener("click", () => {
      if (state.usersPage >= getUsersTotalPages()) return;
      state.usersPage += 1;
      loadUsers({ resetPage: false, evaluateSelection: false });
    });
  }

  if (els.recordsType) {
    els.recordsType.addEventListener("change", loadRecords);
  }

  if (els.userForm) {
    els.userForm.addEventListener("submit", saveUser);
  }

  if (els.recordForm) {
    els.recordForm.addEventListener("submit", saveRecord);
  }

  if (els.settingsForm) {
    els.settingsForm.addEventListener("submit", saveSettings);
  }
  if (els.toggleUsersPanelCaret) {
    els.toggleUsersPanelCaret.addEventListener("click", () => {
      const collapsed = els.usersPanel?.classList.contains("is-collapsed");
      setUsersPanelCollapsed(!collapsed);
    });
  }
  if (els.toggleAchievementsPanelCaret) {
    els.toggleAchievementsPanelCaret.addEventListener("click", () => {
      const collapsed = els.achievementsPanel?.classList.contains("is-collapsed");
      setAchievementsPanelCollapsed(!collapsed);
    });
  }
  if (els.toggleSettingsPanelCaret) {
    els.toggleSettingsPanelCaret.addEventListener("click", () => {
      const collapsed = els.settingsPanel?.classList.contains("is-collapsed");
      setSettingsPanelCollapsed(!collapsed);
    });
  }
  if (els.toggleNotificationsPanelCaret) {
    els.toggleNotificationsPanelCaret.addEventListener("click", () => {
      const collapsed = els.notificationsPanel?.classList.contains("is-collapsed");
      setNotificationsPanelCollapsed(!collapsed);
    });
  }
  if (els.addAchievementBtn) {
    els.addAchievementBtn.addEventListener("click", addAchievementFromInputs);
  }
  if (els.achievementKeyInput) {
    els.achievementKeyInput.addEventListener("input", updateAchievementKeyValidation);
    els.achievementKeyInput.addEventListener("blur", updateAchievementKeyValidation);
  }
  if (els.achievementMetricInput) {
    els.achievementMetricInput.addEventListener("change", syncAchievementTargetInput);
  }
  if (els.publishNotificationBtn) {
    els.publishNotificationBtn.addEventListener("click", publishNotificationFromEditor);
  }
  document.querySelectorAll("button[data-notification-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = String(btn.dataset.notificationCmd || "").trim();
      if (!cmd || !els.notificationEditor) return;
      els.notificationEditor.focus();
      if (cmd === "createLink") {
        const url = window.prompt("Enter URL");
        if (url) document.execCommand("createLink", false, url);
        return;
      }
      document.execCommand(cmd, false, null);
    });
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const key = btn.dataset.key;

    if (action === "edit-user") {
      const user = state.users.find((u) => u.id === id);
      openUserModal(user);
    }

    if (action === "view-user") {
      const user = state.users.find((u) => u.id === id);
      loadUserDataForUser(user);
    }

    if (action === "edit-record") {
      const record = state.records.find((r) => r.id === id);
      openRecordModal(record);
    }

    if (action === "delete-record") {
      deleteRecord(id);
    }

    if (action === "remove-achievement") {
      const nextCatalog = state.settingsAchievements.filter((item) => item.key !== key);
      persistAchievementsCatalog(nextCatalog, "Achievement removed.");
    }
  });
}

async function init() {
  const ok = await ensureAdmin();
  if (!ok) return;
  bindModalClose();
  bindEvents();
  updateSortArrows();
  toggleUserDataSections(false);
  renderUsers();
  renderRecords();
  renderReceipts();
  renderBudgetSheets();
  renderUsersPager();
  setStatus(els.usersStatus, "");
  setStatus(els.recordsStatus, "");
  setStatus(els.receiptsStatus, "");
  setStatus(els.budgetsStatus, "");
  setStatus(els.achievementStatus, "");
  setStatus(els.notificationAdminStatus, "");
  updateRecordsContext();
  setUsersPanelCollapsed(true);
  setSettingsPanelCollapsed(true);
  setAchievementsPanelCollapsed(true);
  setNotificationsPanelCollapsed(true);
  syncAchievementTargetInput();

  await Promise.all([
    loadStats(),
    loadUserOptions(),
    loadSettings(),
    loadNotificationHistory(),
    loadUsers({ resetPage: true, evaluateSelection: false }),
  ]);
}

init();

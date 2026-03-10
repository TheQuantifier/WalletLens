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
  notificationFilterType: document.getElementById("notificationFilterType"),
  notificationFilterActive: document.getElementById("notificationFilterActive"),
  notificationFilterApplyBtn: document.getElementById("notificationFilterApplyBtn"),
  auditPanel: document.getElementById("auditPanel"),
  auditPanelBody: document.getElementById("auditPanelBody"),
  toggleAuditPanelCaret: document.getElementById("toggleAuditPanelCaret"),
  auditQueryInput: document.getElementById("auditQueryInput"),
  auditScopeInput: document.getElementById("auditScopeInput"),
  auditRefreshBtn: document.getElementById("auditRefreshBtn"),
  auditTbody: document.getElementById("auditTbody"),
  auditStatus: document.getElementById("auditStatus"),
  supportPanel: document.getElementById("supportPanel"),
  supportPanelBody: document.getElementById("supportPanelBody"),
  toggleSupportPanelCaret: document.getElementById("toggleSupportPanelCaret"),
  supportStatusFilter: document.getElementById("supportStatusFilter"),
  supportRefreshBtn: document.getElementById("supportRefreshBtn"),
  supportTbody: document.getElementById("supportTbody"),
  supportStatusMsg: document.getElementById("supportStatusMsg"),
  systemHealthPanel: document.getElementById("systemHealthPanel"),
  systemHealthPanelBody: document.getElementById("systemHealthPanelBody"),
  toggleSystemHealthPanelCaret: document.getElementById("toggleSystemHealthPanelCaret"),
  healthRefreshBtn: document.getElementById("healthRefreshBtn"),
  healthSummary: document.getElementById("healthSummary"),
  healthStatus: document.getElementById("healthStatus"),
  healthDisconnectModal: document.getElementById("adminHealthDisconnectModal"),
  healthDisconnectForm: document.getElementById("adminHealthDisconnectForm"),
  healthDisconnectTitle: document.getElementById("adminHealthDisconnectTitle"),
  healthDisconnectMessage: document.getElementById("adminHealthDisconnectMessage"),
  healthDisconnectCredentialLabel: document.getElementById("adminHealthDisconnectCredentialLabel"),
  healthDisconnectPassword: document.getElementById("adminHealthDisconnectPassword"),
  healthDisconnectBtn: document.getElementById("adminHealthDisconnectBtn"),
  healthDisconnectStatus: document.getElementById("adminHealthDisconnectStatus"),
  permissionsPanel: document.getElementById("permissionsPanel"),
  permissionsPanelBody: document.getElementById("permissionsPanelBody"),
  togglePermissionsPanelCaret: document.getElementById("togglePermissionsPanelCaret"),
  permissionsHeadRow: document.getElementById("permissionsHeadRow"),
  permissionsTbody: document.getElementById("permissionsTbody"),
  permissionsStatus: document.getElementById("permissionsStatus"),

  recordsTbody: document.getElementById("recordsTbody"),
  recordsPanel: document.getElementById("recordsPanel"),
  recordsStatus: document.getElementById("recordsStatus"),
  recordsContext: document.getElementById("recordsContext"),
  recordsType: document.getElementById("recordsType"),
  recordsSearchBtn: document.getElementById("recordsSearchBtn"),

  receiptsTbody: document.getElementById("receiptsTbody"),
  receiptsPanel: document.getElementById("receiptsPanel"),
  receiptsStatus: document.getElementById("receiptsStatus"),

  budgetsTbody: document.getElementById("budgetsTbody"),
  budgetsPanel: document.getElementById("budgetsPanel"),
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
  permissionModal: document.getElementById("adminPermissionModal"),
  permissionMessage: document.getElementById("adminPermissionMessage"),
};

const state = {
  currentUser: null,
  currentRole: "user",
  permissions: new Set(),
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
  auditLog: [],
  supportTickets: [],
  systemHealth: null,
  adminRolePermissions: {},
  savingPermissions: false,
  testingHealthServiceIds: new Set(),
  healthPassByService: {},
  healthConfirmAction: "",
  healthDisconnectServiceId: "",
  editingNotificationId: "",
  sorts: {
    users: { key: "", dir: "" },
    records: { key: "", dir: "" },
  },
};

const ROLE_PERMISSIONS = {
  admin: new Set([
    "users.read",
    "users.write",
    "records.read",
    "records.write",
    "settings.read",
    "settings.write",
    "notifications.read",
    "notifications.write",
    "support.read",
    "support.write",
    "audit.read",
    "health.read",
    "health.write",
  ]),
  support_admin: new Set([
    "users.read",
    "notifications.read",
    "notifications.write",
    "support.read",
    "support.write",
    "audit.read",
    "health.read",
  ]),
  analyst: new Set([
    "users.read",
    "records.read",
    "notifications.read",
    "support.read",
    "audit.read",
    "health.read",
  ]),
};
const PERMISSIONS_GRID_ORDER = [
  "users.read",
  "users.write",
  "records.read",
  "records.write",
  "settings.read",
  "settings.write",
  "notifications.read",
  "notifications.write",
  "support.read",
  "support.write",
  "audit.read",
  "health.read",
  "health.write",
];
const ADMIN_ROLES_FOR_GRID = ["user", "analyst", "support_admin"];

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

function openPermissionModal(requiredRole = "admin") {
  if (els.permissionMessage) {
    const roleText = String(requiredRole || "admin").trim();
    els.permissionMessage.textContent = `You must be ${roleText} admin type or higher to edit.`;
  }
  openModal(els.permissionModal);
}

function hasPermission(permission) {
  return state.permissions.has(permission);
}

function setElementVisible(el, visible) {
  if (!el) return;
  el.classList.toggle("is-hidden", !visible);
  el.hidden = !visible;
}

function setControlsDisabled(container, disabled) {
  if (!container) return;
  container.querySelectorAll("input, select, textarea, button, [contenteditable='true']").forEach((control) => {
    if (control instanceof HTMLElement && control.getAttribute("contenteditable") === "true") {
      control.setAttribute("contenteditable", disabled ? "false" : "true");
      return;
    }
    control.disabled = Boolean(disabled);
  });
}

function setReadOnlyBadge(panel, requiredRole, show) {
  if (!panel) return;
  const existing = panel.querySelector(".admin-readonly-badge");
  if (!show) {
    if (existing) existing.remove();
    return;
  }

  const tooltip = `You must be ${requiredRole} role or higher to edit.`;
  const badge = existing || document.createElement("span");
  badge.className = "admin-readonly-badge";
  badge.textContent = "Read only";
  badge.title = tooltip;
  badge.setAttribute("aria-label", tooltip);

  const titleAnchor =
    panel.querySelector(".admin-panel-title > div") ||
    panel.querySelector(".admin-panel-header > div");
  if (!titleAnchor) return;

  if (!existing) {
    titleAnchor.appendChild(badge);
  }
}

function applyPermissionVisibility() {
  const canUsersRead = hasPermission("users.read");
  const canUsersWrite = hasPermission("users.write");
  const canRecordsRead = hasPermission("records.read");
  const canRecordsWrite = hasPermission("records.write");
  const canSettingsRead = hasPermission("settings.read");
  const canSettingsWrite = hasPermission("settings.write");
  const canNotificationsRead = hasPermission("notifications.read");
  const canNotificationsWrite = hasPermission("notifications.write");
  const canAuditRead = hasPermission("audit.read");
  const canSupportRead = hasPermission("support.read");
  const canSupportWrite = hasPermission("support.write");
  const canHealthRead = hasPermission("health.read");
  const canHealthWrite = hasPermission("health.write");

  setElementVisible(document.getElementById("statsPanel"), canHealthRead);
  setElementVisible(els.usersPanel, canUsersRead);
  setElementVisible(els.settingsPanel, canSettingsRead);
  setElementVisible(els.achievementsPanel, canSettingsRead);
  setElementVisible(els.notificationsPanel, canNotificationsRead);
  setElementVisible(els.auditPanel, canAuditRead);
  setElementVisible(els.supportPanel, canSupportRead);
  setElementVisible(els.systemHealthPanel, canHealthRead);
  setElementVisible(els.permissionsPanel, state.currentRole === "admin");
  setElementVisible(els.recordsPanel, canRecordsRead);
  setElementVisible(els.receiptsPanel, canRecordsRead);
  setElementVisible(els.budgetsPanel, canRecordsRead);

  if (els.userSearchBtn) els.userSearchBtn.disabled = !canUsersRead;
  if (els.userSearch) els.userSearch.disabled = !canUsersRead;
  if (els.userClearBtn) els.userClearBtn.disabled = !canUsersRead;
  if (els.recordsSearchBtn) els.recordsSearchBtn.disabled = !canRecordsRead;
  if (els.recordsType) els.recordsType.disabled = !canRecordsRead;

  if (!canSettingsWrite) {
    setControlsDisabled(els.settingsForm, true);
    if (els.addAchievementBtn) els.addAchievementBtn.disabled = true;
  }

  if (!canNotificationsWrite) {
    if (els.publishNotificationBtn) els.publishNotificationBtn.disabled = true;
    setControlsDisabled(document.querySelector(".admin-notification-toolbar"), true);
    if (els.notificationEditor) els.notificationEditor.setAttribute("contenteditable", "false");
  }

  if (!canSupportWrite) {
    if (els.supportStatusFilter) els.supportStatusFilter.disabled = !canSupportRead;
  }

  if (!canRecordsRead) {
    toggleUserDataSections(false);
  }

  if (!canUsersWrite && els.userRole) {
    els.userRole.disabled = true;
  }

  setReadOnlyBadge(els.usersPanel, "admin", canUsersRead && !canUsersWrite);
  setReadOnlyBadge(els.recordsPanel, "admin", canRecordsRead && !canRecordsWrite);
  setReadOnlyBadge(els.settingsPanel, "admin", canSettingsRead && !canSettingsWrite);
  setReadOnlyBadge(els.achievementsPanel, "admin", canSettingsRead && !canSettingsWrite);
  setReadOnlyBadge(els.notificationsPanel, "support_admin", canNotificationsRead && !canNotificationsWrite);
  setReadOnlyBadge(els.supportPanel, "support_admin", canSupportRead && !canSupportWrite);
  setReadOnlyBadge(els.systemHealthPanel, "admin", canHealthRead && !canHealthWrite);
}

function isPermissionError(err) {
  const status = Number(err?.status || 0);
  const message = String(err?.message || "").toLowerCase();
  return status === 403 || message.includes("permission denied") || message.includes("admin access required");
}

function handlePermissionError(err, requiredRole = "admin") {
  if (!isPermissionError(err)) return false;
  openPermissionModal(requiredRole);
  return true;
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
    if (!["admin", "support_admin", "analyst"].includes(String(user?.role || ""))) {
      window.location.href = "home.html";
      return false;
    }
    state.currentUser = user || null;
    state.currentRole = String(user?.role || "user").trim();
    state.permissions = ROLE_PERMISSIONS[state.currentRole] || new Set();
    try {
      const perms = await api.admin.getPermissions();
      if (Array.isArray(perms?.permissions)) {
        state.permissions = new Set(perms.permissions);
      }
      if (perms?.overrides && typeof perms.overrides === "object") {
        state.adminRolePermissions = sanitizeAdminRolePermissionOverrides(perms.overrides);
      }
    } catch (err) {
      console.warn("Failed to load dynamic permissions; using defaults", err);
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

function setAuditPanelCollapsed(collapsed) {
  if (!els.auditPanel) return;
  els.auditPanel.classList.toggle("is-collapsed", collapsed);
  if (els.auditPanelBody) els.auditPanelBody.hidden = collapsed;
  if (els.toggleAuditPanelCaret) {
    els.toggleAuditPanelCaret.textContent = collapsed ? ">" : "v";
    els.toggleAuditPanelCaret.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.toggleAuditPanelCaret.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} Audit Log section`
    );
  }
}

function setSupportPanelCollapsed(collapsed) {
  if (!els.supportPanel) return;
  els.supportPanel.classList.toggle("is-collapsed", collapsed);
  if (els.supportPanelBody) els.supportPanelBody.hidden = collapsed;
  if (els.toggleSupportPanelCaret) {
    els.toggleSupportPanelCaret.textContent = collapsed ? ">" : "v";
    els.toggleSupportPanelCaret.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.toggleSupportPanelCaret.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} Support Inbox section`
    );
  }
}

function setSystemHealthPanelCollapsed(collapsed) {
  if (!els.systemHealthPanel) return;
  els.systemHealthPanel.classList.toggle("is-collapsed", collapsed);
  if (els.systemHealthPanelBody) els.systemHealthPanelBody.hidden = collapsed;
  if (els.toggleSystemHealthPanelCaret) {
    els.toggleSystemHealthPanelCaret.textContent = collapsed ? ">" : "v";
    els.toggleSystemHealthPanelCaret.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.toggleSystemHealthPanelCaret.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} System Health section`
    );
  }
}

function setPermissionsPanelCollapsed(collapsed) {
  if (!els.permissionsPanel) return;
  els.permissionsPanel.classList.toggle("is-collapsed", collapsed);
  if (els.permissionsPanelBody) els.permissionsPanelBody.hidden = collapsed;
  if (els.togglePermissionsPanelCaret) {
    els.togglePermissionsPanelCaret.textContent = collapsed ? ">" : "v";
    els.togglePermissionsPanelCaret.setAttribute("aria-expanded", collapsed ? "false" : "true");
    els.togglePermissionsPanelCaret.setAttribute(
      "aria-label",
      `${collapsed ? "Expand" : "Collapse"} Permissions section`
    );
  }
}

function formatPermissionHeader(permission) {
  const [scope, level] = String(permission || "").split(".");
  return `${scope || ""}<br/>${level || ""}`;
}

function sanitizeAdminRolePermissionOverrides(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const allowedPermissions = new Set(PERMISSIONS_GRID_ORDER);
  const next = {};
  ADMIN_ROLES_FOR_GRID.forEach((role) => {
    const raw = input[role];
    if (!Array.isArray(raw)) return;
    next[role] = [...new Set(
      raw
        .map((permission) => String(permission || "").trim().toLowerCase())
        .filter((permission) => allowedPermissions.has(permission))
    )];
  });
  return next;
}

function getEffectiveRolePermissionSet(role) {
  const base = ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
  const override = state.adminRolePermissions?.[role];
  if (!Array.isArray(override)) return new Set(base);
  return new Set(override);
}

function renderPermissionsMatrix() {
  if (!els.permissionsHeadRow || !els.permissionsTbody) return;
  const canSeePermissionsPanel = state.currentRole === "admin";
  if (!canSeePermissionsPanel) {
    els.permissionsHeadRow.innerHTML = "<th>Role</th>";
    els.permissionsTbody.innerHTML = '<tr><td class="subtle">You do not have access to this section.</td></tr>';
    return;
  }

  const headers = PERMISSIONS_GRID_ORDER
    .map((permission) => `<th class="admin-permission-col">${formatPermissionHeader(escapeHtml(permission))}</th>`)
    .join("");
  els.permissionsHeadRow.innerHTML = `<th>Role</th>${headers}`;

  els.permissionsTbody.innerHTML = ADMIN_ROLES_FOR_GRID
    .map((role) => {
      const allowed = getEffectiveRolePermissionSet(role);
      const cells = PERMISSIONS_GRID_ORDER
        .map((permission) => {
          const checked = allowed.has(permission) ? "checked" : "";
          return `<td class="admin-permission-cell"><input type="checkbox" data-role="${escapeHtml(role)}" data-permission="${escapeHtml(permission)}" ${checked} ${state.savingPermissions ? "disabled" : ""} aria-label="${escapeHtml(role)} ${escapeHtml(permission)}" /></td>`;
        })
        .join("");
      return `<tr><th scope="row">${escapeHtml(role)}</th>${cells}</tr>`;
    })
    .join("");
}

async function persistPermissionsMatrix() {
  if (state.currentRole !== "admin" || state.savingPermissions) return;
  state.savingPermissions = true;
  renderPermissionsMatrix();
  setStatus(els.permissionsStatus, "Saving permissions...");
  try {
    const payload = sanitizeAdminRolePermissionOverrides(state.adminRolePermissions);
    const { settings } = await api.admin.updateSettings({ adminRolePermissions: payload });
    state.adminRolePermissions = sanitizeAdminRolePermissionOverrides(
      settings?.admin_role_permissions || payload
    );
    renderPermissionsMatrix();
    setStatus(els.permissionsStatus, "Permissions updated.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(els.permissionsStatus, err.message || "Failed to save permissions.", "error");
  } finally {
    state.savingPermissions = false;
    renderPermissionsMatrix();
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
  const canUsersWrite = hasPermission("users.write");
  const canViewUserData = hasPermission("records.read");
  const showActionsCol = canViewUserData || canUsersWrite;
  const usersActionsHeader = document.querySelector("#usersPanel .admin-table thead th.actions-col");
  if (usersActionsHeader) {
    usersActionsHeader.hidden = !showActionsCol;
  }
  if (!rows.length) {
    const message = state.usersQuery ? "No users found." : "No users available.";
    els.usersTbody.innerHTML = `<tr><td colspan="${showActionsCol ? 5 : 4}" class="subtle">${message}</td></tr>`;
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
          ${
            showActionsCol
              ? `<td>
            ${canViewUserData ? `<button class="btn btn--link" data-action="view-user" data-id="${user.id}">View Data</button>` : ""}
            ${canUsersWrite ? `<button class="btn btn--link" data-action="edit-user" data-id="${user.id}">Edit</button>` : ""}
          </td>`
              : ""
          }
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
  const canRecordsWrite = hasPermission("records.write");
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
            ${
              canRecordsWrite
                ? `<button class="btn btn--link" data-action="edit-record" data-id="${record.id}">Edit</button>
            <button class="btn btn--link" data-action="delete-record" data-id="${record.id}">Delete</button>`
                : "—"
            }
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
  const canSettingsWrite = hasPermission("settings.write");
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
      ${
        canSettingsWrite
          ? `<button
        class="admin-achievement-remove"
        data-action="remove-achievement"
        data-key="${escapeHtml(item.key)}"
        type="button"
        aria-label="Remove achievement ${escapeHtml(item.title || item.key)}"
        title="Remove achievement"
      >
        X
      </button>`
          : ""
      }
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
  const canNotificationsWrite = hasPermission("notifications.write");
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
      const isActive = Boolean(item.is_active);
      return `
        <article class="admin-notification-item">
          <div class="admin-notification-meta">${createdAt} • ${type} • ${isActive ? "active" : "inactive"} • by ${creator}</div>
          <p>${content}</p>
          <div class="admin-notification-controls ${canNotificationsWrite ? "" : "is-hidden"}">
            <button class="btn btn--link" type="button" data-action="edit-notification" data-id="${item.id}">Edit</button>
            <button class="btn btn--link" type="button" data-action="toggle-notification-active" data-id="${item.id}" data-active="${isActive ? "true" : "false"}">
              ${isActive ? "Deactivate" : "Activate"}
            </button>
            <button class="btn btn--link" type="button" data-action="resend-notification" data-id="${item.id}">Resend Email</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadNotificationHistory() {
  if (!hasPermission("notifications.read")) return;
  if (!els.notificationHistoryList) return;
  try {
    const type = String(els.notificationFilterType?.value || "").trim();
    const active = String(els.notificationFilterActive?.value || "").trim();
    const { notifications } = await api.admin.listNotificationsFiltered({ type, active });
    state.notificationsHistory = Array.isArray(notifications) ? notifications : [];
    renderNotificationHistory();
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "support_admin")) return;
    els.notificationHistoryList.innerHTML = `<p class="subtle">${escapeHtml(err.message || "Failed to load notifications.")}</p>`;
  }
}

async function publishNotificationFromEditor() {
  if (!hasPermission("notifications.write")) {
    openPermissionModal("support_admin");
    return;
  }
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
  const isEdit = Boolean(state.editingNotificationId);
  setStatus(els.notificationAdminStatus, isEdit ? "Updating notification..." : "Publishing notification...");
  try {
    if (isEdit) {
      await api.admin.updateNotification(state.editingNotificationId, {
        messageHtml: html,
        notificationType,
      });
    } else {
      await api.admin.createNotification({ messageHtml: html, notificationType });
    }
    if (els.notificationEditor) {
      els.notificationEditor.innerHTML = "";
    }
    if (els.notificationTypeInput) {
      els.notificationTypeInput.value = "general";
    }
    state.editingNotificationId = "";
    await loadNotificationHistory();
    setStatus(els.notificationAdminStatus, isEdit ? "Notification updated." : "Notification published.", "ok");
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "support_admin")) return;
    setStatus(els.notificationAdminStatus, err.message || "Failed to publish notification.", "error");
  } finally {
    if (els.publishNotificationBtn) {
      els.publishNotificationBtn.disabled = false;
    }
  }
}

function renderAuditLog() {
  if (!els.auditTbody) return;
  if (!state.auditLog.length) {
    els.auditTbody.innerHTML = `<tr><td colspan="4" class="subtle">No audit entries found.</td></tr>`;
    return;
  }
  els.auditTbody.innerHTML = state.auditLog
    .map((row) => {
      const actor = escapeHtml(
        row.full_name || row.username || row.email || row.user_id || "Unknown"
      );
      const action = escapeHtml(row.action || "");
      const entity = escapeHtml(
        `${row.entity_type || "—"}${row.entity_id ? ` (${row.entity_id})` : ""}`
      );
      return `
        <tr>
          <td>${escapeHtml(formatDateTime(row.created_at))}</td>
          <td>${actor}</td>
          <td>${action}</td>
          <td>${entity}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadAuditLog() {
  if (!hasPermission("audit.read")) return;
  if (!els.auditTbody) return;
  try {
    const q = String(els.auditQueryInput?.value || "").trim();
    const scope = String(els.auditScopeInput?.value || "all").trim();
    const { auditLog } = await api.admin.getAuditLog({ q, scope, limit: 200 });
    state.auditLog = Array.isArray(auditLog) ? auditLog : [];
    renderAuditLog();
    setStatus(els.auditStatus, "");
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "support_admin")) return;
    setStatus(els.auditStatus, err.message || "Failed to load audit log.", "error");
  }
}

function renderSupportTickets() {
  if (!els.supportTbody) return;
  const canSupportWrite = hasPermission("support.write");
  if (!state.supportTickets.length) {
    els.supportTbody.innerHTML = `<tr><td colspan="5" class="subtle">No support tickets found.</td></tr>`;
    return;
  }
  els.supportTbody.innerHTML = state.supportTickets
    .map((t) => {
      const sender = escapeHtml(t.name || t.email || t.user_full_name || t.user_username || "Unknown");
      const subject = escapeHtml(t.subject || "");
      const status = escapeHtml(t.status || "open");
      return `
        <tr>
          <td>${escapeHtml(formatDateTime(t.created_at))}</td>
          <td>${sender}</td>
          <td>${subject}</td>
          <td>${status}</td>
          <td>
            ${
              canSupportWrite
                ? `<button class="btn btn--link" type="button" data-action="support-status" data-id="${t.id}" data-status="in_progress">In Progress</button>
            <button class="btn btn--link" type="button" data-action="support-status" data-id="${t.id}" data-status="resolved">Resolve</button>
            <button class="btn btn--link" type="button" data-action="support-status" data-id="${t.id}" data-status="closed">Close</button>`
                : "—"
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadSupportTickets() {
  if (!hasPermission("support.read")) return;
  if (!els.supportTbody) return;
  try {
    const status = String(els.supportStatusFilter?.value || "").trim();
    const { tickets } = await api.admin.listSupportTickets({ status, limit: 200 });
    state.supportTickets = Array.isArray(tickets) ? tickets : [];
    renderSupportTickets();
    setStatus(els.supportStatusMsg, "");
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "support_admin")) return;
    setStatus(els.supportStatusMsg, err.message || "Failed to load support tickets.", "error");
  }
}

function renderSystemHealth() {
  if (!els.healthSummary) return;
  if (!state.systemHealth) {
    els.healthSummary.innerHTML = `<tr><td colspan="5" class="subtle">System health unavailable.</td></tr>`;
    return;
  }
  const services = Array.isArray(state.systemHealth?.services) ? state.systemHealth.services : [];
  if (!services.length) {
    els.healthSummary.innerHTML = `<tr><td colspan="5" class="subtle">No services found.</td></tr>`;
    return;
  }

  const GROUPS = [
    {
      id: "api_connections",
      label: "API Connections",
      detail: "External APIs used by the app.",
      serviceIds: [
        "database_connection",
        "brevo_api",
        "ratesdb_api",
        "google_oauth_api",
        "turnstile",
        "ai_provider",
      ],
    },
    {
      id: "code_services",
      label: "Code Services (Python/Workers)",
      detail: "Internal worker/runtime services.",
      serviceIds: ["parser_service", "ocr_worker", "weekly_notification_worker"],
    },
    {
      id: "group_connections",
      label: "Group Connections",
      detail: "SMTP/object storage and other non-API connections.",
      serviceIds: ["smtp_connection", "object_storage_connection"],
    },
  ];

  const serviceById = new Map(
    services.map((service) => [String(service.id || "").trim(), service])
  );
  const grouped = [];
  const seen = new Set();

  for (const group of GROUPS) {
    const groupServices = group.serviceIds
      .map((id) => serviceById.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        const aLabel = String(a?.label || a?.id || "").toLowerCase();
        const bLabel = String(b?.label || b?.id || "").toLowerCase();
        return aLabel.localeCompare(bLabel);
      });
    if (!groupServices.length) continue;
    for (const item of groupServices) {
      seen.add(String(item.id || "").trim());
    }
    grouped.push({ ...group, services: groupServices });
  }

  const ungrouped = services.filter((service) => !seen.has(String(service.id || "").trim()));
  if (ungrouped.length) {
    grouped.push({
      id: "other_services",
      label: "Other Services",
      detail: "Uncategorized health checks.",
      services: ungrouped,
    });
  }

  const resolveGroupState = (items) => {
    const states = new Set(items.map((item) => String(item.state || "unknown").toLowerCase()));
    if (states.size > 1) {
      if (states.has("down")) return { key: "mixed-down", label: "mixed" };
      if (states.has("deactivated")) return { key: "mixed-deactivated", label: "mixed" };
      if (states.has("active") && states.has("unconfigured")) {
        return { key: "mixed-unconfigured", label: "mixed" };
      }
      return { key: "unknown", label: "unknown" };
    }
    const hasActive = states.has("active");
    if (hasActive) return { key: "active", label: "active" };
    if (states.has("deactivated")) return { key: "deactivated", label: "deactivated" };
    if (states.has("down")) return { key: "down", label: "down" };
    if (states.has("unconfigured")) return { key: "unconfigured", label: "unconfigured" };
    return { key: "unknown", label: "unknown" };
  };

  const canHealthWrite = hasPermission("health.write");
  const renderServiceRow = (service) => {
      const id = String(service.id || "");
      const currentState = String(service.state || "unknown").toLowerCase();
      const statusClass = `admin-health-state admin-health-state--${escapeHtml(currentState)}`;
      const testing = state.testingHealthServiceIds.has(id);
      const passText = state.healthPassByService[id] ? `<span class="admin-health-pass">${escapeHtml(state.healthPassByService[id])}</span>` : "";
      const disableDeactivate = !canHealthWrite || !service.deactivatable || service.deactivated;
      const disableActivate = !canHealthWrite || !service.deactivatable || !service.deactivated;
      const isUnconfigured = currentState === "unconfigured";
      const actionsHtml = isUnconfigured
        ? `<span class="subtle">Configure first</span>`
        : `<div class="admin-health-actions">
              ${passText}
              <button class="btn btn--link" type="button" data-action="test-health-service" data-id="${escapeHtml(id)}" ${testing ? "disabled" : ""}>
                ${testing ? "Testing..." : "Test"}
              </button>
              ${
                service.deactivated
                  ? `<button class="btn btn--link admin-health-btn admin-health-btn--activate" type="button" data-action="activate-health-service" data-id="${escapeHtml(id)}" ${disableActivate ? "disabled" : ""}>
                Activate
              </button>`
                  : `<button class="btn btn--link admin-health-btn admin-health-btn--deactivate" type="button" data-action="deactivate-health-service" data-id="${escapeHtml(id)}" ${disableDeactivate ? "disabled" : ""}>
                Deactivate
              </button>`
              }
            </div>`;
      return `
        <tr>
          <td class="admin-health-child-label">${escapeHtml(service.label || id)}</td>
          <td>${escapeHtml(service.type || "service")}</td>
          <td><span class="${statusClass}">${escapeHtml(service.state || "unknown")}</span></td>
          <td>${escapeHtml(service.detail || "—")}</td>
          <td>${actionsHtml}</td>
        </tr>
      `;
  };

  els.healthSummary.innerHTML = grouped
    .map((group) => {
      const groupState = resolveGroupState(group.services);
      const groupStateClass = `admin-health-state admin-health-state--${escapeHtml(groupState.key)}`;
      const groupRows = group.services.map((service) => renderServiceRow(service)).join("");
      return `
        <tr class="admin-health-group-row">
          <td>
            <strong>${escapeHtml(group.label)}</strong>
          </td>
          <td>group</td>
          <td><span class="${groupStateClass}">${escapeHtml(groupState.label)}</span></td>
          <td>${escapeHtml(group.detail || `${group.services.length} service(s)`)}</td>
          <td>—</td>
        </tr>
        ${groupRows}
      `;
    })
    .join("");
}

async function loadSystemHealth() {
  if (!hasPermission("health.read")) return;
  if (!els.healthSummary) return;
  try {
    const { health } = await api.admin.getSystemHealth();
    state.systemHealth = health || null;
    renderSystemHealth();
    setStatus(els.healthStatus, "");
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "support_admin")) return;
    setStatus(els.healthStatus, err.message || "Failed to load system health.", "error");
  }
}

function openHealthServiceActionModal(serviceId, action) {
  const services = Array.isArray(state.systemHealth?.services) ? state.systemHealth.services : [];
  const service = services.find((item) => String(item.id) === String(serviceId || ""));
  if (!service) return;
  const mode = String(action || "").trim() === "activate" ? "activate" : "deactivate";
  state.healthConfirmAction = mode;
  state.healthDisconnectServiceId = String(service.id || "");
  if (els.healthDisconnectTitle) {
    els.healthDisconnectTitle.textContent = mode === "activate" ? "Activate Service" : "Deactivate Service";
  }
  if (els.healthDisconnectMessage) {
    if (mode === "activate" && String(service.id) === "database_connection") {
      els.healthDisconnectMessage.textContent =
        `Are you sure you want to activate ${service.label}? Enter the emergency activation code and press Activate.`;
    } else {
      els.healthDisconnectMessage.textContent =
        `Are you sure you want to ${mode} ${service.label}? Enter your password and press ${mode === "activate" ? "Activate" : "Deactivate"}.`;
    }
  }
  if (els.healthDisconnectCredentialLabel) {
    els.healthDisconnectCredentialLabel.textContent =
      mode === "activate" && String(service.id) === "database_connection"
        ? "Emergency Code"
        : "Password";
  }
  if (els.healthDisconnectBtn) {
    els.healthDisconnectBtn.textContent = mode === "activate" ? "Activate" : "Deactivate";
  }
  if (els.healthDisconnectPassword) {
    els.healthDisconnectPassword.value = "";
  }
  setStatus(els.healthDisconnectStatus, "");
  openModal(els.healthDisconnectModal);
}

async function submitHealthDisconnect(event) {
  event.preventDefault();
  const serviceId = String(state.healthDisconnectServiceId || "");
  const action = String(state.healthConfirmAction || "deactivate");
  if (!serviceId) return;
  const credential = String(els.healthDisconnectPassword?.value || "").trim();
  if (!credential) {
    setStatus(
      els.healthDisconnectStatus,
      action === "activate" && serviceId === "database_connection"
        ? "Enter your emergency activation code."
        : "Enter your password.",
      "error"
    );
    return;
  }
  if (els.healthDisconnectBtn) {
    els.healthDisconnectBtn.disabled = true;
  }
  setStatus(
    els.healthDisconnectStatus,
    action === "activate" ? "Activating service..." : "Deactivating service..."
  );
  try {
    let result = null;
    if (action === "activate") {
      if (serviceId === "database_connection") {
        result = await api.admin.emergencyActivateDatabaseConnection(credential);
      } else {
        result = await api.admin.activateSystemHealthService(serviceId, credential);
      }
    } else {
      result = await api.admin.deactivateSystemHealthService(serviceId, credential);
    }
    state.healthPassByService = {};
    setStatus(
      els.healthStatus,
      result?.message || (action === "activate" ? "Service activated." : "Service deactivated."),
      "ok"
    );
    closeModal(els.healthDisconnectModal);
    if (serviceId === "database_connection" && action === "deactivate") {
      if (state.systemHealth && Array.isArray(state.systemHealth.services)) {
        state.systemHealth.services = state.systemHealth.services.map((item) => {
          if (String(item.id) !== serviceId) return item;
          return {
            ...item,
            deactivated: true,
            state: "deactivated",
          };
        });
        renderSystemHealth();
      }
    } else if (serviceId === "database_connection" && action === "activate") {
      if (state.systemHealth && Array.isArray(state.systemHealth.services)) {
        state.systemHealth.services = state.systemHealth.services.map((item) => {
          if (String(item.id) !== serviceId) return item;
          return {
            ...item,
            deactivated: false,
            state: "active",
          };
        });
        renderSystemHealth();
      }
    } else {
      await loadSystemHealth();
    }
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "admin")) return;
    setStatus(
      els.healthDisconnectStatus,
      err.message || (action === "activate" ? "Failed to activate service." : "Failed to disconnect service."),
      "error"
    );
  } finally {
    if (els.healthDisconnectBtn) {
      els.healthDisconnectBtn.disabled = false;
    }
  }
}

async function testHealthService(serviceId) {
  const id = String(serviceId || "").trim();
  if (!id) return;
  state.testingHealthServiceIds.add(id);
  renderSystemHealth();
  try {
    const result = await api.admin.testSystemHealthService(id);
    if (result?.ok) {
      state.healthPassByService[id] = "Pass";
      setTimeout(() => {
        delete state.healthPassByService[id];
        renderSystemHealth();
      }, 2200);
    }
    await loadSystemHealth();
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "support_admin")) return;
    setStatus(els.healthStatus, err.message || "Service test failed.", "error");
  } finally {
    state.testingHealthServiceIds.delete(id);
    renderSystemHealth();
  }
}

async function persistAchievementsCatalog(nextCatalog, successMessage) {
  if (!hasPermission("settings.write")) {
    openPermissionModal("admin");
    return false;
  }
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
    if (handlePermissionError(err, "admin")) return false;
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
  if (!hasPermission("health.read")) return;
  try {
    const { stats } = await api.admin.getStats();
    setText(els.statsUsers, formatNumber(stats?.total_users));
    setText(els.statsRecords, formatNumber(stats?.total_records));
    setText(els.statsReceipts, formatNumber(stats?.total_receipts));
    setStatus(els.statsStatus, "");
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "support_admin")) return;
    setStatus(els.statsStatus, err.message || "Failed to load overview stats.", "error");
  }
}

async function loadUserOptions() {
  if (!hasPermission("users.read")) return;
  try {
    const { users } = await api.admin.listUserOptions();
    state.userOptions = users || [];
    renderUserOptions();
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "support_admin")) return;
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
  if (!hasPermission("users.read")) return;
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
    if (handlePermissionError(err, "support_admin")) return;
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
  if (!hasPermission("users.write")) {
    openPermissionModal("admin");
    return;
  }
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
    if (handlePermissionError(err, "admin")) return;
    setStatus(els.userStatus, err.message || "Failed to update user.", "error");
  }
}

async function loadRecords() {
  if (!hasPermission("records.read")) return;
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
    if (handlePermissionError(err, "analyst")) return;
    setStatus(els.recordsStatus, err.message || "Failed to load records.", "error");
  }
}

async function loadReceipts() {
  if (!hasPermission("records.read")) return;
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
    if (handlePermissionError(err, "analyst")) return;
    setStatus(els.receiptsStatus, err.message || "Failed to load receipts.", "error");
  }
}

async function loadBudgetSheets() {
  if (!hasPermission("records.read")) return;
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
    if (handlePermissionError(err, "analyst")) return;
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
  if (!hasPermission("records.read")) {
    toggleUserDataSections(false);
    return;
  }
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
  if (!hasPermission("records.write")) {
    openPermissionModal("admin");
    return;
  }
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
    if (handlePermissionError(err, "admin")) return;
    setStatus(els.recordStatus, err.message || "Failed to update record.", "error");
  }
}

async function deleteRecord(id) {
  if (!hasPermission("records.write")) {
    openPermissionModal("admin");
    return;
  }
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
    if (handlePermissionError(err, "admin")) return;
    setStatus(els.recordsStatus, err.message || "Failed to delete record.", "error");
  }
}

async function loadSettings() {
  if (!hasPermission("settings.read")) return;
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
    state.adminRolePermissions = sanitizeAdminRolePermissionOverrides(settings?.admin_role_permissions);
    renderSettingsAchievements();
    updateAchievementKeyValidation();
    renderPermissionsMatrix();
  } catch (err) {
    console.error(err);
    if (handlePermissionError(err, "admin")) return;
    setStatus(els.settingsStatus, err.message || "Failed to load settings.", "error");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  if (!hasPermission("settings.write")) {
    openPermissionModal("admin");
    return;
  }
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
    if (handlePermissionError(err, "admin")) return;
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
  if (els.toggleAuditPanelCaret) {
    els.toggleAuditPanelCaret.addEventListener("click", () => {
      const collapsed = els.auditPanel?.classList.contains("is-collapsed");
      setAuditPanelCollapsed(!collapsed);
    });
  }
  if (els.toggleSupportPanelCaret) {
    els.toggleSupportPanelCaret.addEventListener("click", () => {
      const collapsed = els.supportPanel?.classList.contains("is-collapsed");
      setSupportPanelCollapsed(!collapsed);
    });
  }
  if (els.toggleSystemHealthPanelCaret) {
    els.toggleSystemHealthPanelCaret.addEventListener("click", () => {
      const collapsed = els.systemHealthPanel?.classList.contains("is-collapsed");
      setSystemHealthPanelCollapsed(!collapsed);
    });
  }
  if (els.togglePermissionsPanelCaret) {
    els.togglePermissionsPanelCaret.addEventListener("click", () => {
      const collapsed = els.permissionsPanel?.classList.contains("is-collapsed");
      setPermissionsPanelCollapsed(!collapsed);
    });
  }
  if (els.notificationFilterApplyBtn) {
    els.notificationFilterApplyBtn.addEventListener("click", loadNotificationHistory);
  }
  if (els.auditRefreshBtn) {
    els.auditRefreshBtn.addEventListener("click", loadAuditLog);
  }
  if (els.auditQueryInput) {
    els.auditQueryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadAuditLog();
      }
    });
  }
  if (els.auditScopeInput) {
    els.auditScopeInput.addEventListener("change", loadAuditLog);
  }
  if (els.supportRefreshBtn) {
    els.supportRefreshBtn.addEventListener("click", loadSupportTickets);
  }
  if (els.supportStatusFilter) {
    els.supportStatusFilter.addEventListener("change", loadSupportTickets);
  }
  if (els.healthRefreshBtn) {
    els.healthRefreshBtn.addEventListener("click", loadSystemHealth);
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
  if (els.healthDisconnectForm) {
    els.healthDisconnectForm.addEventListener("submit", submitHealthDisconnect);
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

  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[type='checkbox'][data-role][data-permission]");
    if (!checkbox || state.currentRole !== "admin") return;
    const role = String(checkbox.dataset.role || "").trim();
    const permission = String(checkbox.dataset.permission || "").trim();
    if (!ADMIN_ROLES_FOR_GRID.includes(role)) return;
    if (!PERMISSIONS_GRID_ORDER.includes(permission)) return;

    const current = getEffectiveRolePermissionSet(role);
    if (checkbox.checked) {
      current.add(permission);
    } else {
      current.delete(permission);
    }
    state.adminRolePermissions = {
      ...state.adminRolePermissions,
      [role]: [...current].filter((item) => PERMISSIONS_GRID_ORDER.includes(item)),
    };
    persistPermissionsMatrix();
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const key = btn.dataset.key;

    if (action === "edit-user") {
      if (!hasPermission("users.write")) {
        openPermissionModal("admin");
        return;
      }
      const user = state.users.find((u) => u.id === id);
      openUserModal(user);
    }

    if (action === "view-user") {
      const user = state.users.find((u) => u.id === id);
      loadUserDataForUser(user);
    }

    if (action === "edit-record") {
      if (!hasPermission("records.write")) {
        openPermissionModal("admin");
        return;
      }
      const record = state.records.find((r) => r.id === id);
      openRecordModal(record);
    }

    if (action === "delete-record") {
      if (!hasPermission("records.write")) {
        openPermissionModal("admin");
        return;
      }
      deleteRecord(id);
    }

    if (action === "remove-achievement") {
      if (!hasPermission("settings.write")) {
        openPermissionModal("admin");
        return;
      }
      const nextCatalog = state.settingsAchievements.filter((item) => item.key !== key);
      persistAchievementsCatalog(nextCatalog, "Achievement removed.");
    }
    if (action === "edit-notification") {
      if (!hasPermission("notifications.write")) {
        openPermissionModal("support_admin");
        return;
      }
      const item = state.notificationsHistory.find((n) => n.id === id);
      if (!item || !els.notificationEditor) return;
      els.notificationEditor.innerHTML = String(item.message_html || item.message_text || "");
      if (els.notificationTypeInput) {
        els.notificationTypeInput.value = String(item.notification_type || "general");
      }
      state.editingNotificationId = String(item.id || "");
      setStatus(els.notificationAdminStatus, "Editing existing notification. Click publish to update.");
      setNotificationsPanelCollapsed(false);
    }
    if (action === "toggle-notification-active") {
      if (!hasPermission("notifications.write")) {
        openPermissionModal("support_admin");
        return;
      }
      const isActive = String(btn.dataset.active || "") === "true";
      api.admin
        .updateNotification(id, { isActive: !isActive })
        .then(() => loadNotificationHistory())
        .catch((err) => {
          if (handlePermissionError(err, "support_admin")) return;
          setStatus(els.notificationAdminStatus, err.message || "Failed to update notification", "error");
        });
    }
    if (action === "resend-notification") {
      if (!hasPermission("notifications.write")) {
        openPermissionModal("support_admin");
        return;
      }
      api.admin
        .resendNotification(id)
        .then((result) => {
          if (result?.queued) {
            setStatus(
              els.notificationAdminStatus,
              `Resend queued for ${result?.recipientCount ?? 0} recipient(s).`,
              "ok"
            );
            return;
          }
          setStatus(
            els.notificationAdminStatus,
            `Resend complete. Sent: ${result?.sent ?? 0}, Failed: ${result?.failed ?? 0}`,
            "ok"
          );
        })
        .catch((err) => {
          if (handlePermissionError(err, "support_admin")) return;
          setStatus(els.notificationAdminStatus, err.message || "Resend failed", "error");
        });
    }
    if (action === "support-status") {
      if (!hasPermission("support.write")) {
        openPermissionModal("support_admin");
        return;
      }
      const status = String(btn.dataset.status || "").trim();
      api.admin
        .updateSupportTicket(id, { status })
        .then(() => {
          setStatus(els.supportStatusMsg, "Ticket updated.", "ok");
          loadSupportTickets();
        })
        .catch((err) => {
          if (handlePermissionError(err, "support_admin")) return;
          setStatus(els.supportStatusMsg, err.message || "Failed to update ticket", "error");
        });
    }
    if (action === "test-health-service") {
      testHealthService(id);
    }
    if (action === "deactivate-health-service") {
      if (!hasPermission("health.write")) {
        openPermissionModal("admin");
        return;
      }
      openHealthServiceActionModal(id, "deactivate");
    }
    if (action === "activate-health-service") {
      if (!hasPermission("health.write")) {
        openPermissionModal("admin");
        return;
      }
      openHealthServiceActionModal(id, "activate");
    }
  });
}

async function init() {
  const ok = await ensureAdmin();
  if (!ok) return;
  applyPermissionVisibility();
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
  setStatus(els.auditStatus, "");
  setStatus(els.supportStatusMsg, "");
  setStatus(els.healthStatus, "");
  setStatus(els.healthDisconnectStatus, "");
  setStatus(els.permissionsStatus, "");
  updateRecordsContext();
  setUsersPanelCollapsed(true);
  setSettingsPanelCollapsed(true);
  setAchievementsPanelCollapsed(true);
  setNotificationsPanelCollapsed(true);
  setAuditPanelCollapsed(true);
  setSupportPanelCollapsed(true);
  setSystemHealthPanelCollapsed(true);
  setPermissionsPanelCollapsed(true);
  syncAchievementTargetInput();
  renderPermissionsMatrix();

  const initialLoads = [];
  if (hasPermission("health.read")) initialLoads.push(loadStats(), loadSystemHealth());
  if (hasPermission("users.read")) initialLoads.push(loadUserOptions(), loadUsers({ resetPage: true, evaluateSelection: false }));
  if (hasPermission("settings.read")) initialLoads.push(loadSettings());
  if (hasPermission("notifications.read")) initialLoads.push(loadNotificationHistory());
  if (hasPermission("audit.read")) initialLoads.push(loadAuditLog());
  if (hasPermission("support.read")) initialLoads.push(loadSupportTickets());
  await Promise.all(initialLoads);
}

init();

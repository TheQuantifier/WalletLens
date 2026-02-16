// web/scripts/admin.js
import { api } from "./api.js";

const els = {
  statsUsers: document.getElementById("statsUsers"),
  statsRecords: document.getElementById("statsRecords"),
  statsReceipts: document.getElementById("statsReceipts"),
  statsStatus: document.getElementById("statsStatus"),

  usersTbody: document.getElementById("usersTbody"),
  usersStatus: document.getElementById("usersStatus"),
  userSearch: document.getElementById("userSearch"),
  userSearchBtn: document.getElementById("userSearchBtn"),
  userOptions: document.getElementById("adminUserOptions"),
  userDataSections: document.getElementById("userDataSections"),

  recordsTbody: document.getElementById("recordsTbody"),
  recordsStatus: document.getElementById("recordsStatus"),
  recordsContext: document.getElementById("recordsContext"),
  recordsType: document.getElementById("recordsType"),
  recordsSearchBtn: document.getElementById("recordsSearchBtn"),

  receiptsTbody: document.getElementById("receiptsTbody"),
  receiptsStatus: document.getElementById("receiptsStatus"),

  budgetsTbody: document.getElementById("budgetsTbody"),
  budgetsStatus: document.getElementById("budgetsStatus"),

  settingsForm: document.getElementById("settingsForm"),
  appNameInput: document.getElementById("appNameInput"),
  receiptKeepFilesInput: document.getElementById("receiptKeepFilesInput"),
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
  userOptions: [],
  users: [],
  records: [],
  receipts: [],
  budgetSheets: [],
  sorts: {
    users: { key: "", dir: "" },
    records: { key: "", dir: "" },
  },
};

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

function renderUsers() {
  if (!els.usersTbody) return;
  const rows = sortRows("users", state.users);
  if (!rows.length) {
    els.usersTbody.innerHTML = `<tr><td colspan="5" class="subtle">No users found.</td></tr>`;
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

async function loadUsers() {
  const q = els.userSearch?.value?.trim() || "";
  if (!q) {
    state.users = [];
    renderUsers();
    resetUserScopedData();
    setStatus(els.usersStatus, "Enter a username, name, or email to search.", "error");
    return;
  }

  setStatus(els.usersStatus, "Searching users...");
  try {
    const { users } = await api.admin.listUsers({ q, limit: 50, offset: 0 });
    state.users = users || [];
    renderUsers();
    if (!state.users.length) {
      setStatus(els.usersStatus, "No users found.", "error");
      resetUserScopedData();
      return;
    }

    const optionMatch = findUserFromSearchInput(q);
    const targetUser = optionMatch || resolveUserForQuery(state.users, q);
    if (targetUser) {
      await loadUserDataForUser(targetUser);
      setStatus(els.usersStatus, `Found ${state.users.length} user(s).`);
    } else {
      resetUserScopedData();
      setStatus(els.usersStatus, "Multiple users matched. Select one with View Data.");
    }
  } catch (err) {
    console.error(err);
    resetUserScopedData();
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

  setStatus(els.settingsStatus, "Saving settings...");
  try {
    await api.admin.updateSettings({
      appName,
      receiptKeepFiles: Boolean(els.receiptKeepFilesInput?.checked),
    });
    sessionStorage.setItem("appName", appName);
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

function bindEvents() {
  document.querySelectorAll(".admin-sort-btn[data-table][data-key]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleSort(btn.dataset.table, btn.dataset.key);
    });
  });

  if (els.userSearchBtn) {
    els.userSearchBtn.addEventListener("click", loadUsers);
  }

  if (els.userSearch) {
    els.userSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadUsers();
      }
    });

    els.userSearch.addEventListener("change", () => {
      if (els.userSearch.value.trim()) {
        loadUsers();
      }
    });

    els.userSearch.addEventListener("click", tryOpenUserDropdown);
    els.userSearch.addEventListener("focus", tryOpenUserDropdown);
  }

  if (els.recordsSearchBtn) {
    els.recordsSearchBtn.addEventListener("click", loadRecords);
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

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

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
  setStatus(els.usersStatus, "");
  setStatus(els.recordsStatus, "");
  setStatus(els.receiptsStatus, "");
  setStatus(els.budgetsStatus, "");
  updateRecordsContext();

  await Promise.all([loadStats(), loadUserOptions(), loadSettings()]);
}

init();

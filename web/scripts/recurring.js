import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const recurringList = document.getElementById("recurringList");
  const recurringEmpty = document.getElementById("recurringEmpty");
  const recurringStatus = document.getElementById("recurringStatus");
  const recurringUpcoming = document.getElementById("recurringUpcoming");

  const btnCreateRecurring = document.getElementById("btnCreateRecurring");
  const btnCreateRecurringEmpty = document.getElementById("btnCreateRecurringEmpty");

  const recurringModal = document.getElementById("recurringModal");
  const recurringModalTitle = document.getElementById("recurringModalTitle");
  const recurringForm = document.getElementById("recurringForm");
  const recurringCancelBtn = document.getElementById("recurringCancelBtn");
  const recurringSaveBtn = document.getElementById("recurringSaveBtn");

  const els = {
    name: document.getElementById("recurringName"),
    type: document.getElementById("recurringType"),
    amount: document.getElementById("recurringAmount"),
    category: document.getElementById("recurringCategory"),
    note: document.getElementById("recurringNote"),
    frequency: document.getElementById("recurringFrequency"),
    dayOfMonth: document.getElementById("recurringDayOfMonth"),
    startDate: document.getElementById("recurringStartDate"),
    endDate: document.getElementById("recurringEndDate"),
    active: document.getElementById("recurringActive"),
  };

  const EXPENSE_CATEGORIES = [
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
    "Other",
  ];

  const INCOME_CATEGORIES = [
    "Salary / Wages",
    "Bonus / Commission",
    "Business Income",
    "Freelance / Contract",
    "Rental Income",
    "Interest / Dividends",
    "Capital Gains",
    "Refunds / Reimbursements",
    "Gifts Received",
    "Government Benefits",
    "Other",
  ];

  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

  const showStatus = (msg, kind = "ok") => {
    if (!recurringStatus) return;
    recurringStatus.textContent = msg;
    recurringStatus.classList.remove("is-hidden");
    recurringStatus.classList.toggle("is-ok", kind === "ok");
    recurringStatus.classList.toggle("is-error", kind === "error");
  };

  const clearStatus = () => {
    if (!recurringStatus) return;
    recurringStatus.classList.add("is-hidden");
    recurringStatus.textContent = "";
  };

  const showModal = () => recurringModal?.classList.remove("hidden");
  const hideModal = () => recurringModal?.classList.add("hidden");

  const populateCategoryOptions = async () => {
    let customExpense = [];
    let customIncome = [];
    try {
      const { user } = await api.auth.me();
      customExpense = user?.customExpenseCategories || user?.custom_expense_categories || [];
      customIncome = user?.customIncomeCategories || user?.custom_income_categories || [];
    } catch {
      customExpense = [];
      customIncome = [];
    }

    const combined = uniq([
      ...EXPENSE_CATEGORIES,
      ...INCOME_CATEGORIES,
      ...customExpense,
      ...customIncome,
    ]);

    if (!els.category) return;
    els.category.innerHTML = '<option value="" disabled selected>Select a category</option>';
    combined.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      els.category.appendChild(opt);
    });
  };

  const formatMoney = (value) => {
    const num = Number(value || 0);
    return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  };

  const renderUpcoming = (items = []) => {
    if (!recurringUpcoming) return;
    recurringUpcoming.innerHTML = "";
    if (!items.length) {
      recurringUpcoming.innerHTML = '<p class="subtle">No upcoming occurrences.</p>';
      return;
    }
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "recurring-upcoming-item";
      row.innerHTML = `
        <div>
          <div class="label">${item.name || "Recurring item"}</div>
          <div class="subtle">${formatDate(item.date)} · ${item.category || "Uncategorized"}</div>
        </div>
        <div>${formatMoney(item.amount)}</div>
      `;
      recurringUpcoming.appendChild(row);
    });
  };

  const renderList = (items = []) => {
    if (!recurringList) return;
    recurringList.innerHTML = "";
    if (!items.length) {
      recurringEmpty?.classList.remove("is-hidden");
      return;
    }
    recurringEmpty?.classList.add("is-hidden");

    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "recurring-card";
      card.innerHTML = `
        <span class="recurring-pill">${item.active === false ? "Paused" : "Active"}</span>
        <h3>${item.name || "Untitled"}</h3>
        <div class="recurring-meta">
          <div>${item.type || "expense"} · ${item.category || "Uncategorized"}</div>
          <div>${item.frequency || "monthly"} · next ${formatDate(item.nextRun)}</div>
          <div>${formatMoney(item.amount)}</div>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "recurring-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "btn";
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEdit(item));

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "btn";
      toggleBtn.type = "button";
      toggleBtn.textContent = item.active === false ? "Resume" : "Pause";
      toggleBtn.addEventListener("click", () => toggleActive(item));

      const delBtn = document.createElement("button");
      delBtn.className = "btn";
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => remove(item));

      actions.appendChild(editBtn);
      actions.appendChild(toggleBtn);
      actions.appendChild(delBtn);
      card.appendChild(actions);
      recurringList.appendChild(card);
    });
  };

  const loadData = async () => {
    clearStatus();
    try {
      const list = await api.recurring.list();
      const items = Array.isArray(list) ? list : (list?.items || list?.data || []);
      renderList(items);

      const upcomingRes = await api.recurring.upcoming({ days: 30 });
      const upcoming = Array.isArray(upcomingRes)
        ? upcomingRes
        : (upcomingRes?.items || upcomingRes?.data || []);
      renderUpcoming(upcoming);
    } catch (err) {
      showStatus(`Failed to load recurring items: ${err?.message || "Unknown error"}`, "error");
      renderUpcoming([]);
    }
  };

  const resetForm = () => {
    recurringForm?.reset();
    recurringForm?.setAttribute("data-edit-id", "");
    if (els.active) els.active.checked = true;
  };

  const openCreate = () => {
    resetForm();
    recurringModalTitle.textContent = "Create Recurring";
    showModal();
  };

  const openEdit = (item) => {
    resetForm();
    recurringModalTitle.textContent = "Edit Recurring";
    recurringForm?.setAttribute("data-edit-id", item.id || "");
    if (els.name) els.name.value = item.name || "";
    if (els.type) els.type.value = item.type || "expense";
    if (els.amount) els.amount.value = item.amount ?? "";
    if (els.category) els.category.value = item.category || "";
    if (els.note) els.note.value = item.note || "";
    if (els.frequency) els.frequency.value = item.frequency || "monthly";
    if (els.dayOfMonth) els.dayOfMonth.value = item.dayOfMonth || "";
    if (els.startDate) els.startDate.value = item.startDate || "";
    if (els.endDate) els.endDate.value = item.endDate || "";
    if (els.active) els.active.checked = item.active !== false;
    showModal();
  };

  const toggleActive = async (item) => {
    try {
      const updated = await api.recurring.update(item.id, { active: item.active === false });
      showStatus(updated?.active === false ? "Paused recurring item." : "Resumed recurring item.");
      await loadData();
    } catch (err) {
      showStatus(`Failed to update: ${err?.message || "Unknown error"}`, "error");
    }
  };

  const remove = async (item) => {
    if (!confirm("Delete this recurring schedule?")) return;
    try {
      await api.recurring.remove(item.id);
      showStatus("Recurring schedule deleted.");
      await loadData();
    } catch (err) {
      showStatus(`Failed to delete: ${err?.message || "Unknown error"}`, "error");
    }
  };

  const prefillFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("prefill")) return;
    openCreate();
    if (els.name) els.name.value = params.get("name") || "";
    if (els.type) els.type.value = params.get("type") || "expense";
    if (els.amount) els.amount.value = params.get("amount") || "";
    if (els.category) els.category.value = params.get("category") || "";
    if (els.note) els.note.value = params.get("note") || "";
  };

  recurringForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();

    const payload = {
      name: els.name?.value?.trim(),
      type: els.type?.value,
      amount: Number(els.amount?.value),
      category: els.category?.value,
      note: els.note?.value?.trim() || "",
      frequency: els.frequency?.value,
      dayOfMonth: els.dayOfMonth?.value ? Number(els.dayOfMonth?.value) : null,
      startDate: els.startDate?.value,
      endDate: els.endDate?.value || null,
      active: els.active?.checked !== false,
    };

    if (!payload.name || !payload.category || !payload.startDate || !Number.isFinite(payload.amount)) {
      showStatus("Please fill out name, category, amount, and start date.", "error");
      return;
    }

    const editId = recurringForm?.getAttribute("data-edit-id");
    try {
      recurringSaveBtn.disabled = true;
      recurringSaveBtn.textContent = "Saving…";
      if (editId) await api.recurring.update(editId, payload);
      else await api.recurring.create(payload);
      hideModal();
      await loadData();
      showStatus(editId ? "Recurring updated." : "Recurring created.");
    } catch (err) {
      showStatus(`Failed to save: ${err?.message || "Unknown error"}`, "error");
    } finally {
      recurringSaveBtn.disabled = false;
      recurringSaveBtn.textContent = "Save";
    }
  });

  recurringCancelBtn?.addEventListener("click", () => hideModal());
  btnCreateRecurring?.addEventListener("click", openCreate);
  btnCreateRecurringEmpty?.addEventListener("click", openCreate);

  populateCategoryOptions().then(() => {
    prefillFromQuery();
    loadData();
  });
});

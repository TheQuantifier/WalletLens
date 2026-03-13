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

  const WEEKDAY_OPTIONS = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  const els = {
    name: document.getElementById("recurringName"),
    type: document.getElementById("recurringType"),
    amount: document.getElementById("recurringAmount"),
    category: document.getElementById("recurringCategory"),
    note: document.getElementById("recurringNote"),
    frequency: document.getElementById("recurringFrequency"),
    ruleLabel: document.getElementById("recurringRuleLabel"),
    ruleInput: document.getElementById("recurringRuleInput"),
    ruleAddBtn: document.getElementById("recurringRuleAddBtn"),
    floatingMenus: document.getElementById("recurringFloatingMenus"),
    weekdayMenu: document.getElementById("recurringWeekdayMenu"),
    monthdayMenu: document.getElementById("recurringMonthdayMenu"),
    yearlyMenu: document.getElementById("recurringYearlyMenu"),
    yearlyMonthList: document.getElementById("recurringYearlyMonthList"),
    yearlyDayList: document.getElementById("recurringYearlyDayList"),
    ruleSelected: document.getElementById("recurringRuleSelected"),
    startDate: document.getElementById("recurringStartDate"),
    endDate: document.getElementById("recurringEndDate"),
    active: document.getElementById("recurringActive"),
  };

  let selectedRuleValues = [];
  let selectedYearlyMonth = "01";

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

  let expenseCategoryOptions = [...EXPENSE_CATEGORIES];
  let incomeCategoryOptions = [...INCOME_CATEGORIES];

  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const weekdayLabel = (value) => WEEKDAY_OPTIONS.find((item) => item.value === Number(value))?.label || String(value);
  const MONTH_NAME_LOOKUP = new Map([
    ["jan", 1], ["january", 1],
    ["feb", 2], ["february", 2],
    ["mar", 3], ["march", 3],
    ["apr", 4], ["april", 4],
    ["may", 5],
    ["jun", 6], ["june", 6],
    ["jul", 7], ["july", 7],
    ["aug", 8], ["august", 8],
    ["sep", 9], ["sept", 9], ["september", 9],
    ["oct", 10], ["october", 10],
    ["nov", 11], ["november", 11],
    ["dec", 12], ["december", 12],
  ]);

  const normalizeWeeklyValues = (values = []) =>
    Array.from(
      new Set(
        values
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      )
    ).sort((a, b) => a - b);

  const normalizeMonthlyValues = (input) =>
    Array.from(
      new Set(
        (Array.isArray(input) ? input : String(input || "").split(","))
          .map((value) => Number.parseInt(String(value).trim(), 10))
          .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31)
      )
    ).sort((a, b) => a - b);

  const normalizeYearlyValues = (values = []) =>
    Array.from(
      new Set(
        values
          .map((value) => String(value || "").trim())
          .filter((value) => /^\d{2}-\d{2}$/.test(value))
      )
    ).sort();

  const parseWeeklyToken = (token) => {
    const normalized = String(token || "").trim().toLowerCase().replace(/\./g, "");
    if (!normalized) return null;
    const exact = WEEKDAY_OPTIONS.find((item) => item.label.toLowerCase() === normalized);
    if (exact) return exact.value;
    const partial = WEEKDAY_OPTIONS.find((item) => item.label.toLowerCase().startsWith(normalized));
    return partial ? partial.value : null;
  };

  const parseMonthlyToken = (token) => {
    const value = Number.parseInt(String(token || "").trim(), 10);
    return Number.isInteger(value) && value >= 1 && value <= 31 ? value : null;
  };

  const parseYearlyToken = (token) => {
    const normalized = String(token || "").trim().toLowerCase().replace(/,/g, "");
    if (!normalized) return null;

    let match = normalized.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (match) {
      const month = Number(match[1]);
      const day = Number(match[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    match = normalized.match(/^([a-z]+)\s+(\d{1,2})$/);
    if (match) {
      const month = MONTH_NAME_LOOKUP.get(match[1]);
      const day = Number(match[2]);
      if (month && day >= 1 && day <= 31) {
        return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    return null;
  };

  const formatYearlyDisplay = (value) => {
    const [month, day] = String(value || "").split("-").map(Number);
    if (!month || !day) return String(value || "");
    return new Date(Date.UTC(2026, month - 1, day, 12, 0, 0)).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

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
  const closeFloatingMenus = () => {
    els.weekdayMenu?.classList.add("hidden");
    els.monthdayMenu?.classList.add("hidden");
    els.yearlyMenu?.classList.add("hidden");
    if (els.floatingMenus) els.floatingMenus.setAttribute("aria-hidden", "true");
  };

  const positionFloatingMenu = (menu) => {
    if (!menu || !els.ruleAddBtn) return;
    const rect = els.ruleAddBtn.getBoundingClientRect();
    const viewportPad = 8;
    const desiredTop = rect.bottom + 6;
    const menuWidth = menu.offsetWidth || 220;
    const menuHeight = menu.offsetHeight || 248;
    const desiredLeft = rect.right - menuWidth;
    const maxLeft = window.innerWidth - menuWidth - viewportPad;
    const clampedLeft = Math.max(viewportPad, Math.min(desiredLeft, maxLeft));
    const maxTop = window.innerHeight - menuHeight - viewportPad;
    const clampedTop = Math.max(viewportPad, Math.min(desiredTop, maxTop));
    menu.style.top = `${clampedTop}px`;
    menu.style.left = `${clampedLeft}px`;
  };

  const openFloatingMenu = (menu) => {
    if (!menu) return;
    closeFloatingMenus();
    menu.classList.remove("hidden");
    if (els.floatingMenus) els.floatingMenus.setAttribute("aria-hidden", "false");
    positionFloatingMenu(menu);
  };

  const hideModal = () => {
    recurringModal?.classList.add("hidden");
    closeFloatingMenus();
  };

  const buildMonthdayMenu = () => {
    if (!els.monthdayMenu || els.monthdayMenu.childElementCount) return;
    for (let day = 1; day <= 31; day += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.monthday = String(day);
      button.textContent = String(day);
      els.monthdayMenu.appendChild(button);
    }
  };

  const daysForYearlyMonth = (month) => {
    const monthNumber = Number.parseInt(String(month || "1"), 10);
    if (monthNumber === 2) return 29;
    if ([4, 6, 9, 11].includes(monthNumber)) return 30;
    return 31;
  };

  const renderYearlyDayList = () => {
    if (!els.yearlyDayList) return;
    const maxDays = daysForYearlyMonth(selectedYearlyMonth);
    els.yearlyDayList.innerHTML = "";
    for (let day = 1; day <= maxDays; day += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.yearDay = String(day).padStart(2, "0");
      button.textContent = String(day);
      els.yearlyDayList.appendChild(button);
    }
  };

  const setSelectedYearlyMonth = (month) => {
    selectedYearlyMonth = String(month || "01").padStart(2, "0");
    els.yearlyMonthList?.querySelectorAll("[data-year-month]").forEach((button) => {
      button.classList.toggle("is-selected", button.getAttribute("data-year-month") === selectedYearlyMonth);
    });
    renderYearlyDayList();
  };

  const renderCategoryOptions = (selectedValue = "") => {
    if (!els.category) return;
    const type = els.type?.value || "expense";
    const options = type === "income" ? incomeCategoryOptions : expenseCategoryOptions;

    els.category.innerHTML = '<option value="" disabled selected>Select a category</option>';
    options.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      els.category.appendChild(option);
    });

    if (selectedValue && options.includes(selectedValue)) {
      els.category.value = selectedValue;
    } else {
      els.category.value = "";
    }
  };

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

    expenseCategoryOptions = uniq([...EXPENSE_CATEGORIES, ...customExpense]);
    incomeCategoryOptions = uniq([...INCOME_CATEGORIES, ...customIncome]);
    renderCategoryOptions(els.category?.value || "");
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

  const formatRuleSummary = (item) => {
    const frequency = String(item?.frequency || "").toLowerCase();
    const values = Array.isArray(item?.recurrenceValues) ? item.recurrenceValues : [];
    if (frequency === "weekly") return values.map(weekdayLabel).join(", ");
    if (frequency === "monthly") return values.join(", ");
    if (frequency === "yearly") return values.map(formatYearlyDisplay).join(", ");
    return item?.recurrenceLabel || "";
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
          <div>${item.frequency || "monthly"} · ${formatRuleSummary(item) || "Schedule not set"}</div>
          <div>next ${formatDate(item.nextRun)} · ${formatMoney(item.amount)}</div>
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
      const items = Array.isArray(list) ? list : list?.items || list?.data || [];
      renderList(items);

      const upcomingRes = await api.recurring.upcoming({ days: 30 });
      const upcoming = Array.isArray(upcomingRes)
        ? upcomingRes
        : upcomingRes?.items || upcomingRes?.data || [];
      renderUpcoming(upcoming);
    } catch (err) {
      showStatus(`Failed to load recurring items: ${err?.message || "Unknown error"}`, "error");
      renderUpcoming([]);
    }
  };

  const renderSelectedRuleValues = () => {
    if (!els.ruleSelected) return;
    const frequency = els.frequency?.value || "monthly";
    els.ruleSelected.innerHTML = "";

    if (!selectedRuleValues.length) {
      els.ruleSelected.textContent =
        frequency === "weekly"
          ? "Enter one or more weekdays separated by commas or use + to add weekdays."
          : frequency === "monthly"
            ? "Enter one or more month days separated by commas or use + to add days."
            : "Enter one or more yearly dates separated by commas or use + to add dates.";
      return;
    }

    selectedRuleValues.forEach((value) => {
      const chip = document.createElement("span");
      chip.className = "recurring-rule-chip";

      const label = document.createElement("span");
      label.textContent =
        frequency === "weekly"
          ? weekdayLabel(value)
          : frequency === "yearly"
            ? formatYearlyDisplay(value)
            : String(value);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "recurring-rule-chip__remove";
      removeBtn.setAttribute("aria-label", `Remove ${label.textContent}`);
      removeBtn.textContent = "x";
      removeBtn.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedRuleValues = selectedRuleValues.filter((entry) => String(entry) !== String(value));
        syncRuleInput();
      });

      chip.appendChild(label);
      chip.appendChild(removeBtn);
      els.ruleSelected.appendChild(chip);
    });
  };

  const syncRuleInput = () => {
    if (els.ruleInput) els.ruleInput.value = "";
    renderSelectedRuleValues();
  };

  const commitRuleTokensFromInput = ({ finalizeAll = false } = {}) => {
    if (!els.ruleInput) return;
    const frequency = els.frequency?.value || "monthly";
    const raw = String(els.ruleInput.value || "");
    const hasComma = raw.includes(",");
    if (!hasComma && !finalizeAll) return;

    const tokens = raw
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

    const trailingComplete = raw.trim().endsWith(",");
    const tokensToCommit = finalizeAll || trailingComplete ? tokens : tokens.slice(0, -1);
    const remainingTokens = finalizeAll || trailingComplete ? [] : tokens.slice(-1);

    if (tokensToCommit.length) {
      if (frequency === "weekly") {
        const parsed = tokensToCommit.map(parseWeeklyToken).filter((value) => value !== null);
        selectedRuleValues = normalizeWeeklyValues([...selectedRuleValues, ...parsed]);
      } else if (frequency === "monthly") {
        const parsed = tokensToCommit.map(parseMonthlyToken).filter((value) => value !== null);
        selectedRuleValues = normalizeMonthlyValues([...selectedRuleValues, ...parsed]);
      } else {
        const parsed = tokensToCommit.map(parseYearlyToken).filter(Boolean);
        selectedRuleValues = normalizeYearlyValues([...selectedRuleValues, ...parsed]);
      }
    }

    els.ruleInput.value = remainingTokens.join(", ");
    renderSelectedRuleValues();
  };

  const syncRuleUiForFrequency = (resetValues = false) => {
    const frequency = els.frequency?.value || "monthly";
    if (resetValues) selectedRuleValues = [];

    closeFloatingMenus();

    if (frequency === "weekly") {
      if (els.ruleLabel) els.ruleLabel.textContent = "Days of week";
      if (els.ruleInput) {
        els.ruleInput.classList.remove("hidden");
        els.ruleInput.placeholder = "Type weekdays like monday, wed";
        els.ruleInput.readOnly = false;
      }
      els.ruleAddBtn?.classList.remove("hidden");
    } else if (frequency === "monthly") {
      if (els.ruleLabel) els.ruleLabel.textContent = "Days of month";
      if (els.ruleInput) {
        els.ruleInput.classList.remove("hidden");
        els.ruleInput.placeholder = "Type days like 1, 15, 31";
        els.ruleInput.readOnly = false;
      }
      els.ruleAddBtn?.classList.remove("hidden");
    } else {
      if (els.ruleLabel) els.ruleLabel.textContent = "Dates each year";
      if (els.ruleInput) {
        els.ruleInput.classList.remove("hidden");
        els.ruleInput.placeholder = "Type dates like Sep 15, 12/25";
        els.ruleInput.readOnly = false;
      }
      els.ruleAddBtn?.classList.remove("hidden");
      setSelectedYearlyMonth(selectedYearlyMonth);
    }

    syncRuleInput();
  };

  const resetForm = () => {
    recurringForm?.reset();
    recurringForm?.setAttribute("data-edit-id", "");
    selectedRuleValues = [];
    if (els.active) els.active.checked = true;
    if (els.frequency) els.frequency.value = "monthly";
    renderCategoryOptions("");
    syncRuleUiForFrequency();
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
    renderCategoryOptions(item.category || "");
    if (els.note) els.note.value = item.note || "";
    if (els.frequency) els.frequency.value = item.frequency || "monthly";
    selectedRuleValues = Array.isArray(item.recurrenceValues) ? [...item.recurrenceValues] : [];
    if (els.frequency?.value === "yearly" && selectedRuleValues.length) {
      selectedYearlyMonth = String(selectedRuleValues[0]).split("-")[0] || "01";
    }
    if (els.startDate) els.startDate.value = item.startDate || "";
    if (els.endDate) els.endDate.value = item.endDate || "";
    if (els.active) els.active.checked = item.active !== false;
    syncRuleUiForFrequency();
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

  els.frequency?.addEventListener("change", () => syncRuleUiForFrequency(true));
  els.type?.addEventListener("change", () => renderCategoryOptions(""));

  els.ruleInput?.addEventListener("input", () => {
    if (els.ruleInput.classList.contains("hidden")) return;
    commitRuleTokensFromInput();
  });

  els.ruleInput?.addEventListener("keydown", (event) => {
    if (els.ruleInput.classList.contains("hidden")) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitRuleTokensFromInput({ finalizeAll: true });
  });

  els.ruleInput?.addEventListener("blur", () => {
    if (els.ruleInput.classList.contains("hidden")) return;
    commitRuleTokensFromInput({ finalizeAll: true });
  });

  els.ruleAddBtn?.addEventListener("click", () => {
    const frequency = els.frequency?.value || "monthly";
    if (frequency === "weekly") {
      if (els.weekdayMenu?.classList.contains("hidden")) openFloatingMenu(els.weekdayMenu);
      else closeFloatingMenus();
      return;
    }
    if (frequency === "monthly") {
      if (els.monthdayMenu?.classList.contains("hidden")) openFloatingMenu(els.monthdayMenu);
      else closeFloatingMenus();
      return;
    }
    if (frequency === "yearly") {
      if (els.yearlyMenu?.classList.contains("hidden")) {
        setSelectedYearlyMonth(selectedYearlyMonth);
        openFloatingMenu(els.yearlyMenu);
      } else {
        closeFloatingMenus();
      }
    }
  });

  els.weekdayMenu?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-weekday]");
    if (!button) return;
    const value = Number.parseInt(String(button.dataset.weekday || ""), 10);
    if (!Number.isInteger(value)) return;
    if (selectedRuleValues.includes(value)) {
      selectedRuleValues = selectedRuleValues.filter((entry) => entry !== value);
    } else {
      selectedRuleValues = normalizeWeeklyValues([...selectedRuleValues, value]);
    }
    syncRuleInput();
  });

  els.monthdayMenu?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-monthday]");
    if (!button) return;
    const value = Number.parseInt(String(button.dataset.monthday || ""), 10);
    if (!Number.isInteger(value)) return;
    if (selectedRuleValues.includes(value)) {
      selectedRuleValues = selectedRuleValues.filter((entry) => entry !== value);
    } else {
      selectedRuleValues = normalizeMonthlyValues([...selectedRuleValues, value]);
    }
    syncRuleInput();
  });

  els.yearlyMonthList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-year-month]");
    if (!button) return;
    setSelectedYearlyMonth(button.getAttribute("data-year-month") || "01");
  });

  els.yearlyDayList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-year-day]");
    if (!button) return;
    const value = `${selectedYearlyMonth}-${button.getAttribute("data-year-day") || "01"}`;
    selectedRuleValues = normalizeYearlyValues([...selectedRuleValues, value]);
    syncRuleInput();
    closeFloatingMenus();
  });

  document.addEventListener("click", (event) => {
    if (
      !event.target.closest(".recurring-rule-input") &&
      !event.target.closest(".recurring-rule-menu") &&
      !event.target.closest(".recurring-yearly-menu")
    ) {
      closeFloatingMenus();
    }
  });

  window.addEventListener("resize", () => {
    if (els.weekdayMenu && !els.weekdayMenu.classList.contains("hidden")) positionFloatingMenu(els.weekdayMenu);
    if (els.monthdayMenu && !els.monthdayMenu.classList.contains("hidden")) positionFloatingMenu(els.monthdayMenu);
    if (els.yearlyMenu && !els.yearlyMenu.classList.contains("hidden")) positionFloatingMenu(els.yearlyMenu);
  });

  window.addEventListener("scroll", () => {
    if (els.weekdayMenu && !els.weekdayMenu.classList.contains("hidden")) positionFloatingMenu(els.weekdayMenu);
    if (els.monthdayMenu && !els.monthdayMenu.classList.contains("hidden")) positionFloatingMenu(els.monthdayMenu);
    if (els.yearlyMenu && !els.yearlyMenu.classList.contains("hidden")) positionFloatingMenu(els.yearlyMenu);
  }, true);

  recurringForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearStatus();
    commitRuleTokensFromInput({ finalizeAll: true });

    const frequency = els.frequency?.value || "monthly";
    const recurrenceValues =
      frequency === "weekly"
        ? normalizeWeeklyValues(selectedRuleValues)
        : frequency === "monthly"
          ? normalizeMonthlyValues(selectedRuleValues)
          : normalizeYearlyValues(selectedRuleValues);

    const payload = {
      name: els.name?.value?.trim(),
      type: els.type?.value,
      amount: Number(els.amount?.value),
      category: els.category?.value,
      note: els.note?.value?.trim() || "",
      frequency,
      dayOfMonth: frequency === "monthly" && recurrenceValues.length ? Number(recurrenceValues[0]) : null,
      recurrenceValues,
      startDate: els.startDate?.value,
      endDate: els.endDate?.value || null,
      active: els.active?.checked !== false,
    };

    if (!payload.name || !payload.category || !payload.startDate || !Number.isFinite(payload.amount)) {
      showStatus("Please fill out name, category, amount, and start date.", "error");
      return;
    }

    if (!payload.recurrenceValues.length) {
      showStatus(
        frequency === "weekly"
          ? "Select at least one weekday."
          : frequency === "monthly"
            ? "Enter at least one day of month."
            : "Select at least one yearly date.",
        "error"
      );
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
    buildMonthdayMenu();
    setSelectedYearlyMonth(selectedYearlyMonth);
    syncRuleUiForFrequency();
    prefillFromQuery();
    loadData();
  });
});

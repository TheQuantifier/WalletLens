import { api } from "./api.js";
import { loadRules, saveRules, summarizeRule } from "./rules-engine.js";

document.addEventListener("DOMContentLoaded", () => {
  const ONBOARDING_KEY = "rules_onboarding_seen_v1";
  const rulesList = document.getElementById("rulesList");
  const rulesEmpty = document.getElementById("rulesEmpty");
  const rulesStatus = document.getElementById("rulesStatus");
  const btnCreateRule = document.getElementById("btnCreateRule");
  const btnCreateRuleEmpty = document.getElementById("btnCreateRuleEmpty");
  const btnApplyRules = document.getElementById("btnApplyRules");

  const ruleModal = document.getElementById("ruleModal");
  const rulesOnboardingModal = document.getElementById("rulesOnboardingModal");
  const rulesOnboardingClose = document.getElementById("rulesOnboardingClose");
  const ruleForm = document.getElementById("ruleForm");
  const ruleModalTitle = document.getElementById("ruleModalTitle");
  const ruleCancelBtn = document.getElementById("ruleCancelBtn");
  const ruleSaveBtn = document.getElementById("ruleSaveBtn");

  const els = {
    name: document.getElementById("ruleName"),
    priority: document.getElementById("rulePriority"),
    applyMode: document.getElementById("ruleApplyMode"),
    enabled: document.getElementById("ruleEnabled"),
    type: document.getElementById("ruleType"),
    category: document.getElementById("ruleCategory"),
    noteContains: document.getElementById("ruleNoteContains"),
    origin: document.getElementById("ruleOrigin"),
    amountMin: document.getElementById("ruleAmountMin"),
    amountMax: document.getElementById("ruleAmountMax"),
    actionCategory: document.getElementById("actionCategory"),
    actionTag: document.getElementById("actionTag"),
  };

  let rules = [];

  const showStatus = (msg, kind = "ok") => {
    if (!rulesStatus) return;
    rulesStatus.textContent = msg;
    rulesStatus.classList.remove("is-hidden");
    rulesStatus.classList.toggle("is-ok", kind === "ok");
    rulesStatus.classList.toggle("is-error", kind === "error");
  };

  const clearStatus = () => {
    if (!rulesStatus) return;
    rulesStatus.classList.add("is-hidden");
    rulesStatus.textContent = "";
    rulesStatus.classList.remove("is-ok", "is-error");
  };

  const showModal = () => ruleModal?.classList.remove("hidden");
  const hideModal = () => ruleModal?.classList.add("hidden");
  const showOnboarding = () => rulesOnboardingModal?.classList.remove("hidden");
  const hideOnboarding = () => rulesOnboardingModal?.classList.add("hidden");

  const getRulePayload = () => {
    const conditions = [];
    if (els.type?.value && els.type.value !== "any") {
      conditions.push({ field: "type", op: "equals", value: els.type.value });
    }
    if (els.category?.value) {
      conditions.push({ field: "category", op: "equals", value: els.category.value });
    }
    if (els.noteContains?.value) {
      conditions.push({ field: "note", op: "contains", value: els.noteContains.value });
    }
    if (els.origin?.value && els.origin.value !== "any") {
      conditions.push({ field: "origin", op: "equals", value: els.origin.value });
    }

    const min = els.amountMin?.value;
    const max = els.amountMax?.value;
    if (min || max) {
      conditions.push({ field: "amount", op: "between", value: { min, max } });
    }

    const actions = [];
    if (els.actionCategory?.value) {
      actions.push({ type: "setCategory", value: els.actionCategory.value });
    }
    if (els.actionTag?.value) {
      actions.push({ type: "appendNote", value: els.actionTag.value });
    }

    return {
      name: els.name?.value?.trim() || "",
      enabled: !!els.enabled?.checked,
      priority: Number(els.priority?.value || 100),
      applyMode: els.applyMode?.value || "first",
      conditions,
      actions,
    };
  };

  const setSaving = (saving) => {
    if (!ruleSaveBtn) return;
    ruleSaveBtn.disabled = saving;
    ruleSaveBtn.textContent = saving ? "Saving..." : "Save Rule";
  };

  const setApplying = (saving) => {
    if (!btnApplyRules) return;
    btnApplyRules.disabled = saving;
    btnApplyRules.textContent = saving ? "Applying..." : "Apply To Existing";
  };

  const renderRules = () => {
    if (!rulesList) return;

    rulesList.innerHTML = "";
    if (!rules.length) {
      rulesEmpty?.classList.remove("is-hidden");
      return;
    }

    rulesEmpty?.classList.add("is-hidden");

    rules.forEach((rule) => {
      const card = document.createElement("div");
      card.className = "rule-card";

      const pill = document.createElement("span");
      pill.className = "rule-pill";
      pill.textContent = rule.enabled === false ? "Disabled" : "Enabled";

      const header = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = rule.name || "Untitled Rule";
      header.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "rule-meta";
      meta.textContent = summarizeRule(rule) || "No details";

      const toggle = document.createElement("label");
      toggle.className = "rule-toggle";
      const toggleInput = document.createElement("input");
      toggleInput.type = "checkbox";
      toggleInput.checked = rule.enabled !== false;
      toggleInput.addEventListener("change", async () => {
        try {
          const updated = await api.rules.update(rule.id, { enabled: toggleInput.checked });
          rules = rules.map((item) => (item.id === rule.id ? updated : item));
          renderRules();
        } catch (err) {
          toggleInput.checked = rule.enabled !== false;
          showStatus(`Failed to update rule: ${err?.message || "Unknown error"}`, "error");
        }
      });
      toggle.appendChild(toggleInput);
      toggle.appendChild(document.createTextNode("Enabled"));

      const actions = document.createElement("div");
      actions.className = "rule-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "btn";
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEdit(rule));

      const delBtn = document.createElement("button");
      delBtn.className = "btn";
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!confirm("Delete this rule?")) return;
        try {
          await api.rules.remove(rule.id);
          rules = rules.filter((item) => item.id !== rule.id);
          renderRules();
          showStatus("Rule deleted.");
        } catch (err) {
          showStatus(`Failed to delete rule: ${err?.message || "Unknown error"}`, "error");
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      card.appendChild(pill);
      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(toggle);
      card.appendChild(actions);
      rulesList.appendChild(card);
    });
  };

  const resetForm = () => {
    ruleForm?.reset();
    if (els.priority) els.priority.value = "100";
    if (els.applyMode) els.applyMode.value = "first";
    if (els.enabled) els.enabled.checked = true;
    ruleForm?.setAttribute("data-edit-id", "");
  };

  const openCreate = () => {
    resetForm();
    if (ruleModalTitle) ruleModalTitle.textContent = "Create Rule";
    clearStatus();
    showModal();
  };

  const openEdit = (rule) => {
    resetForm();
    if (ruleModalTitle) ruleModalTitle.textContent = "Edit Rule";
    ruleForm?.setAttribute("data-edit-id", rule.id || "");
    if (els.name) els.name.value = rule.name || "";
    if (els.priority) els.priority.value = String(rule.priority || 100);
    if (els.applyMode) els.applyMode.value = rule.applyMode || "first";
    if (els.enabled) els.enabled.checked = rule.enabled !== false;

    (rule.conditions || []).forEach((condition) => {
      if (condition.field === "type" && els.type) els.type.value = condition.value || "any";
      if (condition.field === "category" && els.category) els.category.value = condition.value || "";
      if (condition.field === "note" && els.noteContains) els.noteContains.value = condition.value || "";
      if (condition.field === "origin" && els.origin) els.origin.value = condition.value || "any";
      if (condition.field === "amount") {
        if (condition.value?.min !== undefined && els.amountMin) {
          els.amountMin.value = condition.value.min;
        }
        if (condition.value?.max !== undefined && els.amountMax) {
          els.amountMax.value = condition.value.max;
        }
      }
    });

    (rule.actions || []).forEach((action) => {
      if (action.type === "setCategory" && els.actionCategory) {
        els.actionCategory.value = action.value || "";
      }
      if (action.type === "appendNote" && els.actionTag) {
        els.actionTag.value = action.value || "";
      }
    });

    clearStatus();
    showModal();
  };

  const prefillFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("prefill")) return;

    openCreate();
    const type = params.get("type");
    const category = params.get("category");
    const note = params.get("note");
    const amount = params.get("amount");
    const origin = params.get("origin");

    if (type && els.type) els.type.value = type;
    if (category && els.category) els.category.value = category;
    if (note && els.noteContains) els.noteContains.value = note;
    if (origin && els.origin) els.origin.value = origin;
    if (amount && els.amountMin) els.amountMin.value = amount;

    if (els.name) {
      const trimmedNote = note ? note.slice(0, 24) : "record";
      els.name.value = `Auto: ${category || "category"} for ${trimmedNote}`;
    }
  };

  const populateCategoryOptions = async () => {
    let categories = [];
    try {
      const data = await api.records.categories();
      categories = Array.from(new Set([...(data?.expense || []), ...(data?.income || [])]));
    } catch {
      categories = [];
    }

    const fill = (select, emptyLabel) => {
      if (!select) return;
      select.innerHTML = "";

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = emptyLabel;
      select.appendChild(emptyOption);

      categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
      });
    };

    fill(els.category, "Any");
    fill(els.actionCategory, "No change");
  };

  const migrateLegacyRules = async () => {
    const legacyRules = loadRules();
    if (!legacyRules.length || rules.length) return;

    let migrated = 0;
    for (const legacyRule of legacyRules) {
      try {
        const created = await api.rules.create({
          name: legacyRule.name,
          enabled: legacyRule.enabled !== false,
          priority: Number(legacyRule.priority || 100),
          applyMode: legacyRule.applyMode || "first",
          conditions: Array.isArray(legacyRule.conditions) ? legacyRule.conditions : [],
          actions: Array.isArray(legacyRule.actions) ? legacyRule.actions : [],
        });
        rules.push(created);
        migrated += 1;
      } catch (err) {
        showStatus(`Legacy rule migration failed: ${err?.message || "Unknown error"}`, "error");
        return;
      }
    }

    saveRules([]);
    if (migrated) {
      showStatus(`Migrated ${migrated} legacy rule${migrated === 1 ? "" : "s"} to your account.`);
    }
  };

  const loadRemoteRules = async () => {
    rules = await api.rules.getAll();
    await migrateLegacyRules();
    rules = await api.rules.getAll();
    renderRules();
  };

  ruleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearStatus();

    const payload = getRulePayload();
    if (!payload.name) {
      showStatus("Please enter a rule name.", "error");
      return;
    }
    if (!payload.conditions.length) {
      showStatus("Add at least one condition.", "error");
      return;
    }
    if (!payload.actions.length) {
      showStatus("Add at least one action.", "error");
      return;
    }

    const editId = ruleForm?.getAttribute("data-edit-id");

    try {
      setSaving(true);
      const savedRule = editId
        ? await api.rules.update(editId, payload)
        : await api.rules.create(payload);

      rules = editId
        ? rules.map((rule) => (rule.id === editId ? savedRule : rule))
        : [...rules, savedRule].sort((a, b) => {
            const priorityDiff = Number(b?.priority || 0) - Number(a?.priority || 0);
            if (priorityDiff !== 0) return priorityDiff;
            return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
          });

      hideModal();
      renderRules();
      showStatus(editId ? "Rule updated." : "Rule created.");
    } catch (err) {
      showStatus(`Failed to save rule: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  });

  ruleCancelBtn?.addEventListener("click", () => hideModal());
  btnCreateRule?.addEventListener("click", openCreate);
  btnCreateRuleEmpty?.addEventListener("click", openCreate);
  rulesOnboardingClose?.addEventListener("click", () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    hideOnboarding();
  });
  btnApplyRules?.addEventListener("click", async () => {
    clearStatus();
    if (!rules.length) {
      showStatus("No rules to apply.", "error");
      return;
    }
    if (!confirm("Apply all rules to existing records? This may update categories and notes.")) {
      return;
    }

    try {
      setApplying(true);
      const result = await api.rules.applyAll();
      const updatedCount = Number(result?.updatedCount || 0);
      showStatus(`Applied rules to ${updatedCount} record${updatedCount === 1 ? "" : "s"}.`);
    } catch (err) {
      showStatus(`Failed to apply rules: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setApplying(false);
    }
  });

  (async () => {
    try {
      await populateCategoryOptions();
      await loadRemoteRules();
      prefillFromQuery();
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        showOnboarding();
      }
    } catch (err) {
      showStatus(`Failed to load rules: ${err?.message || "Unknown error"}`, "error");
    }
  })();
});

import { useEffect, useMemo, useState } from "react";
import { api } from "../../scripts/api.js";
import { exportSheets, getPreferredExportFormat } from "../../scripts/export-utils.js";

const PAGE_SIZE = 1000;
const EMPTY_FILTERS = {
  q: "",
  category: "",
  minDate: "",
  maxDate: "",
  minAmt: "",
  maxAmt: "",
  pageSize: "10",
};

const EXPENSE_DEFAULTS = [
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

const INCOME_DEFAULTS = [
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

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function loadAllRecords() {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const payload = await api.records.getAll({ limit: PAGE_SIZE, offset });
    const rows = rowsFromPayload(payload);
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeList(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = normalizeName(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mergeCategories(defaults, custom, records, type) {
  const seen = new Set();
  return [...defaults, ...custom, ...records.filter((r) => r.type === type).map((r) => r.category)]
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = normalizeName(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const ai = defaults.findIndex((name) => normalizeName(name) === normalizeName(a));
      const bi = defaults.findIndex((name) => normalizeName(name) === normalizeName(b));
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.localeCompare(b);
    });
}

function recordId(record) {
  return record?.id ?? record?._id ?? "";
}

function linkedReceiptId(record) {
  return record?.linkedReceiptId ?? record?.linked_receipt_id ?? "";
}

function linkedRecurringId(record) {
  return record?.linkedRecurringId ?? record?.linked_recurring_id ?? "";
}

function linkedPlaidAccountId(record) {
  return record?.linkedPlaidAccountId ?? record?.linked_plaid_account_id ?? "";
}

function recordOrigin(record) {
  return String(
    record?.origin ||
      (linkedReceiptId(record)
        ? "receipt"
        : linkedRecurringId(record)
          ? "recurring"
          : linkedPlaidAccountId(record)
            ? "plaid"
            : "manual")
  ).toLowerCase();
}

function toDateOnly(value) {
  if (!value) return "";
  if (typeof value === "string") return value.split("T")[0];
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function fmtDate(value) {
  const dateOnly = toDateOnly(value);
  if (!dateOnly) return "-";
  return new Date(`${dateOnly}T00:00:00Z`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function fmtMoney(value, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
    }).format(Number(value) || 0);
  } catch {
    return `$${(Number(value) || 0).toFixed(2)}`;
  }
}

function getSortValue(record, key) {
  if (key === "date") return record.date ? Date.parse(`${toDateOnly(record.date)}T00:00:00Z`) : 0;
  if (key === "amount") return Number(record.amount || 0);
  if (key === "category") return normalizeText(record.category);
  if (key === "type") return normalizeText(record.type);
  if (key === "note") return normalizeText(record.note);
  if (key === "origin") return recordOrigin(record);
  return "";
}

function buildSearchHaystack(record) {
  const amount = Number(record.amount || 0);
  return [
    record.type,
    record.category,
    record.note,
    recordOrigin(record),
    toDateOnly(record.date),
    fmtDate(record.date),
    String(amount),
    amount.toFixed(2),
  ]
    .map(normalizeText)
    .join(" ");
}

function filterRecords(records, filters) {
  const q = normalizeText(filters.q);
  const minAmt = filters.minAmt === "" ? 0 : Number(filters.minAmt);
  const maxAmt = filters.maxAmt === "" ? Infinity : Number(filters.maxAmt);
  const minTime = filters.minDate ? Date.parse(`${filters.minDate}T00:00:00Z`) : null;
  const maxTime = filters.maxDate ? Date.parse(`${filters.maxDate}T23:59:59Z`) : null;

  return records.filter((record) => {
    const amount = Number(record.amount || 0);
    const time = record.date ? Date.parse(`${toDateOnly(record.date)}T00:00:00Z`) : null;
    return (
      (!q || buildSearchHaystack(record).includes(q)) &&
      (!filters.category || record.category === filters.category) &&
      (!minTime || (time && time >= minTime)) &&
      (!maxTime || (time && time <= maxTime)) &&
      amount >= (Number.isFinite(minAmt) ? minAmt : 0) &&
      amount <= (Number.isFinite(maxAmt) ? maxAmt : Infinity)
    );
  });
}

function sortRecords(records, sort) {
  if (!sort?.key || !sort?.dir) return records;
  const dir = sort.dir === "desc" ? -1 : 1;
  return [...records].sort((a, b) => {
    const av = getSortValue(a, sort.key);
    const bv = getSortValue(b, sort.key);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function originBadge(record) {
  const origin = recordOrigin(record);
  if (origin === "receipt") return { className: "badge badge-receipt", label: "Receipt" };
  if (origin === "recurring") return { className: "badge badge-recurring", label: "Recurring" };
  if (origin === "plaid") return { className: "badge badge-recurring", label: "Plaid" };
  return { className: "badge badge-manual", label: "Manual" };
}

function navigateTo(path) {
  if (window.__walletlensNavigate) window.__walletlensNavigate(path);
  else window.location.href = path;
}

function receiptItems(receipt) {
  const rawItems = receipt?.items ?? receipt?.parsed_data?.items ?? receipt?.parsedData?.items ?? [];
  return (Array.isArray(rawItems) ? rawItems : []).map((item, index) => ({
    name: String(item?.name ?? item?.description ?? item?.title ?? `Item ${index + 1}`).trim(),
    price: Number(item?.price ?? item?.amount ?? item?.total ?? item?.value ?? 0) || 0,
  }));
}

function taxAmount(receipt) {
  return Number(
    receipt?.tax_amount ?? receipt?.taxAmount ?? receipt?.parsed_data?.taxAmount ?? receipt?.parsedData?.taxAmount ?? 0
  ) || 0;
}

function SortButton({ type, field, label, numeric, sort, onSort }) {
  let arrow = "↕";
  if (sort.key === field) arrow = sort.dir === "asc" ? "↑" : "↓";
  return (
    <button
      type="button"
      className={`records-sort-btn${numeric ? " records-sort-btn--num" : ""}`}
      onClick={() => onSort(type, field)}
    >
      {label} <span className="sort-arrow">{arrow}</span>
    </button>
  );
}

function RecordsTable({
  type,
  title,
  description,
  filters,
  page,
  sort,
  rows,
  categories,
  loading,
  onFilterChange,
  onClearFilters,
  onPageChange,
  onSort,
  onOpenForm,
  onExport,
  onEdit,
  onDelete,
  onViewReceipt,
}) {
  const pageSize = Number(filters.pageSize) || 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section className="records-section">
      <div className="records-header">
        <div className="records-title">
          <h1>{title}</h1>
          <p className="subtle">{description}</p>
        </div>
        <div className="records-actions">
          <button className="btn" type="button" onClick={() => onOpenForm(type)}>
            Add {type === "expense" ? "Expense" : "Income"}
          </button>
          <button className="btn btn--primary" type="button" onClick={() => onExport(type)} disabled={!rows.length}>
            Export
          </button>
        </div>
      </div>

      <div className="card records-subsection">
        <form onSubmit={(event) => event.preventDefault()}>
          <div className="records-filters-grid">
            <label>
              <span>Search</span>
              <input
                type="text"
                value={filters.q}
                onChange={(event) => onFilterChange(type, "q", event.target.value)}
                placeholder="Category or note..."
                autoComplete="off"
              />
            </label>
            <label>
              <span>Category</span>
              <select value={filters.category} onChange={(event) => onFilterChange(type, "category", event.target.value)}>
                <option value="">All</option>
                {categories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Min Date</span>
              <input type="date" value={filters.minDate} onChange={(event) => onFilterChange(type, "minDate", event.target.value)} />
            </label>
            <label>
              <span>Max Date</span>
              <input type="date" value={filters.maxDate} onChange={(event) => onFilterChange(type, "maxDate", event.target.value)} />
            </label>
            <label>
              <span>Min Amount</span>
              <input
                type="number"
                value={filters.minAmt}
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                onChange={(event) => onFilterChange(type, "minAmt", event.target.value)}
              />
            </label>
            <label>
              <span>Max Amount</span>
              <input
                type="number"
                value={filters.maxAmt}
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="9999.99"
                onChange={(event) => onFilterChange(type, "maxAmt", event.target.value)}
              />
            </label>
            <label>
              <span>Rows per page</span>
              <select value={filters.pageSize} onChange={(event) => onFilterChange(type, "pageSize", event.target.value)}>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
          <div className="flex" style={{ gap: "1rem" }}>
            <button type="submit" className="btn btn--primary">
              Apply
            </button>
            <button type="button" className="btn btn--link" onClick={() => onClearFilters(type)}>
              Clear
            </button>
          </div>
        </form>
      </div>

      <div className="records-table records-subsection">
        <div className="table-wrap card">
          <table className="txn-table">
            <thead>
              <tr>
                <th><SortButton type={type} field="date" label="Date" sort={sort} onSort={onSort} /></th>
                <th><SortButton type={type} field="type" label="Type" sort={sort} onSort={onSort} /></th>
                <th><SortButton type={type} field="category" label="Category" sort={sort} onSort={onSort} /></th>
                <th className="num"><SortButton type={type} field="amount" label="Amount" numeric sort={sort} onSort={onSort} /></th>
                <th><SortButton type={type} field="note" label="Note" sort={sort} onSort={onSort} /></th>
                <th><SortButton type={type} field="origin" label="Origin" sort={sort} onSort={onSort} /></th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody aria-live="polite">
              {loading ? (
                <tr><td colSpan="7" className="subtle">Loading...</td></tr>
              ) : visible.length ? (
                visible.map((record) => {
                  const badge = originBadge(record);
                  const id = recordId(record);
                  return (
                    <tr key={id || `${record.type}-${record.date}-${record.amount}-${record.note}`}>
                      <td>{fmtDate(record.date)}</td>
                      <td>{record.type || "-"}</td>
                      <td>{record.category || "-"}</td>
                      <td className="num">{fmtMoney(record.amount, record.currency || "USD")}</td>
                      <td>{record.note || "-"}</td>
                      <td><span className={badge.className}>{badge.label}</span></td>
                      <td className="actions-col">
                        <div className="actions-menu-wrap">
                          <details>
                            <summary className="actions-btn" aria-label="Record actions">⋮</summary>
                            <div className="actions-dropdown">
                              <button type="button" onClick={() => onEdit(record)}>Edit Record</button>
                              <button
                                type="button"
                                onClick={() => {
                                  const params = new URLSearchParams({
                                    prefill: "1",
                                    type: record.type || "",
                                    category: record.category || "",
                                    note: record.note || "",
                                    amount: record.amount ?? "",
                                    origin: recordOrigin(record),
                                  });
                                  navigateTo(`/rules?${params.toString()}`);
                                }}
                              >
                                Create Rule
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const params = new URLSearchParams({
                                    prefill: "1",
                                    name: record.note || record.category || "Recurring item",
                                    type: record.type || "expense",
                                    category: record.category || "",
                                    amount: record.amount ?? "",
                                    note: record.note || "",
                                  });
                                  navigateTo(`/recurring?${params.toString()}`);
                                }}
                              >
                                Make Recurring
                              </button>
                              {linkedReceiptId(record) ? (
                                <button type="button" onClick={() => onViewReceipt(record)}>View Items</button>
                              ) : null}
                              <button type="button" style={{ color: "#b91c1c" }} onClick={() => onDelete(record)}>
                                Delete Record
                              </button>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan="7" className="subtle">No matching records.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <nav className="records-pager">
          <button className="btn" type="button" disabled={safePage <= 1} onClick={() => onPageChange(type, safePage - 1)}>
            ← Prev
          </button>
          <span className="subtle">Page {safePage} of {totalPages}</span>
          <button className="btn" type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(type, safePage + 1)}>
            Next →
          </button>
        </nav>
      </div>
    </section>
  );
}

function RecordModal({ state, categories, saving, customCategories, onField, onClose, onSubmit, onCustomCategory }) {
  if (!state.open) return null;
  const typeLabel = state.type === "expense" ? "Expense" : "Income";
  const custom = customCategories[state.type] || [];

  return (
    <div className="modal" onMouseDown={(event) => event.target.classList.contains("modal") && onClose()}>
      <div className="modal-content" onMouseDown={(event) => event.stopPropagation()}>
        <h2>{state.id ? `Edit ${typeLabel}` : `Add New ${typeLabel}`}</h2>
        <form className="txn-form" onSubmit={onSubmit}>
          <div className="form-row">
            <label>
              <span>Date</span>
              <input type="date" value={state.date} onChange={(event) => onField("date", event.target.value)} required />
            </label>
            <label>
              <span>Amount</span>
              <input
                type="number"
                value={state.amount}
                onChange={(event) => onField("amount", event.target.value)}
                step="0.01"
                min="0"
                inputMode="decimal"
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Category</span>
              <select value={state.category} onChange={(event) => onField("category", event.target.value)} required>
                <option value="" disabled>Select a category</option>
                {categories.map((category) => (
                  <option value={category} key={category}>{category}</option>
                ))}
                <option value="__custom__">Add custom category...</option>
              </select>
            </label>
            <div className="custom-category-list" aria-live="polite">
              {custom.map((name) => (
                <div className="custom-category-item" key={name}>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label>
              <span>Notes</span>
              <input type="text" value={state.note} onChange={(event) => onField("note", event.target.value)} autoComplete="off" />
            </label>
          </div>
          <div className="form-row form-row--compact">
            <label className="checkbox-inline">
              <input type="checkbox" checked={state.applyRules} onChange={(event) => onField("applyRules", event.target.checked)} />
              <span>Apply rules to this record</span>
            </label>
          </div>
          {state.error ? <p className="status-banner is-error">{state.error}</p> : null}
          <div className="modal-actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving..." : `Save ${typeLabel}`}
            </button>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RecordsPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ message: "", kind: "ok" });
  const [filters, setFilters] = useState({ expense: EMPTY_FILTERS, income: EMPTY_FILTERS });
  const [pages, setPages] = useState({ expense: 1, income: 1 });
  const [sorts, setSorts] = useState({ expense: { key: "date", dir: "desc" }, income: { key: "date", dir: "desc" } });
  const [categories, setCategories] = useState({ expense: EXPENSE_DEFAULTS, income: INCOME_DEFAULTS });
  const [customCategories, setCustomCategories] = useState({ expense: [], income: [] });
  const [form, setForm] = useState({ open: false });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [receiptModal, setReceiptModal] = useState({ open: false, loading: false, record: null, receipt: null, error: "" });

  const load = async () => {
    setLoading(true);
    try {
      try {
        await api.plaid.sync();
      } catch {
        // Imported account sync is best-effort here.
      }

      const [nextRecords, categoryPayload, me] = await Promise.all([
        loadAllRecords(),
        api.records.categories().catch(() => ({})),
        api.auth.me().catch(() => null),
      ]);

      const nextCustom = {
        expense: normalizeList(me?.user?.custom_expense_categories ?? me?.user?.customExpenseCategories),
        income: normalizeList(me?.user?.custom_income_categories ?? me?.user?.customIncomeCategories),
      };

      setRecords(nextRecords);
      setCustomCategories(nextCustom);
      setCategories({
        expense: mergeCategories(categoryPayload?.expense || EXPENSE_DEFAULTS, nextCustom.expense, nextRecords, "expense"),
        income: mergeCategories(categoryPayload?.income || INCOME_DEFAULTS, nextCustom.income, nextRecords, "income"),
      });
      setStatus({ message: "Records updated.", kind: "ok" });
    } catch (err) {
      setStatus({ message: `Could not load records: ${err?.message || "Unknown error"}`, kind: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!status.message || status.kind === "error") return undefined;
    const t = window.setTimeout(() => setStatus({ message: "", kind: "ok" }), 2500);
    return () => window.clearTimeout(t);
  }, [status]);

  const visibleRecords = useMemo(() => {
    const byType = {
      expense: records.filter((record) => record.type === "expense"),
      income: records.filter((record) => record.type === "income"),
    };
    return {
      expense: sortRecords(filterRecords(byType.expense, filters.expense), sorts.expense),
      income: sortRecords(filterRecords(byType.income, filters.income), sorts.income),
    };
  }, [records, filters, sorts]);

  const onFilterChange = (type, key, value) => {
    setFilters((current) => ({
      ...current,
      [type]: { ...current[type], [key]: value },
    }));
    setPages((current) => ({ ...current, [type]: 1 }));
  };

  const onClearFilters = (type) => {
    setFilters((current) => ({ ...current, [type]: EMPTY_FILTERS }));
    setPages((current) => ({ ...current, [type]: 1 }));
  };

  const onSort = (type, field) => {
    setSorts((current) => {
      const active = current[type];
      return {
        ...current,
        [type]: active.key === field ? { key: field, dir: active.dir === "asc" ? "desc" : "asc" } : { key: field, dir: "asc" },
      };
    });
    setPages((current) => ({ ...current, [type]: 1 }));
  };

  const openForm = (type, record = null) => {
    setForm({
      open: true,
      id: record ? recordId(record) : "",
      type,
      date: record ? toDateOnly(record.date) : new Date().toISOString().slice(0, 10),
      amount: record ? String(record.amount ?? "") : "",
      category: record?.category || "",
      note: record?.note || "",
      applyRules: true,
      error: "",
    });
  };

  const closeForm = () => setForm({ open: false });

  const updateFormField = (key, value) => {
    if (key === "category" && value === "__custom__") {
      const name = window.prompt("Custom category name");
      if (name?.trim()) {
        saveCustomCategory(form.type, name.trim());
      }
      return;
    }
    setForm((current) => ({ ...current, [key]: value, error: "" }));
  };

  const saveCustomCategory = async (type, name) => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return;

    const nextCustom = {
      ...customCategories,
      [type]: normalizeList([...(customCategories[type] || []), cleanName]),
    };

    setCustomCategories(nextCustom);
    setCategories((current) => ({
      ...current,
      [type]: mergeCategories(type === "expense" ? EXPENSE_DEFAULTS : INCOME_DEFAULTS, nextCustom[type], records, type),
    }));
    setForm((current) => ({ ...current, category: cleanName }));

    try {
      await api.auth.updateProfile({
        customExpenseCategories: nextCustom.expense,
        customIncomeCategories: nextCustom.income,
      });
    } catch (err) {
      setStatus({ message: `Custom category saved locally, but profile update failed: ${err?.message || "Unknown error"}`, kind: "error" });
    }
  };

  const submitRecord = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.date || !Number.isFinite(amount) || amount <= 0 || !form.category) {
      setForm((current) => ({ ...current, error: "Please enter a date, amount greater than 0, and category." }));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: form.type,
        date: form.date,
        amount,
        category: form.category,
        note: form.note || "",
        applyRules: form.applyRules,
      };
      if (form.id) await api.records.update(form.id, payload);
      else await api.records.create(payload);
      closeForm();
      await load();
      setStatus({ message: form.id ? "Record updated." : "Record added.", kind: "ok" });
    } catch (err) {
      setForm((current) => ({ ...current, error: err?.message || "Could not save record." }));
    } finally {
      setSaving(false);
    }
  };

  const exportRecords = async (type) => {
    const rows = visibleRecords[type];
    if (!rows.length) {
      setStatus({ message: "No matching records to export.", kind: "error" });
      return;
    }

    await exportSheets({
      title: `${type === "income" ? "Income" : "Expense"} Records`,
      filenameBase: `${type}_records_${new Date().toISOString().slice(0, 10)}`,
      format: getPreferredExportFormat(),
      sheets: [
        {
          name: type === "income" ? "Income Records" : "Expense Records",
          rows: rows.map((record) => ({
            Date: toDateOnly(record.date),
            Type: record.type || "",
            Category: record.category || "",
            Amount: Number(record.amount ?? 0),
            Currency: record.currency || "USD",
            Notes: record.note || "",
            Origin: recordOrigin(record),
          })),
        },
      ],
    });
    setStatus({ message: "Export started.", kind: "ok" });
  };

  const deleteRecord = async (deleteReceipt) => {
    if (!pendingDelete) return;
    try {
      await api.records.remove(recordId(pendingDelete), deleteReceipt && !!linkedReceiptId(pendingDelete));
      setPendingDelete(null);
      await load();
      setStatus({ message: "Record deleted.", kind: "ok" });
    } catch (err) {
      setStatus({ message: `Could not delete record: ${err?.message || "Unknown error"}`, kind: "error" });
    }
  };

  const viewReceipt = async (record) => {
    setReceiptModal({ open: true, loading: true, record, receipt: null, error: "" });
    try {
      const receipt = await api.receipts.getOne(linkedReceiptId(record));
      setReceiptModal({ open: true, loading: false, record, receipt, error: "" });
    } catch (err) {
      setReceiptModal({ open: true, loading: false, record, receipt: null, error: err?.message || "Unable to load receipt items." });
    }
  };

  return (
    <>
      <div id="header"></div>
      <main className="main">
        {status.message ? (
          <p className={`status-banner subtle ${status.kind === "error" ? "is-error" : "is-ok"}`} aria-live="polite">
            {status.message}
          </p>
        ) : null}

        <RecordsTable
          type="expense"
          title="Expenses"
          description="Search, filter, sort, and export your expense transactions."
          filters={filters.expense}
          page={pages.expense}
          sort={sorts.expense}
          rows={visibleRecords.expense}
          categories={categories.expense}
          loading={loading}
          onFilterChange={onFilterChange}
          onClearFilters={onClearFilters}
          onPageChange={(type, page) => setPages((current) => ({ ...current, [type]: page }))}
          onSort={onSort}
          onOpenForm={openForm}
          onExport={exportRecords}
          onEdit={(record) => openForm("expense", record)}
          onDelete={setPendingDelete}
          onViewReceipt={viewReceipt}
        />

        <RecordsTable
          type="income"
          title="Income"
          description="Search, filter, sort, and export your income transactions."
          filters={filters.income}
          page={pages.income}
          sort={sorts.income}
          rows={visibleRecords.income}
          categories={categories.income}
          loading={loading}
          onFilterChange={onFilterChange}
          onClearFilters={onClearFilters}
          onPageChange={(type, page) => setPages((current) => ({ ...current, [type]: page }))}
          onSort={onSort}
          onOpenForm={openForm}
          onExport={exportRecords}
          onEdit={(record) => openForm("income", record)}
          onDelete={setPendingDelete}
          onViewReceipt={viewReceipt}
        />

        <RecordModal
          state={form}
          categories={categories[form.type] || []}
          saving={saving}
          customCategories={customCategories}
          onField={updateFormField}
          onClose={closeForm}
          onSubmit={submitRecord}
          onCustomCategory={saveCustomCategory}
        />

        {pendingDelete ? (
          <div className="modal" onMouseDown={(event) => event.target.classList.contains("modal") && setPendingDelete(null)}>
            <div className="modal-content" onMouseDown={(event) => event.stopPropagation()}>
              <h2>Delete Record</h2>
              <p>
                {linkedReceiptId(pendingDelete)
                  ? "This record is linked to an uploaded receipt."
                  : "Are you sure you want to delete this record?"}
              </p>
              <div className="modal-actions">
                <button className="btn btn--danger" type="button" onClick={() => deleteRecord(false)}>
                  Delete Record
                </button>
                {linkedReceiptId(pendingDelete) ? (
                  <button className="btn btn--warning" type="button" onClick={() => deleteRecord(true)}>
                    Delete Record & Receipt
                  </button>
                ) : null}
                <button className="btn" type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
              </div>
            </div>
          </div>
        ) : null}

        {receiptModal.open ? (
          <div className="modal" onMouseDown={(event) => event.target.classList.contains("modal") && setReceiptModal({ open: false })}>
            <div className="modal-content" onMouseDown={(event) => event.stopPropagation()}>
              <h2>Receipt Items</h2>
              <p className="subtle">Line items saved for {receiptModal.record?.note || receiptModal.record?.category || "this receipt"}.</p>
              {receiptModal.error ? <p className="status-banner subtle is-error">{receiptModal.error}</p> : null}
              <div className="receipt-items-panel">
                <div className="receipt-items-header">
                  <span>Item</span>
                  <span>Price</span>
                </div>
                <div className="receipt-items-list" aria-live="polite">
                  {receiptModal.loading ? (
                    <p className="subtle receipt-items-empty">Loading...</p>
                  ) : receiptItems(receiptModal.receipt).length ? (
                    <>
                      {receiptItems(receiptModal.receipt).map((item, index) => (
                        <div className="receipt-items-row" key={`${item.name}-${index}`}>
                          <span>{item.name}</span>
                          <span>{fmtMoney(item.price, receiptModal.receipt?.currency || "USD")}</span>
                        </div>
                      ))}
                      <div className="receipt-items-row receipt-items-row--tax">
                        <span>Taxes</span>
                        <span>{fmtMoney(taxAmount(receiptModal.receipt), receiptModal.receipt?.currency || "USD")}</span>
                      </div>
                    </>
                  ) : (
                    <p className="subtle receipt-items-empty">No saved line items were found for this receipt.</p>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn" type="button" onClick={() => setReceiptModal({ open: false })}>Close</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      <div id="footer"></div>
    </>
  );
}


// web/api.js
// ======================================================================
// FinanceApp Frontend API Wrapper (ESM)
// Updated for: Postgres metadata + Cloudflare R2 presigned uploads/downloads
// ======================================================================

// --------------------------------------
// CONFIG (auto-switch for localhost vs Render)
// --------------------------------------
const API_BASE =
  window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1")
    ? "http://localhost:4000/api"
    : "https://wisewallet-l1d5.onrender.com/api";

// --------------------------------------
// AUTH TOKEN STORAGE (fallback for blocked cookies)
// --------------------------------------
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TOKEN_TS_KEY = "auth_token_ts";
const AUTH_TOKEN_TTL_MS = 30 * 60 * 1000;

function getAuthToken() {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
  const tsRaw = sessionStorage.getItem(AUTH_TOKEN_TS_KEY) || "";
  const ts = Number(tsRaw);
  if (!token || !Number.isFinite(ts)) return "";
  if (Date.now() - ts > AUTH_TOKEN_TTL_MS) {
    clearAuthToken();
    return "";
  }
  return token;
}

function setAuthToken(token) {
  if (!token) return;
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_TOKEN_TS_KEY, String(Date.now()));
}

function clearAuthToken() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_TS_KEY);
}

// --------------------------------------
// INTERNAL REQUEST WRAPPER
// --------------------------------------
async function request(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
    ...(token && !options.headers?.Authorization
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers,
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some endpoints may intentionally return empty bodies
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
    }
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

// ======================================================================
// AUTH MODULE
// ======================================================================
export const auth = {
  setToken(token) {
    setAuthToken(token);
  },

  async register(email, password, fullName) {
    const data = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName }),
    });
    if (data?.token) setAuthToken(data.token);
    return data;
  },

  async login(identifier, password) {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    if (data?.token) setAuthToken(data.token);
    return data;
  },

  async verifyTwoFaLogin(code, twoFactorToken) {
    const data = await request("/auth/2fa/verify-login", {
      method: "POST",
      body: JSON.stringify({ code, twoFactorToken }),
    });
    if (data?.token) setAuthToken(data.token);
    return data;
  },

  async logout() {
    try {
      return await request("/auth/logout", { method: "POST" });
    } finally {
      clearAuthToken();
    }
  },

  me() {
    return request("/auth/me");
  },

  sessions() {
    return request("/auth/sessions");
  },

  async signOutAll(password) {
    const data = await request("/auth/sessions/logout-all", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    clearAuthToken();
    return data;
  },

  requestTwoFaEnable() {
    return request("/auth/2fa/request-enable", { method: "POST" });
  },

  requestTwoFaPasswordChange() {
    return request("/auth/2fa/request-password-change", { method: "POST" });
  },

  confirmTwoFaEnable(code) {
    return request("/auth/2fa/confirm-enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  disableTwoFa(password) {
    return request("/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  updateProfile(updates) {
    return request("/auth/me", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async changePassword(currentPassword, newPassword, twoFaCode) {
    const data = await request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, twoFaCode }),
    });
    if (data?.token) setAuthToken(data.token);
    return data;
  },

  deleteAccount() {
    return request("/auth/me", { method: "DELETE" });
  },

  googleConfig() {
    return request("/auth/google/config");
  },

  beginGoogleAuth(mode = "login", returnTo = window.location.href) {
    const normalizedMode = mode === "register" ? "register" : "login";
    const url = new URL(`${API_BASE}/auth/google/start`);
    url.searchParams.set("mode", normalizedMode);
    url.searchParams.set("returnTo", returnTo);
    window.location.href = url.toString();
  },

  consumeGoogleRedirect() {
    const currentUrl = new URL(window.location.href);
    const token = currentUrl.searchParams.get("auth_token") || "";
    const success = currentUrl.searchParams.get("auth_success") === "1";
    const error = currentUrl.searchParams.get("auth_error") || "";
    const mode = currentUrl.searchParams.get("auth_mode") || "";

    if (token) {
      setAuthToken(token);
    }

    if (token || success || error || mode) {
      currentUrl.searchParams.delete("auth_token");
      currentUrl.searchParams.delete("auth_success");
      currentUrl.searchParams.delete("auth_error");
      currentUrl.searchParams.delete("auth_mode");
      window.history.replaceState({}, document.title, currentUrl.toString());
    }

    return { token, success, error, mode };
  },
};

// ======================================================================
// RECORDS MODULE
// ======================================================================
export const records = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/records${query ? `?${query}` : ""}`);
  },

  stats() {
    return request("/records/stats");
  },

  getOne(id) {
    return request(`/records/${id}`);
  },

  create({ type, amount, category, date, note }) {
    return request("/records", {
      method: "POST",
      body: JSON.stringify({ type, amount, category, date, note }),
    });
  },

  update(id, updates) {
    return request(`/records/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  /**
   * deleteReceipt === true  → delete linked receipt also (metadata row)
   * deleteReceipt === false → unlink but keep receipt
   * deleteReceipt === undefined → omit parameter
   */
  remove(id, deleteReceipt) {
    const query =
      deleteReceipt === undefined ? "" : `?deleteReceipt=${deleteReceipt}`;
    return request(`/records/${id}${query}`, { method: "DELETE" });
  },
};

// ======================================================================
// RECEIPTS MODULE (R2 presigned flow)
// ======================================================================
export const receipts = {
  /**
   * Upload flow:
   * 1) POST /receipts/presign  -> { id, objectKey, uploadUrl }
   * 2) PUT uploadUrl (raw file bytes)
   * 3) POST /receipts/:id/confirm -> { receipt, autoRecord }
   */
  async upload(file) {
    if (!file) throw new Error("No file provided");

    // 1) Get presigned PUT URL
    const presign = await request("/receipts/presign", {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size || 0,
      }),
    });

    if (!presign?.uploadUrl || !presign?.id) {
      throw new Error("Presign failed: missing uploadUrl or id");
    }

    // 2) Upload directly to R2 via PUT
    const putRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!putRes.ok) {
      throw new Error(`Upload to object storage failed (${putRes.status})`);
    }

    // 3) Confirm upload; server enqueues async processing job
    await request(`/receipts/${presign.id}/confirm`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    // 4) Poll receipt status until processing is complete
    const timeoutMs = 120000;
    const pollMs = 1500;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      // eslint-disable-next-line no-await-in-loop
      const receipt = await request(`/receipts/${presign.id}`);
      const status = receipt?.processing_status || receipt?.processingStatus || "";
      if (status === "processed") {
        return { receipt, autoRecord: null };
      }
      if (status === "failed") {
        throw new Error(
          receipt?.processing_error ||
            receipt?.processingError ||
            "Receipt processing failed."
        );
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    throw new Error("Receipt processing is taking longer than expected. Please refresh shortly.");
  },

  getAll() {
    return request("/receipts");
  },

  getOne(id) {
    return request(`/receipts/${id}`);
  },

  /**
   * Backend returns { downloadUrl } (presigned GET).
   * We fetch the blob client-side to preserve your existing UI behavior.
   */
  async download(id) {
    const data = await request(`/receipts/${id}/download`);
    const url = data?.downloadUrl;
    if (!url) throw new Error("Missing downloadUrl");

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("Download failed");

    return await res.blob();
  },

  async downloadToFile(id, filename = "receipt") {
    const blob = await this.download(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  updateOcrText(id, ocrText) {
    return request(`/receipts/${id}/ocr`, {
      method: "PATCH",
      body: JSON.stringify({ ocrText }),
    });
  },

  remove(id, deleteRecord) {
    const query =
      deleteRecord === undefined ? "" : `?deleteRecord=${deleteRecord}`;

    return request(`/receipts/${id}${query}`, { method: "DELETE" });
  },

  /**
   * Scan-only flow (no object storage, no DB persistence):
   * 1) POST /receipts/scan (multipart/form-data)
   * 2) Returns OCR + parsed data
   */
  async scan(file) {
    if (!file) throw new Error("No file provided");

    const form = new FormData();
    form.append("file", file, file.name);

    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/receipts/scan`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // ignore
    }

    if (!res.ok) {
      const message = data?.message || `Request failed (${res.status})`;
      throw new Error(message);
    }

    return data;
  },
};

// ======================================================================
// BUDGET SHEETS MODULE
// ======================================================================
export const budgetSheets = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/budget-sheets${query ? `?${query}` : ""}`);
  },

  lookup({ cadence, period }) {
    const query = new URLSearchParams({ cadence, period }).toString();
    return request(`/budget-sheets/lookup?${query}`);
  },
  summary({ cadence, period }) {
    const query = new URLSearchParams({ cadence, period }).toString();
    return request(`/budget-sheets/summary?${query}`);
  },

  getOne(id) {
    return request(`/budget-sheets/${id}`);
  },

  create({ cadence, period, categories, customCategories }) {
    return request("/budget-sheets", {
      method: "POST",
      body: JSON.stringify({ cadence, period, categories, customCategories }),
    });
  },

  update(id, updates) {
    return request(`/budget-sheets/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  delete(id) {
    return request(`/budget-sheets/${id}`, {
      method: "DELETE",
    });
  },
};

// ======================================================================
// FX RATES MODULE (shared daily cache)
// ======================================================================
export const fxRates = {
  get(base = "USD") {
    const query = new URLSearchParams({ base }).toString();
    return request(`/fx-rates?${query}`);
  },
};

// ======================================================================
// ACTIVITY MODULE
// ======================================================================
export const activity = {
  getRecent(limit = 20) {
    const query = new URLSearchParams({ limit }).toString();
    return request(`/activity?${query}`);
  },
};

// ======================================================================
// APP SETTINGS MODULE (PUBLIC)
// ======================================================================
export const appSettings = {
  getPublic() {
    return request("/app-settings/public");
  },
};

// ======================================================================
// ADMIN MODULE
// ======================================================================
export const admin = {
  listUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/users${query ? `?${query}` : ""}`);
  },

  getUser(id) {
    return request(`/admin/users/${id}`);
  },

  updateUser(id, updates) {
    return request(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  listRecords(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/records${query ? `?${query}` : ""}`);
  },

  getRecord(id) {
    return request(`/admin/records/${id}`);
  },

  updateRecord(id, updates) {
    return request(`/admin/records/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  deleteRecord(id, deleteReceipt) {
    const query =
      deleteReceipt === undefined ? "" : `?deleteReceipt=${deleteReceipt}`;
    return request(`/admin/records/${id}${query}`, { method: "DELETE" });
  },

  getSettings() {
    return request("/admin/settings");
  },

  updateSettings(updates) {
    return request("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },
};

// ======================================================================
// SUPPORT MODULE
// ======================================================================
export const support = {
  contact({ subject, message, name, email } = {}) {
    return request("/support/contact", {
      method: "POST",
      body: JSON.stringify({ subject, message, name, email }),
    });
  },
  contactPublic({ subject, message, name, email, website } = {}) {
    return request("/support/public", {
      method: "POST",
      body: JSON.stringify({ subject, message, name, email, website }),
    });
  },
};

// ======================================================================
// UI HELPERS (shared by all frontend pages)
// ======================================================================

/** Returns "Receipt" if the record is linked, otherwise "Manual". */
export function getUploadType(record) {
  // Postgres returns snake_case; keep compatibility with older camelCase
  return record?.linked_receipt_id || record?.linkedReceiptId ? "Receipt" : "Manual";
}

export function getPayMethodLabel(method) {
  const map = {
    Cash: "Cash",
    Check: "Check",
    "Credit Card": "Credit Card",
    "Debit Card": "Debit Card",
    "Gift Card": "Gift Card",
    Multiple: "Multiple Methods",
    Other: "Other / Unknown",
  };
  return map[method] || "Unknown";
}

export function getReceiptSummary(receipt) {
  // Postgres returns snake_case by default
  const parsed = receipt?.parsed_data || receipt?.parsedData || {};

  return {
    date: parsed.date || "",
    dateAdded: receipt?.created_at || receipt?.createdAt || "",
    source: parsed.source || receipt?.original_filename || receipt?.originalFilename || "",
    subAmount: Number(parsed.subAmount || parsed.sub_amount || 0),
    amount: Number(parsed.amount || 0),
    taxAmount: Number(parsed.taxAmount || parsed.tax_amount || 0),
    payMethod: getPayMethodLabel(parsed.payMethod || parsed.pay_method),
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

// ======================================================================
// ROOT EXPORT
// ======================================================================
export const api = {
  auth,
  records,
  receipts,
  budgetSheets,
  fxRates,
  activity,
  appSettings,
  admin,
  support,
  getUploadType,
  getReceiptSummary,
  getPayMethodLabel,
};

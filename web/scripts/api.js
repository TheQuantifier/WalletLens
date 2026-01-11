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
// INTERNAL REQUEST WRAPPER
// --------------------------------------
async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some endpoints may intentionally return empty bodies
  }

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

// ======================================================================
// AUTH MODULE
// ======================================================================
export const auth = {
  register(email, password, fullName) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName }),
    });
  },

  login(identifier, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
  },

  logout() {
    return request("/auth/logout", { method: "POST" });
  },

  me() {
    return request("/auth/me");
  },

  updateProfile(updates) {
    return request("/auth/me", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  changePassword(currentPassword, newPassword) {
    return request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  deleteAccount() {
    return request("/auth/me", { method: "DELETE" });
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

    // 3) Confirm so server can OCR + AI parse + save metadata + auto-record
    return request(`/receipts/${presign.id}/confirm`, {
      method: "POST",
      body: JSON.stringify({}),
    });
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

  remove(id, deleteRecord) {
    const query =
      deleteRecord === undefined ? "" : `?deleteRecord=${deleteRecord}`;

    return request(`/receipts/${id}${query}`, { method: "DELETE" });
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
  getUploadType,
  getReceiptSummary,
  getPayMethodLabel,
};

// scripts/upload.js
// FinanceApp — Receipt Uploads, Downloads, and Deletion (Modal-based)

import { api } from "./api.js";

(() => {
  const ACCEPTED_MIME = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/heic",
    "image/heif",
    "image/tiff",
    "image/bmp",
    "image/webp",
  ];
  const ACCEPTED_EXT = ["pdf", "png", "jpg", "jpeg", "heic", "heif", "tif", "tiff", "bmp", "webp"];
  const MAX_MB = 50;

  // -----------------------------
  // DOM
  // -----------------------------
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const fileList = document.getElementById("fileList");
  const uploadBtn = document.getElementById("uploadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const statusMsg = document.getElementById("statusMsg");
  const recentTableBody = document.getElementById("recentTableBody");

  // Modal
  const deleteModal = document.getElementById("deleteModal");
  const btnDeleteFile = document.getElementById("btnDeleteFile");
  const btnDeleteBoth = document.getElementById("btnDeleteBoth");
  const btnDeleteCancel = document.getElementById("btnDeleteCancel");

  // Upload mode modal
  const uploadModeModal = document.getElementById("uploadModeModal");
  const btnScanOnly = document.getElementById("btnScanOnly");
  const btnSaveAndScan = document.getElementById("btnSaveAndScan");
  const btnUploadCancel = document.getElementById("btnUploadCancel");

  // OCR review modal
  const ocrReviewModal = document.getElementById("ocrReviewModal");
  const ocrReviewText = document.getElementById("ocrReviewText");
  const btnOcrReviewDone = document.getElementById("btnOcrReviewDone");

  if (!dropzone || !fileInput) {
    console.error("upload.js: Missing #dropzone or #fileInput in DOM");
    return;
  }

  // -----------------------------
  // State
  // -----------------------------
  let pendingFiles = []; // File[]
  let isUploading = false;
  let processingPollTimer = null;

  let pendingDelete = {
    receiptId: null,
    linkedRecordId: null,
    buttonRef: null,
  };

  // -----------------------------
  // Status helpers
  // -----------------------------
  const setStatus = (msg, kind = "ok") => {
    if (!statusMsg) return;
    statusMsg.textContent = msg;
    statusMsg.classList.toggle("is-hidden", !msg);
    statusMsg.style.display = msg ? "block" : "none";
    statusMsg.classList.toggle("is-ok", kind === "ok");
    statusMsg.classList.toggle("is-error", kind === "error");
  };

  const clearStatusSoon = (ms = 2000) => {
    if (!statusMsg) return;
    window.setTimeout(() => {
      statusMsg.textContent = "";
      statusMsg.style.display = "none";
      statusMsg.classList.add("is-hidden");
      statusMsg.classList.remove("is-ok", "is-error");
    }, ms);
  };

  // -----------------------------
  // Utils
  // -----------------------------
  const bytesToSize = (bytes = 0) => {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let n = Number(bytes) || 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const extFromName = (name = "") => {
    const parts = String(name).split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  };

  const isAccepted = (file) => {
    if (!file) return false;
    const ext = extFromName(file.name);
    return ACCEPTED_MIME.includes(file.type) || ACCEPTED_EXT.includes(ext);
  };

  const overLimit = (file) => (file?.size || 0) > MAX_MB * 1024 * 1024;

  const dedupeKey = (file) => `${file.name}::${file.size}::${file.lastModified}`;

  const clampFiles = (files) => {
    const out = [];
    const seen = new Set(pendingFiles.map(dedupeKey));

    for (const f of Array.from(files || [])) {
      if (!f) continue;
      if (!isAccepted(f) || overLimit(f)) continue;
      const key = dedupeKey(f);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out;
  };

  const setUploadingUI = (flag) => {
    isUploading = flag;
    if (uploadBtn) {
      uploadBtn.disabled = flag || pendingFiles.length === 0;
      uploadBtn.textContent = flag ? "Uploading…" : "Upload";
    }
    if (clearBtn) clearBtn.disabled = flag;
    if (fileInput) fileInput.disabled = flag;

    dropzone.setAttribute("aria-busy", flag ? "true" : "false");
    dropzone.style.pointerEvents = flag ? "none" : "auto";
    dropzone.style.opacity = flag ? "0.85" : "1";
  };

  // -----------------------------
  // Pending list rendering
  // -----------------------------
  const renderPending = () => {
    if (!fileList) return;

    fileList.innerHTML = "";

    if (!pendingFiles.length) {
      const empty = document.createElement("div");
      empty.className = "subtle";
      empty.textContent = "No files selected.";
      fileList.appendChild(empty);
      setUploadingUI(false);
      return;
    }

    // Use the new pill UI if upload.css defines it; otherwise fallback to existing layout.
    const usePills = true;

    if (usePills) {
      const container = document.createElement("div");
      container.className = "file-list";

      pendingFiles.forEach((f, idx) => {
        const pill = document.createElement("div");
        pill.className = "file-pill";

        const meta = document.createElement("div");
        meta.className = "meta";

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = f.name;

        const sub = document.createElement("div");
        sub.className = "sub";
        sub.textContent = `${bytesToSize(f.size)} • ${f.type || extFromName(f.name).toUpperCase() || "file"}`;

        meta.appendChild(name);
        meta.appendChild(sub);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn remove";
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
          pendingFiles.splice(idx, 1);
          renderPending();
        });

        pill.appendChild(meta);
        pill.appendChild(removeBtn);
        container.appendChild(pill);
      });

      fileList.appendChild(container);
    } else {
      // Fallback: simple list
      pendingFiles.forEach((f) => {
        const div = document.createElement("div");
        div.className = "subtle";
        div.textContent = `${f.name} • ${bytesToSize(f.size)}`;
        fileList.appendChild(div);
      });
    }

    setUploadingUI(false);
  };

  const addFiles = (files) => {
    const incoming = Array.from(files || []);
    let rejected = 0;

    const accepted = [];
    for (const f of incoming) {
      if (!f || !isAccepted(f) || overLimit(f)) rejected++;
      else accepted.push(f);
    }

    const cleaned = clampFiles(accepted);
    if (cleaned.length) {
      pendingFiles = pendingFiles.concat(cleaned);
      renderPending();
      setStatus(`${cleaned.length} file(s) added.`, "ok");
      clearStatusSoon(1500);
    }

    if (rejected) {
      setStatus(
        `${rejected} file(s) skipped (PDF/PNG/JPG/HEIC/TIFF/BMP/WEBP only, ≤ ${MAX_MB} MB).`,
        "error"
      );
      clearStatusSoon(3000);
    }

    if (!cleaned.length && !rejected) {
      setStatus("No files selected.", "error");
      clearStatusSoon(2000);
    }
  };

  // -----------------------------
  // Recent table rendering
  // -----------------------------
  const trashIcon = `<img src="images/trash.png" alt="Delete" class="icon-trash" />`;
  const downloadIcon = `<img src="images/download.png" alt="Download" class="icon-trash" />`;

  const renderRecentRows = (rows) => {
    if (!recentTableBody) return;

    recentTableBody.innerHTML = "";

    if (!rows?.length) {
      recentTableBody.innerHTML = `<tr><td colspan="6" class="subtle">No uploads yet.</td></tr>`;
      return;
    }

    for (const r of rows) {
      const id = r?.id || r?._id;
      const filename =
        r?.originalFilename ||
        r?.original_filename ||
        r?.originalName ||
        r?.original_name ||
        r?.filename ||
        "receipt.pdf";

      const createdRaw = r?.createdAt || r?.created_at || r?.uploadedAt || r?.uploaded_at;
      const created = createdRaw ? new Date(createdRaw).toLocaleString() : "—";

      const processingStatus = r?.processing_status || r?.processingStatus || "";
      const processingStage = r?.processing_stage || r?.processingStage || "";
      let status = "Raw";
      const ocrText = r?.ocrText ?? r?.ocr_text;
      const parsedData = r?.parsedData ?? r?.parsed_data;
      const hasOCR = ocrText && String(ocrText).trim().length > 0;
      const hasParsed = parsedData && typeof parsedData === "object" && Object.keys(parsedData).length > 0;
      if (hasParsed) status = "Parsed";
      else if (hasOCR) status = "Read";
      if (r?.error || r?.ocrFailed || r?.ocr_failed) status = "Error";
      if (processingStatus === "queued") status = "Queued";
      if (processingStatus === "processing") {
        if (processingStage === "extracting_text") status = "OCR";
        else if (processingStage === "parsing_ai") status = "Parsing";
        else if (processingStage === "updating_records") status = "Record";
        else status = "Processing";
      }
      if (processingStatus === "failed") status = "Failed";

      const fileSaved = r?.fileSaved ?? r?.file_saved ?? true;
      const downloadBtn = fileSaved
        ? `<button class="icon-btn js-download" type="button"
                  data-id="${id}"
                  data-filename="${filename}">
            ${downloadIcon}
          </button>`
        : "";

      const tr = document.createElement("tr");
      tr.dataset.id = id;
      tr.dataset.linkedRecordId = r?.linkedRecordId || r?.linkedRecord || r?.linked_record_id || "";

      tr.innerHTML = `
        <td>${filename}</td>
        <td>${r?.fileType || r?.file_type || r?.mimetype || r?.mime_type || "—"}</td>
        <td class="num">${bytesToSize(r?.fileSize || r?.file_size || r?.size || 0)}</td>
        <td>${created}</td>
        <td>${status}</td>

        <td class="num actions-col">
          ${downloadBtn}

          <button class="icon-btn js-delete" type="button"
                  data-id="${id}">
            ${trashIcon}
          </button>
        </td>
      `;

      recentTableBody.appendChild(tr);
    }
  };

  const refreshRecent = async () => {
    if (!recentTableBody) return;

    try {
      const res = await api.receipts.getAll();
      const receipts = Array.isArray(res) ? res : (res?.receipts || res?.data || []);
      renderRecentRows(receipts || []);
      const hasInFlight = (receipts || []).some((entry) => {
        const status = entry?.processing_status || entry?.processingStatus || "";
        return status === "queued" || status === "processing";
      });
      if (hasInFlight && !processingPollTimer) {
        processingPollTimer = window.setInterval(() => {
          refreshRecent().catch(() => {});
        }, 4000);
      } else if (!hasInFlight && processingPollTimer) {
        window.clearInterval(processingPollTimer);
        processingPollTimer = null;
      }
    } catch (err) {
      console.error("Failed to refresh uploads:", err);
      recentTableBody.innerHTML = `<tr><td colspan="6" class="subtle">Failed to load uploads.</td></tr>`;
    }
  };

  // -----------------------------
  // Delete modal
  // -----------------------------
  const openDeleteModal = (receiptId, linkedRecordId, buttonRef) => {
    if (!deleteModal) return;

    pendingDelete.receiptId = receiptId;
    pendingDelete.linkedRecordId = linkedRecordId;
    pendingDelete.buttonRef = buttonRef;

    // Only show "Delete Both" if linked record exists
    if (btnDeleteBoth) btnDeleteBoth.style.display = linkedRecordId ? "block" : "none";

    deleteModal.classList.remove("hidden");
  };

  const closeDeleteModal = () => {
    if (!deleteModal) return;
    deleteModal.classList.add("hidden");

    pendingDelete = {
      receiptId: null,
      linkedRecordId: null,
      buttonRef: null,
    };
  };

  // -----------------------------
  // Upload mode modal
  // -----------------------------
  const openUploadModeModal = () => {
    if (!uploadModeModal) return;
    uploadModeModal.classList.remove("hidden");
  };

  const closeUploadModeModal = () => {
    if (!uploadModeModal) return;
    uploadModeModal.classList.add("hidden");
  };

  // -----------------------------
  // OCR review modal
  // -----------------------------
  const openOcrReviewModal = (text) => {
    if (!ocrReviewModal || !ocrReviewText) return Promise.resolve();
    ocrReviewText.value = text || "";
    ocrReviewModal.classList.remove("hidden");

    return new Promise((resolve) => {
      const done = () => {
        ocrReviewModal.classList.add("hidden");
        btnOcrReviewDone?.removeEventListener("click", done);
        ocrReviewModal?.querySelector(".modal-backdrop")?.removeEventListener("click", done);
        resolve(ocrReviewText.value || "");
      };

      btnOcrReviewDone?.addEventListener("click", done);
      ocrReviewModal?.querySelector(".modal-backdrop")?.addEventListener("click", done);
    });
  };

  const performDelete = async (deleteRecord) => {
    const { receiptId, buttonRef } = pendingDelete;
    if (!receiptId) return;

    try {
      if (buttonRef) buttonRef.disabled = true;
      if (deleteRecord && btnDeleteBoth) btnDeleteBoth.disabled = true;
      if (!deleteRecord && btnDeleteFile) btnDeleteFile.disabled = true;

      await api.receipts.remove(receiptId, deleteRecord);

      setStatus(deleteRecord ? "Receipt and linked record deleted." : "Receipt deleted.", "ok");
      clearStatusSoon(2000);

      await refreshRecent();
    } catch (err) {
      console.error(err);
      setStatus(`Delete failed: ${err?.message || "Unknown error"}`, "error");
    } finally {
      if (buttonRef) buttonRef.disabled = false;
      if (btnDeleteBoth) btnDeleteBoth.disabled = false;
      if (btnDeleteFile) btnDeleteFile.disabled = false;
      closeDeleteModal();
    }
  };

  // Modal button actions
  btnDeleteFile?.addEventListener("click", () => performDelete(false));
  btnDeleteBoth?.addEventListener("click", () => performDelete(true));
  btnDeleteCancel?.addEventListener("click", closeDeleteModal);

  // Close modal on backdrop click
  deleteModal?.querySelector(".modal-backdrop")?.addEventListener("click", closeDeleteModal);
  uploadModeModal?.querySelector(".modal-backdrop")?.addEventListener("click", closeUploadModeModal);

  // -----------------------------
  // Table actions (download + delete)
  // -----------------------------
  recentTableBody?.addEventListener("click", async (e) => {
    const downloadBtn = e.target.closest(".js-download");
    const deleteBtn = e.target.closest(".js-delete");

    // DOWNLOAD
    if (downloadBtn) {
      const id = downloadBtn.dataset.id;
      const filename = downloadBtn.dataset.filename || "receipt";

      try {
        setStatus("Downloading…");
        await api.receipts.downloadToFile(id, filename);
        setStatus("Download complete", "ok");
        clearStatusSoon(1500);
      } catch (err) {
        console.error(err);
        setStatus(`Download failed: ${err?.message || "Unknown error"}`, "error");
      }
      return;
    }

    // DELETE
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const row = deleteBtn.closest("tr");
      const linkedRecordId = row?.dataset?.linkedRecordId || "";
      openDeleteModal(id, linkedRecordId, deleteBtn);
    }
  });

  // -----------------------------
  // Picker + dropzone
  // -----------------------------
  const openPicker = () => {
    if (isUploading) return;
    fileInput.click();
  };

  dropzone.addEventListener("click", openPicker);

  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  });

  fileInput.addEventListener("click", (e) => e.stopPropagation());

  fileInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    e.target.value = ""; // allow selecting the same file again
  });

  // Drag & drop
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (isUploading) return;
      dropzone.classList.add("is-dragover");
    })
  );

  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === "drop" && !isUploading && e.dataTransfer?.files) {
        addFiles(e.dataTransfer.files);
      }
      dropzone.classList.remove("is-dragover");
    })
  );

  clearBtn?.addEventListener("click", () => {
    if (isUploading) return;
    pendingFiles = [];
    fileInput.value = "";
    renderPending();
    setStatus("Cleared selection.", "ok");
    clearStatusSoon(1200);
  });

  // -----------------------------
  // Upload logic (sequential)
  // -----------------------------
  const uploadAll = async ({ scanOnly } = {}) => {
    if (!pendingFiles.length || isUploading) return;

    setUploadingUI(true);

    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        if (scanOnly) {
          setStatus(`Scanning ${i + 1} of ${pendingFiles.length}: ${file.name}…`);
          const result = await api.receipts.scan(file);
          const ocrText = result?.ocrText ?? "";
          const receiptId = result?.receipt?.id || result?.receipt?._id || "";
          const edited = await openOcrReviewModal(ocrText);
          if (receiptId) {
            await api.receipts.updateOcrText(receiptId, edited);
          }
        } else {
          setStatus(`Uploading ${i + 1} of ${pendingFiles.length}: ${file.name}…`);
          const result = await api.receipts.upload(file);
          const ocrText =
            result?.receipt?.ocr_text ??
            result?.receipt?.ocrText ??
            result?.ocrText ??
            "";
          const receiptId = result?.receipt?.id || result?.receipt?._id || "";
          const edited = await openOcrReviewModal(ocrText);
          if (receiptId) {
            await api.receipts.updateOcrText(receiptId, edited);
          }
        }
      }

      setStatus(scanOnly ? "Scan complete." : "Upload complete.", "ok");
      clearStatusSoon(2000);

      pendingFiles = [];
      renderPending();
      await refreshRecent();
    } catch (err) {
      console.error(scanOnly ? "Scan error:" : "Upload error:", err);
      setStatus(
        `${scanOnly ? "Scan" : "Upload"} failed: ${err?.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setUploadingUI(false);
    }
  };

  uploadBtn?.addEventListener("click", () => {
    if (!pendingFiles.length || isUploading) return;
    openUploadModeModal();
  });

  btnScanOnly?.addEventListener("click", () => {
    closeUploadModeModal();
    uploadAll({ scanOnly: true });
  });

  btnSaveAndScan?.addEventListener("click", () => {
    closeUploadModeModal();
    uploadAll({ scanOnly: false });
  });

  btnUploadCancel?.addEventListener("click", closeUploadModeModal);

  // Close modal with Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && deleteModal && !deleteModal.classList.contains("hidden")) {
      closeDeleteModal();
    }
    if (e.key === "Escape" && uploadModeModal && !uploadModeModal.classList.contains("hidden")) {
      closeUploadModeModal();
    }
    if (e.key === "Escape" && ocrReviewModal && !ocrReviewModal.classList.contains("hidden")) {
      ocrReviewModal.classList.add("hidden");
    }
  });

  // -----------------------------
  // Init
  // -----------------------------
  renderPending();
  refreshRecent();
  setStatus("", "ok");

  window.addEventListener("beforeunload", () => {
    if (processingPollTimer) {
      window.clearInterval(processingPollTimer);
      processingPollTimer = null;
    }
  });
})();

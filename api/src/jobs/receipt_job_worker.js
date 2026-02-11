import { claimNextQueuedReceiptJob, markReceiptJobSucceeded, retryOrFailReceiptJob } from "../models/receipt_job.model.js";
import { updateReceiptParsedData } from "../models/receipt.model.js";
import { processReceipt } from "../services/receipt_processing.service.js";

let started = false;
let timer = null;
let isRunning = false;

async function workOnce() {
  if (isRunning) return;
  isRunning = true;
  try {
    const job = await claimNextQueuedReceiptJob();
    if (!job) return;

    try {
      await processReceipt({ userId: job.user_id, receiptId: job.receipt_id });
      await markReceiptJobSucceeded(job.id);
    } catch (err) {
      const message = String(err?.message || "Receipt processing failed");
      await updateReceiptParsedData(job.user_id, job.receipt_id, {
        processingStatus: "failed",
        processingStage: "failed",
        processingError: message.slice(0, 1000),
      });
      await retryOrFailReceiptJob(job.id, { errorMessage: message, retryDelaySeconds: 20 });
    }
  } finally {
    isRunning = false;
  }
}

export function startReceiptJobWorker({ intervalMs = 1500 } = {}) {
  if (started) return;
  started = true;
  timer = setInterval(() => {
    workOnce().catch((err) => {
      console.error("Receipt worker loop error:", err);
    });
  }, Math.max(500, Number(intervalMs) || 1500));
}

export function stopReceiptJobWorker() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  started = false;
}

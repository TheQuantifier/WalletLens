import { query } from "../config/db.js";

export function computeRetryDecision({ attempts, maxAttempts }) {
  const safeAttempts = Number.isFinite(Number(attempts)) ? Number(attempts) : 0;
  const safeMaxAttempts = Number.isFinite(Number(maxAttempts)) ? Number(maxAttempts) : 0;
  return safeAttempts < safeMaxAttempts ? "queued" : "failed";
}

export async function enqueueReceiptJob({
  userId,
  receiptId,
  jobType = "process_receipt",
  maxAttempts = 3,
}) {
  const { rows } = await query(
    `
    INSERT INTO receipt_jobs (
      receipt_id, user_id, job_type, status, attempts, max_attempts, run_after, last_error, updated_at
    )
    VALUES ($1, $2, $3, 'queued', 0, $4, now(), '', now())
    ON CONFLICT (receipt_id, job_type)
    DO UPDATE SET
      status = 'queued',
      run_after = now(),
      started_at = NULL,
      finished_at = NULL,
      last_error = '',
      updated_at = now()
    RETURNING *
    `,
    [receiptId, userId, jobType, maxAttempts]
  );
  return rows[0] || null;
}

export async function claimNextQueuedReceiptJob() {
  const { rows } = await query(
    `
    WITH next_job AS (
      SELECT id
      FROM receipt_jobs
      WHERE status = 'queued' AND run_after <= now()
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE receipt_jobs j
    SET
      status = 'processing',
      attempts = j.attempts + 1,
      started_at = now(),
      updated_at = now()
    FROM next_job
    WHERE j.id = next_job.id
    RETURNING j.*
    `
  );
  return rows[0] || null;
}

export async function markReceiptJobSucceeded(id) {
  const { rows } = await query(
    `
    UPDATE receipt_jobs
    SET
      status = 'succeeded',
      finished_at = now(),
      last_error = '',
      updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );
  return rows[0] || null;
}

export async function markReceiptJobFailed(id, errorMessage = "") {
  const { rows } = await query(
    `
    UPDATE receipt_jobs
    SET
      status = 'failed',
      finished_at = now(),
      last_error = $2,
      updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [id, String(errorMessage || "").slice(0, 1000)]
  );
  return rows[0] || null;
}

export async function retryOrFailReceiptJob(id, { errorMessage = "", retryDelaySeconds = 20 } = {}) {
  const { rows } = await query(
    `
    UPDATE receipt_jobs
    SET
      status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
      run_after = CASE
        WHEN attempts < max_attempts THEN now() + ($2::text || ' seconds')::interval
        ELSE run_after
      END,
      finished_at = CASE WHEN attempts < max_attempts THEN NULL ELSE now() END,
      last_error = $3,
      updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [id, Math.max(5, Number(retryDelaySeconds) || 20), String(errorMessage || "").slice(0, 1000)]
  );
  return rows[0] || null;
}

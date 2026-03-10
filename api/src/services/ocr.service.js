// src/services/ocr.service.js
import { spawn } from "child_process";
import path from "path";

import env from "../config/env.js";
import { getRuntimeAppSettings } from "./app_settings_runtime.service.js";

function runSingleOcrAttempt(buffer, timeoutMs) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), env.ocrWorkerScript);

    // Allow override via env.js (falls back to python3 if unset)
    const pythonBin = env.pythonBin || "python3";

    const py = spawn(pythonBin, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"], // stdin/out/err
    });
    const timeout = setTimeout(() => {
      py.kill("SIGKILL");
      reject(new Error(`OCR timed out after ${Math.round(timeoutMs / 1000)} seconds`));
    }, timeoutMs);

    let stdout = "";
    let stderr = "";

    try {
      py.stdin.write(buffer);
      py.stdin.end();
    } catch (err) {
      return reject(new Error(`Failed to write to OCR process: ${err.message}`));
    }

    py.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    py.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    py.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start OCR process: ${err.message}`));
    });

    py.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(new Error(`OCR failed (code ${code}): ${stderr || stdout}`));
      }

      try {
        const parsed = JSON.parse(stdout);
        if (parsed?.error) {
          return reject(new Error(`OCR worker error: ${parsed.error}`));
        }
        return resolve(parsed);
      } catch {
        return reject(new Error(`Failed to parse OCR output: ${stdout}`));
      }
    });
  });
}

export async function runOcrBuffer(buffer) {
  const runtimeSettings = await getRuntimeAppSettings();
  const timeoutSeconds = Math.max(5, Number(runtimeSettings.ocr_timeout_seconds || 25));
  const retryLimit = Math.max(0, Number(runtimeSettings.ocr_retry_limit || 1));
  const totalAttempts = retryLimit + 1;
  const timeoutMs = timeoutSeconds * 1000;

  let lastError = null;
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      return await runSingleOcrAttempt(buffer, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt >= totalAttempts) {
        break;
      }
    }
  }
  throw lastError || new Error("OCR failed");
}

// src/middleware/error.js
import env from "../config/env.js";

export function errorHandler(err, req, res, next) {
  console.error("Request failed", { requestId: req.requestId, error: err });

  const requestedStatus = Number(
    err.status || err.statusCode || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500)
  );
  const status = requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
  const hideDetails = env.nodeEnv === "production" && status >= 500;

  const response = {
    message: hideDetails
      ? "Internal server error"
      : (err.code === "LIMIT_FILE_SIZE"
        ? `File exceeds the direct upload limit of ${env.directUploadMaxMb} MB`
        : (err.message || "Internal server error")),
    requestId: req.requestId,
  };

  // Include stack trace only outside production
  if (env.nodeEnv !== "production") {
    response.stack = err.stack;
  }

  // Prevent sending headers twice
  if (res.headersSent) {
    return next(err);
  }

  return res.status(status).json(response);
}

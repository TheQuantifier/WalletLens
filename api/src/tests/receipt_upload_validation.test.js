import test from "node:test";
import assert from "node:assert/strict";

import {
  hasReceiptFileSignature,
  normalizeReceiptContentType,
  validateReceiptUpload,
  validateStoredReceiptUpload,
} from "../services/receipt_upload_validation.service.js";

test("normalizes content types with parameters", () => {
  assert.equal(normalizeReceiptContentType(" Image/PNG; charset=binary "), "image/png");
});

test("accepts supported receipt uploads", () => {
  assert.deepEqual(
    validateReceiptUpload({
      filename: "receipt.JPEG",
      contentType: "image/jpeg",
      sizeBytes: 1024,
      maxUploadBytes: 2048,
    }),
    { valid: true, extension: "jpeg", contentType: "image/jpeg", sizeBytes: 1024 }
  );
});

test("rejects empty, oversized, and mismatched receipt uploads", () => {
  assert.equal(validateReceiptUpload({ filename: "a.pdf", contentType: "application/pdf", sizeBytes: 0, maxUploadBytes: 10 }).valid, false);
  assert.equal(validateReceiptUpload({ filename: "a.pdf", contentType: "application/pdf", sizeBytes: 11, maxUploadBytes: 10 }).valid, false);
  assert.equal(validateReceiptUpload({ filename: "a.pdf", contentType: "image/png", sizeBytes: 5, maxUploadBytes: 10 }).valid, false);
});

test("verifies stored object size and type against the presign request", () => {
  assert.equal(validateStoredReceiptUpload({ expectedSizeBytes: 100, expectedContentType: "image/png", actualSizeBytes: 100, actualContentType: "image/png", maxUploadBytes: 200 }).valid, true);
  assert.equal(validateStoredReceiptUpload({ expectedSizeBytes: 100, expectedContentType: "image/png", actualSizeBytes: 101, actualContentType: "image/png", maxUploadBytes: 200 }).valid, false);
  assert.equal(validateStoredReceiptUpload({ expectedSizeBytes: 100, expectedContentType: "image/png", actualSizeBytes: 100, actualContentType: "application/pdf", maxUploadBytes: 200 }).valid, false);
});

test("checks receipt file signatures before OCR processing", () => {
  assert.equal(hasReceiptFileSignature(Buffer.from("%PDF-1.7\n"), "application/pdf"), true);
  assert.equal(hasReceiptFileSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
  assert.equal(hasReceiptFileSignature(Buffer.from("<svg></svg>"), "image/png"), false);
  assert.equal(hasReceiptFileSignature(Buffer.from("%PDF-1.7\n"), "image/jpeg"), false);
});

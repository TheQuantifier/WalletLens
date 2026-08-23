const MIME_TYPES_BY_EXTENSION = Object.freeze({
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  jpeg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  heic: ["image/heic", "image/heic-sequence"],
  heif: ["image/heif", "image/heif-sequence"],
  tif: ["image/tiff", "image/x-tiff"],
  tiff: ["image/tiff", "image/x-tiff"],
  bmp: ["image/bmp", "image/x-bmp", "image/x-ms-bmp"],
  webp: ["image/webp"],
});

export function normalizeReceiptContentType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

export function getReceiptFileExtension(filename) {
  const name = String(filename || "").trim().toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > -1 ? name.slice(dotIndex + 1) : "";
}

export function validateReceiptUpload({ filename, contentType, sizeBytes, maxUploadBytes }) {
  const normalizedType = normalizeReceiptContentType(contentType);
  const extension = getReceiptFileExtension(filename);
  const parsedSize = Number(sizeBytes);
  const parsedMax = Number(maxUploadBytes);

  if (!filename || !contentType) {
    return { valid: false, message: "filename and contentType are required" };
  }
  if (!Number.isSafeInteger(parsedSize) || parsedSize <= 0) {
    return { valid: false, message: "File size must be a positive integer" };
  }
  if (!Number.isFinite(parsedMax) || parsedMax <= 0 || parsedSize > parsedMax) {
    return { valid: false, message: "File exceeds the maximum upload size" };
  }

  const compatibleTypes = MIME_TYPES_BY_EXTENSION[extension] || [];
  if (!compatibleTypes.includes(normalizedType)) {
    return { valid: false, message: "Unsupported file type or mismatched file extension" };
  }

  return {
    valid: true,
    extension,
    contentType: normalizedType,
    sizeBytes: parsedSize,
  };
}

export function validateStoredReceiptUpload({
  expectedSizeBytes,
  expectedContentType,
  actualSizeBytes,
  actualContentType,
  maxUploadBytes,
}) {
  const expectedSize = Number(expectedSizeBytes);
  const actualSize = Number(actualSizeBytes);
  const parsedMax = Number(maxUploadBytes);
  const expectedType = normalizeReceiptContentType(expectedContentType);
  const actualType = normalizeReceiptContentType(actualContentType);

  if (!Number.isSafeInteger(actualSize) || actualSize <= 0) {
    return { valid: false, message: "Uploaded file has an invalid size" };
  }
  if (actualSize > parsedMax) {
    return { valid: false, message: "Uploaded file exceeds the maximum upload size" };
  }
  if (!Number.isSafeInteger(expectedSize) || expectedSize !== actualSize) {
    return { valid: false, message: "Uploaded file size does not match the requested upload" };
  }
  if (actualType && expectedType && actualType !== expectedType) {
    return { valid: false, message: "Uploaded file type does not match the requested upload" };
  }

  return { valid: true, sizeBytes: actualSize, contentType: actualType || expectedType };
}

export function hasReceiptFileSignature(buffer, contentType) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const type = normalizeReceiptContentType(contentType);
  if (!bytes.length) return false;

  if (type === "application/pdf") {
    return bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"));
  }
  if (["image/jpeg", "image/jpg", "image/pjpeg"].includes(type)) {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (["image/tiff", "image/x-tiff"].includes(type)) {
    const header = bytes.subarray(0, 4).toString("hex");
    return header === "49492a00" || header === "4d4d002a";
  }
  if (["image/bmp", "image/x-bmp", "image/x-ms-bmp"].includes(type)) {
    return bytes.length >= 2 && bytes.subarray(0, 2).toString("ascii") === "BM";
  }
  if (type === "image/webp") {
    return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (["image/heic", "image/heic-sequence", "image/heif", "image/heif-sequence"].includes(type)) {
    if (bytes.length < 12 || bytes.subarray(4, 8).toString("ascii") !== "ftyp") return false;
    const brand = bytes.subarray(8, 12).toString("ascii");
    return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand);
  }
  return false;
}

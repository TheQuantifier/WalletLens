// src/services/r2.service.js
import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import env from "../config/env.js";
import { isSystemHealthServiceDeactivated } from "./system_health_controls.service.js";

// ---------------------------------------------------------
// R2 / S3-compatible client (Cloudflare R2)
// ---------------------------------------------------------
export const r2 = new S3Client({
  region: env.objectStore.region || "auto",
  endpoint: env.objectStore.endpoint,
  credentials: {
    accessKeyId: env.objectStore.accessKeyId,
    secretAccessKey: env.objectStore.secretAccessKey,
  },
  forcePathStyle: env.objectStore.forcePathStyle,
});

// ---------------------------------------------------------
// Generate a stable, safe object key
// users/<userId>/receipts/<receiptId>/<random>.<ext>
// ---------------------------------------------------------
export function makeObjectKey({ userId, fileId, filename }) {
  const safeName = String(filename || "file")
    .replace(/[^\w.\-]+/g, "_")
    .toLowerCase();

  const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
  const rand = crypto.randomBytes(8).toString("hex");

  return `users/${userId}/receipts/${fileId}/${rand}.${ext}`;
}

// ---------------------------------------------------------
// Presigned PUT (direct upload from client)
// ---------------------------------------------------------
export async function presignPut({ key, contentType, expiresIn = 60 }) {
  if (await isSystemHealthServiceDeactivated("object_storage_connection")) {
    throw new Error("Object storage is disconnected by admin.");
  }
  const cmd = new PutObjectCommand({
    Bucket: env.objectStore.bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2, cmd, { expiresIn });
}

// ---------------------------------------------------------
// Presigned GET (temporary download access)
// ---------------------------------------------------------
export async function presignGet({ key, expiresIn = 60 }) {
  if (await isSystemHealthServiceDeactivated("object_storage_connection")) {
    throw new Error("Object storage is disconnected by admin.");
  }
  const cmd = new GetObjectCommand({
    Bucket: env.objectStore.bucket,
    Key: key,
  });

  return getSignedUrl(r2, cmd, { expiresIn });
}

// ---------------------------------------------------------
// HEAD object (existence / metadata check)
// ---------------------------------------------------------
export async function headObject({ key }) {
  if (await isSystemHealthServiceDeactivated("object_storage_connection")) {
    throw new Error("Object storage is disconnected by admin.");
  }
  const cmd = new HeadObjectCommand({
    Bucket: env.objectStore.bucket,
    Key: key,
  });

  return r2.send(cmd);
}

// ---------------------------------------------------------
// DELETE object
// ---------------------------------------------------------
export async function deleteObject({ key }) {
  if (await isSystemHealthServiceDeactivated("object_storage_connection")) {
    throw new Error("Object storage is disconnected by admin.");
  }
  const cmd = new DeleteObjectCommand({
    Bucket: env.objectStore.bucket,
    Key: key,
  });

  return r2.send(cmd);
}

// src/routes/receipts.routes.js
import express from "express";
import multer from "multer";

import * as controller from "../controllers/receipts.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

/*
|--------------------------------------------------------------------------
| Presigned Upload Flow (R2)
|--------------------------------------------------------------------------
| 1) Client requests upload URL
| 2) Client PUTs file to R2 directly
| 3) Client confirms upload (server verifies + saves metadata)
*/

// Get a presigned PUT URL + create pending metadata row
router.post("/presign", auth, controller.presignUpload);

// Scan-only: OCR + AI parse without object storage
router.post("/scan", auth, upload.single("file"), controller.scanOnly);

// Confirm upload completed (optionally HEAD object) and finalize metadata
router.post("/:id/confirm", auth, controller.confirmUpload);

/*
|--------------------------------------------------------------------------
| Receipt CRUD
|--------------------------------------------------------------------------
*/
router.get("/", auth, controller.getAll);

// IMPORTANT: Download route before :id
router.get("/:id/download", auth, controller.download);

router.get("/:id", auth, controller.getOne);

router.delete("/:id", auth, controller.remove);

export default router;

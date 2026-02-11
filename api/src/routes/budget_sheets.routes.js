// src/routes/budget_sheets.routes.js
import express from "express";
import * as controller from "../controllers/budget_sheets.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// All budget sheets routes require auth
router.use(auth);

router.get("/", controller.getAll);
router.get("/lookup", controller.lookup);
router.get("/summary", controller.summary);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;

import express from "express";
import auth from "../middleware/auth.js";
import * as controller from "../controllers/planning_sheets.controller.js";

const router = express.Router();

router.use(auth);
router.get("/", controller.getOne);
router.put("/", controller.save);

export default router;

import express from "express";

import * as controller from "../controllers/rules.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.param("id", (req, res, next, id) => {
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ message: "Invalid rule ID format." });
  }
  next();
});

router.get("/", auth, controller.getAll);
router.post("/", auth, controller.create);
router.post("/apply", auth, controller.applyAll);
router.patch("/:id", auth, controller.patch);
router.delete("/:id", auth, controller.remove);

export default router;

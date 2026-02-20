// src/routes/net_worth.routes.js
import express from "express";

import auth from "../middleware/auth.js";
import * as controller from "../controllers/net_worth.controller.js";

const router = express.Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.param("id", (req, res, next, id) => {
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ message: "Invalid net worth item ID format." });
  }
  next();
});

router.get("/", auth, controller.list);
router.post("/", auth, controller.create);
router.put("/:id", auth, controller.update);
router.delete("/:id", auth, controller.remove);

export default router;

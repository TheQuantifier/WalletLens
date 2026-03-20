import express from "express";

import * as controller from "../controllers/plaid.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.use(auth);

router.param("id", (req, res, next, id) => {
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ message: "Invalid linked account ID format." });
  }
  next();
});

router.get("/accounts", controller.getAccounts);
router.post("/link-token", controller.createLinkToken);
router.post("/exchange", controller.exchangePublicToken);
router.post("/sync", controller.syncTransactions);
router.delete("/accounts/:id", controller.removeAccount);

export default router;

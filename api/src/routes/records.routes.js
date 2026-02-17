// src/routes/records.routes.js
import express from "express";

import * as controller from "../controllers/records.controller.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Validate :id parameter (UUID)
|--------------------------------------------------------------------------
*/
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.param("id", (req, res, next, id) => {
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ message: "Invalid record ID format." });
  }
  next();
});

/*
|--------------------------------------------------------------------------
| GET all records
|--------------------------------------------------------------------------
*/
router.get("/stats", auth, controller.getStats);
router.get("/categories", auth, controller.getCategories);
router.get("/", auth, controller.getAll);

/*
|--------------------------------------------------------------------------
| CREATE new record
|--------------------------------------------------------------------------
*/
router.post("/", auth, controller.create);

/*
|--------------------------------------------------------------------------
| GET a single record
|--------------------------------------------------------------------------
*/
router.get("/:id", auth, controller.getOne);

/*
|--------------------------------------------------------------------------
| UPDATE a record
|--------------------------------------------------------------------------
*/
router.put("/:id", auth, controller.update);

/*
|--------------------------------------------------------------------------
| DELETE a record
|--------------------------------------------------------------------------
*/
router.delete("/:id", auth, controller.remove);

export default router;

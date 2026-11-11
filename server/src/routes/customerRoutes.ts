import { Router } from "express";
import {
  getCustomers,
  createCustomer,
} from "../controllers/customerController.js";

const router = Router();

router.post("/", createCustomer);

// GET /api/customers
router.get("/", getCustomers);

export default router;

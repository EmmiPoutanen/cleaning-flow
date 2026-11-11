import { Router } from "express";
import { getDailyReport } from "../controllers/reportController.js";

const router = Router();

router.get("/daily", getDailyReport);

export default router;

import { Router } from "express";
import {
  getVisits,
  createVisit,
  updateVisitStatus,
} from "../controllers/visitController.js";

const router = Router();

router.get("/", getVisits);
router.post("/", createVisit);
router.patch("/:id/status", updateVisitStatus);

export default router;

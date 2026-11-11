/** @file Express handler for daily visit counts and planned working time. */

import type { Request, Response } from "express";
import db from "../database/database.js";
import { isValidDate } from "../utils/date.js";

/**
 * Returns visit counts and planned duration for a valid YYYY-MM-DD query date.
 *
 * @param req - Request with a YYYY-MM-DD date query parameter.
 * @param res - Express JSON response.
 * @returns The Express response after sending daily totals (200) or an invalid-date error (400).
 */
export function getDailyReport(req: Request, res: Response) {
  const date = req.query.date;

  // Validate the date format
  if (!isValidDate(date)) {
    return res.status(400).json({
      error: "Please provide a date in YYYY-MM-DD format.",
    });
  }

  const report = db
    .prepare(
      `
    SELECT
      COUNT(*) AS totalVisits,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedVisits,
      COALESCE(SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END), 0) AS pendingVisits,
      COALESCE(SUM(duration_minutes), 0) AS plannedMinutes
    FROM cleaning_visits
    WHERE date = ?
  `,
    )
    .get(date) as {
    totalVisits: number;
    completedVisits: number;
    pendingVisits: number;
    plannedMinutes: number;
  };

  return res.json({
    date,
    ...report,
    plannedHours: Number((report.plannedMinutes / 60).toFixed(2)),
  });
}

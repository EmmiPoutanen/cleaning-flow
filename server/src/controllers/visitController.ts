/** @file Express handlers for scheduling visits, listing them, and updating their status. */

import type { Request, Response } from "express";
import db from "../database/database.js";
import { summarizeNotes } from "../services/notesSummary.js";
import { isValidDate } from "../utils/date.js";

/**
 * Returns visits ordered by date with customer names and addresses.
 *
 * @param _req - Unused Express request.
 * @param res - Express JSON response.
 * @returns The Express response object after sending the visit array as JSON (200).
 */
export function getVisits(_req: Request, res: Response) {
  const visits = db
    .prepare(
      `
    SELECT
      cleaning_visits.*,
      customers.name AS customer_name,
      customers.address AS customer_address
    FROM cleaning_visits
    JOIN customers ON cleaning_visits.customer_id = customers.id
    ORDER BY cleaning_visits.date
  `,
    )
    .all();

  return res.json(visits);
}

/**
 * Validates and saves a scheduled visit, then attempts to summarize its notes.
 *
 * @param req - Body with customerId, employeeName, date, durationMinutes, and optional notes.
 * @param res - Express JSON response.
 * @returns A promise resolving to the Express response after sending visit JSON (201)
 * or a validation (400) or missing-customer (404) error; database failures reject the promise.
 */
export async function createVisit(req: Request, res: Response) {
  const { customerId, employeeName, date, durationMinutes, notes } =
    req.body ?? {};

  // Validate required fields
  if (
    !Number.isInteger(customerId) ||
    typeof employeeName !== "string" ||
    !employeeName.trim() ||
    !isValidDate(date) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return res.status(400).json({
      error: "Customer, employee, valid date and duration are required.",
    });
  }

  // Check that the customer exists
  const customer = db
    .prepare("SELECT id FROM customers WHERE id = ?")
    .get(customerId);

  if (!customer) {
    return res.status(404).json({
      error: "Customer not found.",
    });
  }

  const visitNotes =
    typeof notes === "string" && notes.trim() ? notes.trim() : null;

  // Insert the visit into the database
  const result = db
    .prepare(
      `
    INSERT INTO cleaning_visits (
      customer_id,
      employee_name,
      date,
      duration_minutes,
      notes
    )
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(customerId, employeeName.trim(), date, durationMinutes, visitNotes);

  // Save first so an AI outage cannot prevent scheduling. No database transaction
  // is held open while waiting for the external service.
  const summary = await summarizeNotes(visitNotes);
  if (summary !== null) {
    db.prepare("UPDATE cleaning_visits SET notes_summary = ? WHERE id = ?").run(
      summary,
      result.lastInsertRowid,
    );
  }

  // Retrieve the newly created visit with customer information
  const newVisit = db
    .prepare(
      `
    SELECT
      cleaning_visits.*,
      customers.name AS customer_name,
      customers.address AS customer_address
    FROM cleaning_visits
    JOIN customers ON cleaning_visits.customer_id = customers.id
    WHERE cleaning_visits.id = ?
  `,
    )
    .get(result.lastInsertRowid);

  return res.status(201).json(newVisit);
}

/**
 * Validates the visit ID and status, then returns the updated visit with customer details.
 *
 * @param req - Visit ID in params.id and target status in body.status.
 * @param res - Express JSON response.
 * @returns The Express response after sending updated visit JSON (200) or an error (400 or 404).
 */
export function updateVisitStatus(req: Request, res: Response) {
  const visitId = Number(req.params.id);
  const { status } = req.body ?? {};

  // Validate the visit ID and status
  if (
    !Number.isInteger(visitId) ||
    visitId <= 0 ||
    !["scheduled", "completed"].includes(status)
  ) {
    return res.status(400).json({
      error: "Invalid visit ID or status.",
    });
  }

  // Check that the visit exists
  const visit = db
    .prepare("SELECT id FROM cleaning_visits WHERE id = ?")
    .get(visitId);

  if (!visit) {
    return res.status(404).json({
      error: "Cleaning visit not found.",
    });
  }

  // Update the visit status
  db.prepare("UPDATE cleaning_visits SET status = ? WHERE id = ?").run(
    status,
    visitId,
  );

  // Return the updated visit
  const updatedVisit = db
    .prepare(
      `
    SELECT
      cleaning_visits.*,
      customers.name AS customer_name,
      customers.address AS customer_address
    FROM cleaning_visits
    JOIN customers ON cleaning_visits.customer_id = customers.id
    WHERE cleaning_visits.id = ?
  `,
    )
    .get(visitId);

  return res.json(updatedVisit);
}

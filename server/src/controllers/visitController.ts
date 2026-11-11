import type { Request, Response } from "express";
import db from "../database/database.js";
import { summarizeNotes } from "../services/notesSummary.js";
import { isValidDate } from "../utils/date.js";

// Get all cleaning visits
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

// Create a new cleaning visit
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

// Update the status of a cleaning visit
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

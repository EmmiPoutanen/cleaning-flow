/** @file Express handlers for listing and creating customer records. */

import type { Request, Response } from "express";
import db from "../database/database.js";

/**
 * Returns all customers ordered by name.
 *
 * @param _req - Unused Express request.
 * @param res - Express response used to send the customer array as JSON.
 * @returns void; sends HTTP 200 with the customer list.
 */
export function getCustomers(_req: Request, res: Response) {
  const customers = db.prepare("SELECT * FROM customers ORDER BY name").all();

  res.json(customers);
}

/**
 * Validates required fields and creates a customer, normalizing blank contacts to null.
 *
 * @param req - Request body with name, address, and optional email and phone.
 * @param res - Express JSON response.
 * @returns The Express response object after sending customer JSON (201) or a validation error (400).
 */
export function createCustomer(req: Request, res: Response) {
  const { name, email, phone, address } = req.body ?? {};

  // Validate required fields
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof address !== "string" ||
    !address.trim()
  ) {
    return res.status(400).json({
      error: "Customer name and address are required.",
    });
  }

  // Insert the customer into the database
  const result = db
    .prepare(
      `
    INSERT INTO customers (name, email, phone, address)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(
      name.trim(),
      typeof email === "string" && email.trim() ? email.trim() : null,
      typeof phone === "string" && phone.trim() ? phone.trim() : null,
      address.trim(),
    );

  // Retrieve the newly created customer
  const customer = db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(result.lastInsertRowid);

  return res.status(201).json(customer);
}

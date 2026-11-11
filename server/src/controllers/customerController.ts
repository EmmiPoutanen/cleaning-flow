import type { Request, Response } from "express";
import db from "../database/database.js";

// Get all customers from the database
export function getCustomers(_req: Request, res: Response) {
  const customers = db.prepare("SELECT * FROM customers ORDER BY name").all();

  res.json(customers);
}
// Create a new customer
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

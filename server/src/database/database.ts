/** @file Opens the shared SQLite connection and initializes or upgrades the schema on import. */

import Database from "better-sqlite3";

// Create or open the database file
const db: Database.Database = new Database(
  process.env.DATABASE_PATH ?? "Cleaning-flow.db",
);

// Enable foreign key constraints
db.pragma("foreign_keys = ON");

// Create database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cleaning_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`);

// Add the summary column to existing databases without changing saved notes.
const visitColumns = db
  .prepare("PRAGMA table_info(cleaning_visits)")
  .all() as Array<{ name: string }>;
if (!visitColumns.some((column) => column.name === "notes_summary")) {
  db.exec("ALTER TABLE cleaning_visits ADD COLUMN notes_summary TEXT");
}

export default db;

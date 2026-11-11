import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";

test("adds the summary column to an existing database without losing notes and can reopen it", async () => {
  const directory = mkdtempSync(join(tmpdir(), "cleaning-flow-migration-"));
  const path = join(directory, "legacy.db");
  const legacy = new Database(path);
  legacy.exec(`
    CREATE TABLE cleaning_visits (
      id INTEGER PRIMARY KEY, customer_id INTEGER, employee_name TEXT,
      date TEXT, duration_minutes INTEGER, status TEXT, notes TEXT
    );
    INSERT INTO cleaning_visits VALUES (1, 1, 'Emmi', '2026-11-10', 60, 'scheduled', 'Keep door closed.');
  `);
  legacy.close();
  vi.stubEnv("DATABASE_PATH", path);
  try {
    vi.resetModules();
    const { default: migrated } = await import("../src/database/database.js");
    try {
      expect(
        migrated
          .prepare("SELECT notes, notes_summary FROM cleaning_visits")
          .get(),
      ).toEqual({ notes: "Keep door closed.", notes_summary: null });
    } finally {
      migrated.close();
    }
    vi.resetModules();
    const { default: reopened } = await import("../src/database/database.js");
    try {
      expect(
        reopened.prepare("SELECT COUNT(*) AS count FROM cleaning_visits").get(),
      ).toEqual({ count: 1 });
    } finally {
      reopened.close();
    }
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
    rmSync(directory, { recursive: true });
  }
});

import request from "supertest";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import app from "../src/app.js";
import db from "../src/database/database.js";

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "");
  db.exec("DELETE FROM cleaning_visits; DELETE FROM customers;");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
afterAll(() => db.close());

async function addCustomer(name = "Matti") {
  const response = await request(app)
    .post("/api/customers")
    .send({ name, address: "Test Street 1" })
    .expect(201);
  return response.body;
}

async function addVisit(
  customerId: number,
  date = "2026-11-10",
  durationMinutes = 60,
) {
  const response = await request(app)
    .post("/api/visits")
    .send({
      customerId,
      employeeName: "Emmi",
      date,
      durationMinutes,
    })
    .expect(201);
  return response.body;
}

test("creates customers, trims input, and lists them alphabetically", async () => {
  await addCustomer("  Zoe  ");
  await addCustomer("Anna");
  const { body } = await request(app).get("/api/customers").expect(200);
  expect(body.map((customer: { name: string }) => customer.name)).toEqual([
    "Anna",
    "Zoe",
  ]);
  expect(body[1]).toMatchObject({
    address: "Test Street 1",
    email: null,
    phone: null,
  });
});

test.each([
  { name: "", address: "Street 1" },
  { name: "Matti", address: "   " },
])("rejects a customer with missing required fields: %j", async (payload) => {
  await request(app).post("/api/customers").send(payload).expect(400);
  const { body } = await request(app).get("/api/customers").expect(200);
  expect(body).toEqual([]);
});

test("schedules a visit with customer details and persists its completed status", async () => {
  const customer = await addCustomer();
  const visit = await addVisit(customer.id);
  expect(visit).toMatchObject({
    customer_id: customer.id,
    customer_name: "Matti",
    customer_address: "Test Street 1",
    status: "scheduled",
    duration_minutes: 60,
  });

  const { body: updated } = await request(app)
    .patch(`/api/visits/${visit.id}/status`)
    .send({ status: "completed" })
    .expect(200);
  expect(updated.status).toBe("completed");
  const { body } = await request(app).get("/api/visits").expect(200);
  expect(body).toEqual([updated]);
});

test.each([
  { employeeName: " " },
  { date: "not-a-date" },
  { date: "2026-02-31" },
  { date: "2026-99-99" },
  { date: "2026-02-29" },
  { durationMinutes: 0 },
  { durationMinutes: 1.5 },
])("rejects invalid visit input: %j", async (invalidFields) => {
  const customer = await addCustomer();
  await request(app)
    .post("/api/visits")
    .send({
      customerId: customer.id,
      employeeName: "Emmi",
      date: "2026-11-10",
      durationMinutes: 60,
      ...invalidFields,
    })
    .expect(400);
  const { body } = await request(app).get("/api/visits").expect(200);
  expect(body).toEqual([]);
});

test("returns 404 when scheduling for an unknown customer", async () => {
  await request(app)
    .post("/api/visits")
    .send({
      customerId: 999,
      employeeName: "Emmi",
      date: "2026-11-10",
      durationMinutes: 60,
    })
    .expect(404);
});

test("rejects an unsupported status without changing the visit", async () => {
  const customer = await addCustomer();
  const visit = await addVisit(customer.id);
  await request(app)
    .patch(`/api/visits/${visit.id}/status`)
    .send({ status: "invalid" })
    .expect(400);
  const { body } = await request(app).get("/api/visits").expect(200);
  expect(body[0].status).toBe("scheduled");
});

test("returns 404 when updating an unknown visit", async () => {
  await request(app)
    .patch("/api/visits/999/status")
    .send({ status: "completed" })
    .expect(404);
});

test("daily report counts statuses and working time for only the requested date", async () => {
  const customer = await addCustomer();
  const visit = await addVisit(customer.id, "2026-11-10", 90);
  await addVisit(customer.id, "2026-11-10", 35);
  await addVisit(customer.id, "2026-11-11", 240);
  await request(app)
    .patch(`/api/visits/${visit.id}/status`)
    .send({ status: "completed" })
    .expect(200);
  const { body } = await request(app)
    .get("/api/reports/daily?date=2026-11-10")
    .expect(200);
  expect(body).toEqual({
    date: "2026-11-10",
    totalVisits: 2,
    completedVisits: 1,
    pendingVisits: 1,
    plannedMinutes: 125,
    plannedHours: 2.08,
  });
});

test("daily report returns zero totals for a day without visits", async () => {
  const { body } = await request(app)
    .get("/api/reports/daily?date=2026-11-10")
    .expect(200);
  expect(body).toEqual({
    date: "2026-11-10",
    totalVisits: 0,
    completedVisits: 0,
    pendingVisits: 0,
    plannedMinutes: 0,
    plannedHours: 0,
  });
});

test.each([
  "",
  "?date=invalid",
  "?date=2026-02-31",
  "?date=2026-99-99",
  "?date=2026-02-29",
])("rejects a missing or malformed report date: %s", async (query) => {
  await request(app).get(`/api/reports/daily${query}`).expect(400);
});

test("accepts leap day for scheduling and daily reports", async () => {
  const customer = await addCustomer();
  const visit = await addVisit(customer.id, "2028-02-29");
  expect(visit.date).toBe("2028-02-29");
  const { body } = await request(app)
    .get("/api/reports/daily?date=2028-02-29")
    .expect(200);
  expect(body.totalVisits).toBe(1);
});

test("saves the summary with its visit and keeps it when completing the visit", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const fetchMock = vi.fn().mockResolvedValue(
    Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                bullets: ["Focus on kitchen.", "Skip office."],
              }),
            },
          ],
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const customer = await addCustomer();
  const { body: visit } = await request(app)
    .post("/api/visits")
    .send({
      customerId: customer.id,
      employeeName: "Emmi",
      date: "2026-11-10",
      durationMinutes: 60,
      notes: "  Focus on kitchen. Skip office.  ",
    })
    .expect(201);
  expect(visit).toMatchObject({
    notes: "Focus on kitchen. Skip office.",
    notes_summary: "Focus on kitchen.\nSkip office.",
  });
  const { body: visits } = await request(app).get("/api/visits").expect(200);
  expect(visits).toEqual([visit]);
  const { body: updated } = await request(app)
    .patch(`/api/visits/${visit.id}/status`)
    .send({ status: "completed" })
    .expect(200);
  expect(updated.notes_summary).toBe(visit.notes_summary);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([true, false])(
  "scheduling succeeds when AI is unavailable (key configured: %s)",
  async (configured) => {
    vi.stubEnv("OPENAI_API_KEY", configured ? "test-key" : "");
    const fetchMock = vi.fn().mockRejectedValue(new Error("Offline"));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const customer = await addCustomer();
    const { body } = await request(app)
      .post("/api/visits")
      .send({
        customerId: customer.id,
        employeeName: "Emmi",
        date: "2026-11-10",
        durationMinutes: 60,
        notes: "Keep bedroom door closed.",
      })
      .expect(201);
    expect(body).toMatchObject({
      notes: "Keep bedroom door closed.",
      notes_summary: null,
    });
    const { body: visits } = await request(app).get("/api/visits").expect(200);
    expect(visits).toEqual([body]);
    expect(fetchMock).toHaveBeenCalledTimes(configured ? 1 : 0);
  },
);

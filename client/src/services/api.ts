/** @file Shared API payload types and JSON request helpers for the React client. */

const API_URL = "http://localhost:3000/api";

/** Persisted customer; omitted contact details are returned as null. */
export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
}

/** Persisted visit with joined customer details for display. */
export interface Visit {
  id: number;
  customer_id: number;
  employee_name: string;
  /** Calendar date in YYYY-MM-DD format. */
  date: string;
  duration_minutes: number;
  status: "scheduled" | "completed";
  notes: string | null;
  /** Newline-separated bullets; empty means no actionable details, null means unavailable. */
  notes_summary: string | null;
  customer_name: string;
  customer_address: string;
}

/** Visit creation payload; the server assigns its ID and initial scheduled status. */
export interface NewVisit {
  /** Existing customer ID; the form uses 0 until a customer is selected. */
  customerId: number;
  employeeName: string;
  /** Calendar date in YYYY-MM-DD format. */
  date: string;
  /** Planned duration as a positive integer number of minutes. */
  durationMinutes: number;
  /** Original instructions; an empty string means no notes. */
  notes: string;
}

/** Visit totals and planned duration for one calendar date. */
export interface DailyReport {
  /** Calendar date in YYYY-MM-DD format. */
  date: string;
  totalVisits: number;
  completedVisits: number;
  /** Visits whose status is scheduled. */
  pendingVisits: number;
  plannedMinutes: number;
  /** Planned minutes converted to hours and rounded to two decimal places. */
  plannedHours: number;
}

/**
 * Parses a JSON response as T; rejects on network errors, non-2xx status, or invalid JSON.
 *
 * @template T - Expected response shape; not validated at runtime.
 * @param endpoint - API path relative to /api.
 * @param options - Optional fetch method, headers, and body.
 * @returns A promise resolving to the parsed JSON response as T.
 */
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetches all customers ordered by name.
 *
 * @returns A promise resolving to the customer array, including an empty array when none exist.
 */
export function getCustomers() {
  return request<Customer[]>("/customers");
}

/**
 * Fetches all visits ordered by date, including customer names and addresses.
 *
 * @returns A promise resolving to the visit array with customer details.
 */
export function getVisits() {
  return request<Visit[]>("/visits");
}

/**
 * Fetches visit counts and planned duration for a YYYY-MM-DD calendar date.
 *
 * @param date - Calendar date in YYYY-MM-DD format.
 * @returns A promise resolving to daily totals, including zero totals for a date with no visits.
 */
export function getDailyReport(date: string) {
  return request<DailyReport>(`/reports/daily?date=${date}`);
}

/** Customer creation payload; email and phone must be present but may be empty strings. */
export interface NewCustomer {
  name: string;
  /** Empty or whitespace-only input is stored as null by the server. */
  email: string;
  /** Empty or whitespace-only input is stored as null by the server. */
  phone: string;
  address: string;
}

/**
 * Creates a customer and returns the persisted record.
 *
 * @param customer - Customer details; name and address must be nonblank.
 * @returns A promise resolving to the saved customer with its assigned ID.
 */
export function createCustomer(customer: NewCustomer) {
  return request<Customer>("/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(customer),
  });
}

/**
 * Schedules a visit and returns it with customer details and any generated summary.
 *
 * @param visit - Visit details with an existing customer ID and positive integer duration.
 * @returns A promise resolving to the saved visit with customer details and an optional summary.
 */
export function createVisit(visit: NewVisit) {
  return request<Visit>("/visits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(visit),
  });
}

/**
 * Persists the visit status and returns the updated visit with customer details.
 *
 * @param visitId - ID of the visit to update.
 * @param status - Target status: scheduled or completed.
 * @returns A promise resolving to the updated visit with customer details.
 */
export function updateVisitStatus(
  visitId: number,
  status: "scheduled" | "completed",
) {
  return request<Visit>(`/visits/${visitId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}

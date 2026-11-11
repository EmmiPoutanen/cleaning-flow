const API_URL = "http://localhost:3000/api";

// Customer returned by the backend
export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string;
}

// Cleaning visit returned by the backend
export interface Visit {
  id: number;
  customer_id: number;
  employee_name: string;
  date: string;
  duration_minutes: number;
  status: "scheduled" | "completed";
  notes: string | null;
  notes_summary: string | null;
  customer_name: string;
  customer_address: string;
}

export interface NewVisit {
  customerId: number;
  employeeName: string;
  date: string;
  durationMinutes: number;
  notes: string;
}

// Daily report returned by the backend
export interface DailyReport {
  date: string;
  totalVisits: number;
  completedVisits: number;
  pendingVisits: number;
  plannedMinutes: number;
  plannedHours: number;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, options);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Get all customers
export function getCustomers() {
  return request<Customer[]>("/customers");
}

// Get all cleaning visits
export function getVisits() {
  return request<Visit[]>("/visits");
}

// Get daily report
export function getDailyReport(date: string) {
  return request<DailyReport>(`/reports/daily?date=${date}`);
}

export interface NewCustomer {
  name: string;
  email: string;
  phone: string;
  address: string;
}

// Create a new customer
export function createCustomer(customer: NewCustomer) {
  return request<Customer>("/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(customer),
  });
}

// Create a new cleaning visit
export function createVisit(visit: NewVisit) {
  return request<Visit>("/visits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(visit),
  });
}

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

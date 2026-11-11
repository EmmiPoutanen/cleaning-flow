import { useEffect, useState } from "react";
import {
  getDailyReport,
  getCustomers,
  getVisits,
  updateVisitStatus,
  type DailyReport,
  type Customer,
  type Visit,
} from "./services/api";
import "./App.css";

import CustomerManagement from "./components/CustomerManagement";
import VisitManagement from "./components/VisitManagement";

// Get today's date in local time as YYYY-MM-DD
function getToday(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [updatingVisitId, setUpdatingVisitId] = useState<number | null>(null);

  // Load dashboard data whenever the selected date changes
  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const [dailyReport, allVisits, allCustomers] = await Promise.all([
          getDailyReport(selectedDate),
          getVisits(),
          getCustomers(),
        ]);

        if (cancelled) return;
        setCustomers(allCustomers);

        setReport(dailyReport);

        // Only show visits belonging to the selected date
        setVisits(allVisits.filter((visit) => visit.date === selectedDate));
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load dashboard:", err);
        setError("Could not load dashboard data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  async function handleStatusChange(visitId: number) {
    try {
      setUpdatingVisitId(visitId);
      setStatusError(null);

      const updatedVisit = await updateVisitStatus(visitId, "completed");

      // Update the visit in the current list
      setVisits((previous) =>
        previous.map((visit) => (visit.id === visitId ? updatedVisit : visit)),
      );

      // Update the daily report
      setReport((previous) => {
        if (!previous || previous.date !== updatedVisit.date) return previous;

        return {
          ...previous,
          completedVisits: previous.completedVisits + 1,
          pendingVisits: previous.pendingVisits - 1,
        };
      });
    } catch (err) {
      console.error("Failed to update visit status:", err);
      setStatusError("Could not update visit status. Please try again.");
    } finally {
      setUpdatingVisitId(null);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">C</span>
          <span>Cleaning Flow</span>
        </div>

        <nav className="topbar-nav" aria-label="Main navigation">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "schedule", label: "Schedule cleaning visits" },
            { id: "customers", label: "Add customer" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="dashboard">
        <div hidden={activeTab !== "dashboard"}>
          <section className="page-heading">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>Dashboard</h1>
              <p className="subtitle">
                Manage your cleaning visits and daily operations.
              </p>
            </div>

            <div className="date-control">
              <label htmlFor="dashboard-date">Selected date</label>
              <input
                id="dashboard-date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>
          </section>
        </div>

        {loading ? (
          <p className="message">Loading dashboard...</p>
        ) : error ? (
          <p className="message error">{error}</p>
        ) : report ? (
          <>
            <div hidden={activeTab !== "dashboard"}>
              {statusError && (
                <p className="message error" role="alert">
                  {statusError}
                </p>
              )}
              <section className="stats-grid">
                <article className="stat-card">
                  <p>Total visits</p>
                  <strong>{report.totalVisits}</strong>
                  <span>Scheduled for this day</span>
                </article>

                <article className="stat-card">
                  <p>Completed</p>
                  <strong>{report.completedVisits}</strong>
                  <span>Successfully finished</span>
                </article>

                <article className="stat-card">
                  <p>Pending</p>
                  <strong>{report.pendingVisits}</strong>
                  <span>Still to be completed</span>
                </article>

                <article className="stat-card">
                  <p>Planned working time</p>
                  <strong>{report.plannedHours} h</strong>
                  <span>{report.plannedMinutes} minutes in total</span>
                </article>
              </section>

              <section className="visits-section">
                <div className="section-heading">
                  <div>
                    <h2>Cleaning visits</h2>
                    <p>All visits scheduled for the selected date.</p>
                  </div>

                  <span className="visit-count">{visits.length} visits</span>
                </div>

                {visits.length === 0 ? (
                  <div className="empty-state">
                    <h3>No cleaning visits</h3>
                    <p>There are no visits scheduled for this date.</p>
                  </div>
                ) : (
                  <div className="visits-list">
                    {visits.map((visit) => (
                      <article className="visit-card" key={visit.id}>
                        <div className="visit-main">
                          <div className="visit-icon">⌂</div>

                          <div>
                            <h3>{visit.customer_name}</h3>
                            <p>{visit.customer_address}</p>
                          </div>
                        </div>

                        <div className="visit-details">
                          <span>{visit.employee_name}</span>
                          <span>{visit.duration_minutes} min</span>

                          <span
                            className={`status ${
                              visit.status === "completed"
                                ? "status-completed"
                                : "status-pending"
                            }`}
                          >
                            {visit.status === "completed"
                              ? "Completed"
                              : "Scheduled"}
                          </span>
                          {visit.status === "scheduled" && (
                            <button
                              className="complete-button"
                              onClick={() => {
                                void handleStatusChange(visit.id);
                              }}
                              disabled={updatingVisitId === visit.id}
                            >
                              {updatingVisitId === visit.id
                                ? "Updating..."
                                : "Mark as completed"}
                            </button>
                          )}
                        </div>
                        {visit.notes && (
                          <section
                            className="visit-notes"
                            aria-label="Visit notes"
                          >
                            <h4>AI summary</h4>
                            {visit.notes_summary ? (
                              <ul>
                                {visit.notes_summary
                                  .split("\n")
                                  .map((bullet, index) => (
                                    <li key={index}>{bullet}</li>
                                  ))}
                              </ul>
                            ) : (
                              <p>
                                {visit.notes_summary === ""
                                  ? "No actionable details found."
                                  : "Summary unavailable. Please read the original notes."}
                              </p>
                            )}
                            <details>
                              <summary>Original notes</summary>
                              <p className="original-notes">{visit.notes}</p>
                            </details>
                          </section>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <div hidden={activeTab !== "schedule"}>
              <VisitManagement
                customers={customers}
                selectedDate={selectedDate}
                onVisitCreated={(visit) => {
                  if (visit.date !== selectedDate) {
                    setSelectedDate(visit.date);
                    return;
                  }

                  setVisits((previous) => [...previous, visit]);

                  setReport((previous) => {
                    if (!previous) return previous;

                    const newPlannedMinutes =
                      previous.plannedMinutes + visit.duration_minutes;

                    return {
                      ...previous,
                      totalVisits: previous.totalVisits + 1,
                      pendingVisits: previous.pendingVisits + 1,
                      plannedMinutes: newPlannedMinutes,
                      plannedHours: Number((newPlannedMinutes / 60).toFixed(2)),
                    };
                  });
                }}
              />
            </div>

            <div hidden={activeTab !== "customers"}>
              <CustomerManagement
                customers={customers}
                onCustomerCreated={(customer) => {
                  setCustomers((previous) =>
                    [...previous, customer].sort((a, b) =>
                      a.name.localeCompare(b.name),
                    ),
                  );
                }}
              />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default App;

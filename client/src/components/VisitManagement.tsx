import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  createVisit,
  type Customer,
  type NewVisit,
  type Visit,
} from "../services/api";

interface VisitManagementProps {
  customers: Customer[];
  selectedDate: string;
  onVisitCreated: (visit: Visit) => void;
}

function VisitManagement({
  customers,
  selectedDate,
  onVisitCreated,
}: VisitManagementProps) {
  const [formData, setFormData] = useState<NewVisit>({
    customerId: 0,
    employeeName: "",
    date: selectedDate,
    durationMinutes: 60,
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [previousDate, setPreviousDate] = useState(selectedDate);
  if (previousDate !== selectedDate) {
    setPreviousDate(selectedDate);
    setFormData((previous) => ({ ...previous, date: selectedDate }));
  }

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]:
        name === "customerId" || name === "durationMinutes"
          ? Number(value)
          : value,
    }));

    setSuccess(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (customers.length === 0) {
      setError("Please add a customer before creating a visit.");
      return;
    }

    if (!customers.some((customer) => customer.id === formData.customerId)) {
      setError("Please select a customer before creating a visit.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const newVisit = await createVisit(formData);

      onVisitCreated(newVisit);

      setFormData({
        customerId: 0,
        employeeName: "",
        date: selectedDate,
        durationMinutes: 60,
        notes: "",
      });

      setSuccess(true);
    } catch (err) {
      console.error("Failed to create visit:", err);
      setError("Could not create cleaning visit. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="visits-management">
      <div className="section-heading">
        <div>
          <h2>Schedule a cleaning visit</h2>
          <p>Create a new cleaning appointment.</p>
        </div>
      </div>

      {customers.length === 0 ? (
        <p className="empty-message">
          Add a customer before scheduling a cleaning visit.
        </p>
      ) : (
        <form
          className="visit-form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="visit-customer">Customer *</label>
              <select
                id="visit-customer"
                name="customerId"
                value={formData.customerId || ""}
                onChange={handleChange}
                required
              >
                <option value="" disabled>
                  Select a customer
                </option>

                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="visit-employee">Employee *</label>
              <input
                id="visit-employee"
                name="employeeName"
                value={formData.employeeName}
                onChange={handleChange}
                placeholder="Employee name"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="visit-date">Date *</label>
              <input
                id="visit-date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="visit-duration">Duration (minutes) *</label>
              <input
                id="visit-duration"
                name="durationMinutes"
                type="number"
                min="1"
                value={formData.durationMinutes}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-field notes-field">
            <label htmlFor="visit-notes">Additional notes</label>
            <p id="visit-notes-help">
              Notes are sent to OpenAI to create a short summary for the
              cleaner.
            </p>
            <textarea
              id="visit-notes"
              name="notes"
              aria-describedby="visit-notes-help"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any special instructions for the cleaning visit?"
              rows={3}
            />
          </div>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Schedule visit"}
          </button>

          {error && <p className="form-error">{error}</p>}
          {success && (
            <p className="form-success">
              Cleaning visit scheduled successfully!
            </p>
          )}
        </form>
      )}
    </section>
  );
}

export default VisitManagement;

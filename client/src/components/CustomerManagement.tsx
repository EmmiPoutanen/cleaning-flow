/** @file Customer creation form and customer list, backed by the shared API client. */

import { useState } from "react";
import {
  createCustomer,
  type Customer,
  type NewCustomer,
} from "../services/api";

/** Customer list and notification callback supplied by the parent. */
interface CustomerManagementProps {
  /** Customers to display in the list. */
  customers: Customer[];
  /** Receives the saved customer so the parent can update its shared list. */
  onCustomerCreated: (customer: Customer) => void;
}

/**
 * Displays customers and manages creation feedback and form state.
 *
 * @returns The JSX element containing the customer list and creation form.
 */
function CustomerManagement({
  customers,
  onCustomerCreated,
}: CustomerManagementProps) {
  const [formData, setFormData] = useState<NewCustomer>({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Updates the named field and clears the previous success message.
   *
   * @param event - Change event from a named form control.
   * @returns No value; updates local form state.
   */
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setSuccess(false);
  }

  /**
   * Saves the customer, notifies the parent, and resets the form on success.
   *
   * @param event - Form submission event; default navigation is prevented.
   * @returns A promise resolving without a value; save errors are displayed in the form.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const newCustomer = await createCustomer(formData);

      onCustomerCreated(newCustomer);

      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
      });

      setSuccess(true);
    } catch (err) {
      console.error("Failed to create customer:", err);
      setError("Could not save customer. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="customers-section">
      <div className="section-heading">
        <div>
          <h2>Customers</h2>
          <p>Manage your cleaning customers.</p>
        </div>

        <span className="visit-count">{customers.length} customers</span>
      </div>

      <form
        className="customer-form"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <h3>Add a new customer</h3>

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="customer-name">Customer name *</label>
            <input
              id="customer-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Matti Meikäläinen"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="customer-address">Address *</label>
            <input
              id="customer-address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Street address"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="customer-email">Email</label>
            <input
              id="customer-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="customer@example.com"
            />
          </div>

          <div className="form-field">
            <label htmlFor="customer-phone">Phone</label>
            <input
              id="customer-phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Phone number"
            />
          </div>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Add customer"}
        </button>

        {error && <p className="form-error">{error}</p>}
        {success && (
          <p className="form-success">Customer added successfully!</p>
        )}
      </form>

      <div className="customer-list">
        <h3>Customer list</h3>

        {customers.length === 0 ? (
          <p className="empty-message">No customers added yet.</p>
        ) : (
          customers.map((customer) => (
            <article className="customer-card" key={customer.id}>
              <div>
                <h4>{customer.name}</h4>
                <p>{customer.address}</p>
              </div>

              <div className="customer-contact">
                {customer.email && <span>{customer.email}</span>}
                {customer.phone && <span>{customer.phone}</span>}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default CustomerManagement;

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import CustomerManagement from "./CustomerManagement";
import VisitManagement from "./VisitManagement";
import { createCustomer, createVisit } from "../services/api";

vi.mock("../services/api", () => ({
  createCustomer: vi.fn(),
  createVisit: vi.fn(),
}));

const customer = {
  id: 1,
  name: "Matti",
  address: "Test Street 1",
  email: null,
  phone: null,
};
beforeEach(() => vi.resetAllMocks());

test("submits customer details, notifies the parent, and clears the form", async () => {
  const onCreated = vi.fn();
  vi.mocked(createCustomer).mockResolvedValue(customer);
  render(<CustomerManagement customers={[]} onCustomerCreated={onCreated} />);
  await userEvent.type(screen.getByLabelText("Customer name *"), customer.name);
  await userEvent.type(screen.getByLabelText("Address *"), customer.address);
  await userEvent.type(screen.getByLabelText("Email"), "matti@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Add customer" }));
  expect(await screen.findByText("Customer added successfully!")).toBeVisible();
  expect(createCustomer).toHaveBeenCalledWith({
    name: customer.name,
    address: customer.address,
    email: "matti@example.com",
    phone: "",
  });
  expect(onCreated).toHaveBeenCalledWith(customer);
  expect(screen.getByLabelText("Customer name *")).toHaveValue("");
  expect(screen.getByLabelText("Address *")).toHaveValue("");
});

test("failed customer saves keep the input and allow retrying", async () => {
  const onCreated = vi.fn();
  vi.mocked(createCustomer).mockRejectedValue(new Error("Offline"));
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<CustomerManagement customers={[]} onCustomerCreated={onCreated} />);
    await userEvent.type(
      screen.getByLabelText("Customer name *"),
      customer.name,
    );
    await userEvent.type(screen.getByLabelText("Address *"), customer.address);
    await userEvent.click(screen.getByRole("button", { name: "Add customer" }));
    expect(
      await screen.findByText("Could not save customer. Please try again."),
    ).toBeVisible();
    expect(screen.getByLabelText("Customer name *")).toHaveValue(customer.name);
    expect(screen.getByRole("button", { name: "Add customer" })).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  } finally {
    consoleError.mockRestore();
  }
});

test("requires a customer before showing the scheduling form", () => {
  render(
    <VisitManagement
      customers={[]}
      selectedDate="2026-11-10"
      onVisitCreated={vi.fn()}
    />,
  );
  expect(
    screen.getByText("Add a customer before scheduling a cleaning visit."),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Schedule visit" }),
  ).not.toBeInTheDocument();
  expect(createVisit).not.toHaveBeenCalled();
});

test("requires selecting a customer and guards submissions that bypass native validation", async () => {
  render(
    <VisitManagement
      customers={[customer]}
      selectedDate="2026-11-10"
      onVisitCreated={vi.fn()}
    />,
  );
  const select = screen.getByLabelText("Customer *");
  await userEvent.type(screen.getByLabelText("Employee *"), "Emmi");
  expect(select).toBeInvalid();
  await userEvent.click(screen.getByRole("button", { name: "Schedule visit" }));
  expect(createVisit).not.toHaveBeenCalled();
  fireEvent.submit(select.closest("form")!);
  expect(
    await screen.findByText(
      "Please select a customer before creating a visit.",
    ),
  ).toBeVisible();
  expect(createVisit).not.toHaveBeenCalled();
  await userEvent.selectOptions(select, "1");
  expect(select).toBeValid();
});

test("schedules a visit using the selected date and numeric customer and duration values", async () => {
  const onCreated = vi.fn();
  const savedVisit = {
    id: 1,
    customer_id: 1,
    employee_name: "Emmi",
    date: "2026-11-11",
    duration_minutes: 90,
    status: "scheduled" as const,
    notes: "Bring supplies",
    notes_summary: null,
    customer_name: customer.name,
    customer_address: customer.address,
  };
  vi.mocked(createVisit).mockResolvedValue(savedVisit);
  const { rerender } = render(
    <VisitManagement
      customers={[customer]}
      selectedDate="2026-11-10"
      onVisitCreated={onCreated}
    />,
  );
  rerender(
    <VisitManagement
      customers={[customer]}
      selectedDate="2026-11-11"
      onVisitCreated={onCreated}
    />,
  );
  expect(screen.getByLabelText("Date *")).toHaveValue("2026-11-11");
  await userEvent.selectOptions(screen.getByLabelText("Customer *"), "1");
  await userEvent.type(screen.getByLabelText("Employee *"), "Emmi");
  fireEvent.change(screen.getByLabelText("Duration (minutes) *"), {
    target: { value: "90" },
  });
  await userEvent.type(
    screen.getByLabelText("Additional notes"),
    "Bring supplies",
  );
  await userEvent.click(screen.getByRole("button", { name: "Schedule visit" }));
  expect(
    await screen.findByText("Cleaning visit scheduled successfully!"),
  ).toBeVisible();
  expect(createVisit).toHaveBeenCalledWith({
    customerId: 1,
    employeeName: "Emmi",
    date: "2026-11-11",
    durationMinutes: 90,
    notes: "Bring supplies",
  });
  expect(onCreated).toHaveBeenCalledWith(savedVisit);
  expect(screen.getByLabelText("Employee *")).toHaveValue("");
});

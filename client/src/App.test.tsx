import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";
import * as api from "./services/api";

vi.mock("./services/api", () => ({
  getDailyReport: vi.fn(),
  getCustomers: vi.fn(),
  getVisits: vi.fn(),
  updateVisitStatus: vi.fn(),
  createCustomer: vi.fn(),
  createVisit: vi.fn(),
}));

const customer: api.Customer = {
  id: 1,
  name: "Matti",
  address: "Test Street 1",
  email: null,
  phone: null,
};
const visit: api.Visit = {
  id: 1,
  customer_id: 1,
  employee_name: "Emmi",
  date: "2026-11-10",
  duration_minutes: 60,
  status: "scheduled",
  notes: null,
  notes_summary: null,
  customer_name: customer.name,
  customer_address: customer.address,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 9, 12));
  vi.resetAllMocks();
  vi.mocked(api.getCustomers).mockResolvedValue([customer]);
  vi.mocked(api.getVisits).mockResolvedValue([]);
  vi.mocked(api.getDailyReport).mockImplementation(async (date) => ({
    date,
    totalVisits: 0,
    completedVisits: 0,
    pendingVisits: 0,
    plannedMinutes: 0,
    plannedHours: 0,
  }));
});

afterEach(() => vi.useRealTimers());

async function openDashboard() {
  render(<App />);
  await screen.findByText("No cleaning visits");
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test.each([false, true])(
  "ignores stale dashboard requests (failure: %s)",
  async (failure) => {
    await openDashboard();
    const oldReport = deferred<api.DailyReport>();
    vi.mocked(api.getDailyReport).mockReturnValueOnce(oldReport.promise);
    vi.mocked(api.getVisits).mockResolvedValueOnce([visit]);
    fireEvent.change(screen.getByLabelText("Selected date"), {
      target: { value: visit.date },
    });
    fireEvent.change(screen.getByLabelText("Selected date"), {
      target: { value: "2026-11-11" },
    });
    await screen.findByText("No cleaning visits");

    await act(async () => {
      if (failure) oldReport.reject(new Error("Stale failure"));
      else
        oldReport.resolve({
          date: visit.date,
          totalVisits: 1,
          completedVisits: 0,
          pendingVisits: 1,
          plannedMinutes: 60,
          plannedHours: 1,
        });
    });
    expect(screen.getByLabelText("Selected date")).toHaveValue("2026-11-11");
    expect(screen.getByText("No cleaning visits")).toBeVisible();
    expect(
      screen.queryByText("Could not load dashboard data. Please try again."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Matti" }),
    ).not.toBeInTheDocument();
  },
);

test("a completion response does not change another day's counts", async () => {
  await openDashboard();
  vi.mocked(api.getVisits).mockResolvedValue([visit]);
  const completion = deferred<api.Visit>();
  vi.mocked(api.updateVisitStatus).mockReturnValueOnce(completion.promise);
  fireEvent.change(screen.getByLabelText("Selected date"), {
    target: { value: visit.date },
  });
  await userEvent.click(
    await screen.findByRole("button", { name: "Mark as completed" }),
  );
  fireEvent.change(screen.getByLabelText("Selected date"), {
    target: { value: "2026-11-11" },
  });
  await screen.findByText("No cleaning visits");
  await act(async () => completion.resolve({ ...visit, status: "completed" }));
  for (const text of ["Successfully finished", "Still to be completed"]) {
    expect(
      within(screen.getByText(text).closest("article")!).getByText("0"),
    ).toBeVisible();
  }
});

test("a failed completion keeps screens usable and allows retrying", async () => {
  await openDashboard();
  vi.mocked(api.getVisits).mockResolvedValue([visit]);
  vi.mocked(api.updateVisitStatus)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce({ ...visit, status: "completed" });
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    fireEvent.change(screen.getByLabelText("Selected date"), {
      target: { value: visit.date },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Mark as completed" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update visit status.",
    );
    expect(screen.getByRole("heading", { name: "Matti" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Add customer" }));
    expect(screen.getByLabelText("Customer name *")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Schedule cleaning visits" }),
    );
    expect(screen.getByLabelText("Employee *")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Mark as completed" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(api.updateVisitStatus).toHaveBeenCalledTimes(2);
  } finally {
    consoleError.mockRestore();
  }
});

test("changing the date reloads the dashboard and shows only visits on that date", async () => {
  await openDashboard();
  vi.mocked(api.getVisits).mockResolvedValue([
    visit,
    {
      ...visit,
      id: 2,
      date: "2026-11-11",
      customer_name: "Other day customer",
    },
  ]);
  fireEvent.change(screen.getByLabelText("Selected date"), {
    target: { value: visit.date },
  });
  await waitFor(() =>
    expect(api.getDailyReport).toHaveBeenLastCalledWith(visit.date),
  );
  expect(await screen.findByRole("heading", { name: "Matti" })).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Other day customer" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("1 visits")).toBeVisible();
});

test("completing a visit updates its status and the dashboard counts", async () => {
  await openDashboard();
  vi.mocked(api.getVisits).mockResolvedValue([visit]);
  vi.mocked(api.getDailyReport).mockResolvedValue({
    date: visit.date,
    totalVisits: 1,
    completedVisits: 0,
    pendingVisits: 1,
    plannedMinutes: 60,
    plannedHours: 1,
  });
  vi.mocked(api.updateVisitStatus).mockResolvedValue({
    ...visit,
    status: "completed",
  });
  fireEvent.change(screen.getByLabelText("Selected date"), {
    target: { value: visit.date },
  });
  await userEvent.click(
    await screen.findByRole("button", { name: "Mark as completed" }),
  );
  await waitFor(() =>
    expect(api.updateVisitStatus).toHaveBeenCalledWith(visit.id, "completed"),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Mark as completed" }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByText("Scheduled", { exact: true }),
  ).not.toBeInTheDocument();
  const visitCard = screen
    .getByRole("heading", { name: "Matti" })
    .closest("article")!;
  expect(within(visitCard).getByText("Completed")).toBeVisible();
  const completedCard = screen
    .getByText("Successfully finished")
    .closest("article")!;
  const pendingCard = screen
    .getByText("Still to be completed")
    .closest("article")!;
  expect(within(completedCard).getByText("1")).toBeVisible();
  expect(within(pendingCard).getByText("0")).toBeVisible();
});

test("shows a useful error when dashboard loading fails", async () => {
  vi.mocked(api.getDailyReport).mockRejectedValue(new Error("Offline"));
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<App />);
    expect(
      await screen.findByText(
        "Could not load dashboard data. Please try again.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Loading dashboard...")).not.toBeInTheDocument();
  } finally {
    consoleError.mockRestore();
  }
});

test("shows summary bullets and expandable original notes on the correct visit", async () => {
  await openDashboard();
  const notes =
    "Please focus on kitchen. Our dog is in the bedroom; keep the door closed.";
  vi.mocked(api.getVisits).mockResolvedValue([
    {
      ...visit,
      notes,
      notes_summary:
        "Prioritize kitchen.\nKeep bedroom door closed; dog inside.",
    },
    { ...visit, id: 2, customer_name: "Other customer" },
  ]);
  fireEvent.change(screen.getByLabelText("Selected date"), {
    target: { value: visit.date },
  });
  const card = (await screen.findByRole("heading", { name: "Matti" })).closest(
    "article",
  )!;
  expect(
    within(card).getByRole("heading", { name: "AI summary" }),
  ).toBeVisible();
  expect(within(card).getAllByRole("listitem")).toHaveLength(2);
  expect(within(card).getByText("Prioritize kitchen.")).toBeVisible();
  expect(within(card).getByText(notes)).not.toBeVisible();
  await userEvent.click(within(card).getByText("Original notes"));
  expect(within(card).getByText(notes)).toBeVisible();
  const other = screen
    .getByRole("heading", { name: "Other customer" })
    .closest("article")!;
  expect(
    within(other).queryByRole("heading", { name: "AI summary" }),
  ).not.toBeInTheDocument();
});

test.each([
  [null, "Summary unavailable. Please read the original notes."],
  ["", "No actionable details found."],
])(
  "shows fallback for summary %j while retaining the original notes",
  async (summary, message) => {
    await openDashboard();
    vi.mocked(api.getVisits).mockResolvedValue([
      { ...visit, notes: "Original instructions", notes_summary: summary },
    ]);
    fireEvent.change(screen.getByLabelText("Selected date"), {
      target: { value: visit.date },
    });
    expect(await screen.findByText(message!)).toBeVisible();
    await userEvent.click(screen.getByText("Original notes"));
    expect(screen.getByText("Original instructions")).toBeVisible();
  },
);

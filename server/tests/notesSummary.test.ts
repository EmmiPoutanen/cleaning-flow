import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { summarizeNotes } from "../src/services/notesSummary.js";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_MODEL", "gpt-5-mini");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function completed(bullets: unknown) {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify({ bullets }) }],
      },
    ],
  };
}

test("sends only notes as input and parses structured bullets", async () => {
  fetchMock.mockResolvedValue(
    Response.json(
      completed(["  Prioritize kitchen. ", "Use unscented products."]),
    ),
  );
  expect(
    await summarizeNotes("Kitchen needs attention. No scented products."),
  ).toBe("Prioritize kitchen.\nUse unscented products.");
  const [url, options] = fetchMock.mock.calls[0]!;
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(options.headers.Authorization).toBe("Bearer test-key");
  expect(JSON.parse(options.body)).toMatchObject({
    store: false,
    input: [
      {
        role: "user",
        content: "Kitchen needs attention. No scented products.",
      },
    ],
    text: { format: { type: "json_schema", strict: true } },
  });
  expect(options.signal).toBeInstanceOf(AbortSignal);
});

test.each([null, "", "   "])("skips empty notes: %j", async (notes) => {
  expect(await summarizeNotes(notes)).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("skips API calls when no key is configured", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  expect(await summarizeNotes("Bring supplies")).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("distinguishes no actionable details from a failed summary", async () => {
  fetchMock.mockResolvedValue(Response.json(completed([])));
  expect(await summarizeNotes("Thanks! ")).toBe("");
});

test.each([
  { status: "incomplete", output: [] },
  {
    status: "completed",
    output: [{ type: "message", content: [{ type: "refusal" }] }],
  },
  {
    status: "completed",
    output: [
      { type: "message", content: [{ type: "output_text", text: "not JSON" }] },
    ],
  },
  completed([123]),
  completed([""]),
  completed("invalid"),
])("rejects incomplete, refused or malformed output", async (payload) => {
  fetchMock.mockResolvedValue(Response.json(payload));
  expect(await summarizeNotes("Original notes")).toBeNull();
});

test("handles API errors without logging sensitive response content", async () => {
  fetchMock.mockResolvedValue(
    new Response("sensitive provider error", { status: 429 }),
  );
  expect(await summarizeNotes("Private customer notes")).toBeNull();
  expect(console.warn).toHaveBeenCalledWith(
    "AI notes summary unavailable; visit saved with original notes.",
  );
});

test("handles network failures and timeouts", async () => {
  fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
  expect(await summarizeNotes("Original notes")).toBeNull();
});

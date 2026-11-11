# Development checks

Use Node.js 22.18 or newer. Install all three sets of dependencies from the
project root (the root package contains the shared ESLint and Prettier tools):

```sh
npm ci
npm --prefix client ci
npm --prefix server ci
```

Run the complete local checks before submitting changes:

```sh
npm run check
```

This runs linting, formatting verification, TypeScript checks (including tests
and Vite/Vitest configuration), and both test suites. GitHub Actions also runs
these checks and builds both apps on pushes and pull requests.

Individual commands from the project root:

| Command                | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `npm run lint`         | Lint both apps and configuration files; warnings fail the check |
| `npm run lint:fix`     | Apply available automatic lint fixes                            |
| `npm run format`       | Format source, configuration, and documentation                 |
| `npm run format:check` | Check formatting without changing files                         |
| `npm run typecheck`    | Check frontend and backend TypeScript without emitting files    |
| `npm test`             | Run both test suites                                            |
| `npm run build`        | Build both apps                                                 |

Each app also has `lint`, `lint:fix`, `format`, `format:check`, and `typecheck`
scripts, for example `npm --prefix server run lint`.

ESLint uses recommended JavaScript/TypeScript rules, browser globals for frontend
code, Node globals for backend/tooling code, and React Hooks/Refresh rules in
the frontend. Application source additionally has type-aware checks for floating
and misused promises. Async UI handlers handle errors internally and explicitly
discard their promises with `void`. Frontend tests under `src` share those
type-aware checks; backend tests and tooling use the basic lint rules.

Prettier owns formatting: two spaces, double quotes, semicolons, trailing commas,
an 80-character print width, and LF line endings. `.editorconfig` supplies matching
editor defaults. Build output, dependencies, coverage, lockfiles, environment
files, and databases are excluded from formatting. Configure your editor to use
the project's local Prettier installation if you enable format on save.

# Running tests

Run each suite from the project root:

```sh
npm --prefix client test
npm --prefix server test
```

Use `npm --prefix client run test:watch` or `npm --prefix server run test:watch`
to rerun tests as you edit files. On a fresh checkout, run `npm ci` in each
directory first.

## Frontend

Vitest and React Testing Library run component tests in jsdom. The tests cover:

- Reloading and filtering dashboard visits when the selected date changes.
- Completing visits and updating dashboard counts.
- Displaying dashboard loading failures.
- Submitting customer details and resetting the form after success.
- Keeping customer input after a failed save so it can be retried.
- Requiring a customer before scheduling a visit.
- Submitting a visit with the selected date and numeric field values.
- Showing AI summary bullets on the correct visit, expanding original notes,
  and displaying fallbacks when summaries are unavailable or contain no actions.

API functions are mocked so these tests focus on user interactions and UI
behavior. They do not need a running backend and are not browser end-to-end tests.

## Backend

Vitest and Supertest exercise the Express routes with real SQLite queries.
Tests cover customer creation and validation, visit scheduling and completion,
invalid input, missing records, and date-specific daily report totals, including
days without visits.

AI tests mock OpenAI's HTTP responses: no API key, paid requests or internet
connection are needed. They cover structured output parsing, empty notes,
missing keys, refusals, incomplete or malformed responses, API errors and
timeouts. Route tests verify summary persistence, preservation when completing
a visit, and successful scheduling when AI is unavailable. A migration test
opens a temporary legacy database and verifies existing notes survive.

The test configuration sets `DATABASE_PATH=:memory:`. Each test starts with empty
tables, and the database is closed after the suite. Tests never use the saved
`Cleaning-flow.db` file. Supertest opens a temporary local port, so execution
environments must allow localhost connections.

`src/app.ts` defines the app without starting the normal server; `src/index.ts`
starts it. The test resolver maps JavaScript import extensions to TypeScript
source. Backend builds write to `server/dist`; run them with
`npm --prefix server run build` followed by `npm --prefix server start`.

## Enabling AI summaries locally

Copy `server/.env.example` to `server/.env`, set `OPENAI_API_KEY`, then restart
the backend with `npm --prefix server run dev`. The default model is
`gpt-5-mini`; `OPENAI_MODEL` can select another model supporting the Responses
API, Structured Outputs and the configured reasoning effort. Never put the
key in the client or a `VITE_` variable. Local `.env` files are ignored by Git.

Schedule a new visit with actionable notes, then open its dashboard card to see
the AI summary and expand **Original notes**. Only the notes are sent to OpenAI,
with response storage disabled (`store: false`). This setting does not disable
all provider retention. The original notes remain saved in SQLite.

The server automatically adds a nullable `notes_summary` column to existing
databases. Existing visits keep their notes and are not automatically sent to
OpenAI. For new visits, summaries are generated once during scheduling, with
a 20-second request timeout. Missing keys or AI failures leave the visit saved
with original notes and a summary-unavailable message. Empty notes skip AI.
The app currently has no visit-note editing endpoint; any future editing flow
must regenerate or clear the saved summary when notes change.

Automated tests verify the integration with mocked responses. A live provider
smoke test requires your API key and a new visit after restarting the server.

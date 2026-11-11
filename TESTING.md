# Testing

Follow [Run locally](README.md#run-locally) in the README to install dependencies.
Run the commands below from the project root.

## Commands

Before submitting changes, run:

```sh
npm run check
npm run build
```

`check` runs ESLint, Prettier formatting checks, TypeScript checks, and both test
suites. `build` builds both apps. GitHub Actions runs both commands on pushes
and pull requests.

For individual suites and watch mode:

| Command                              | Purpose                    |
| ------------------------------------ | -------------------------- |
| `npm --prefix client test`           | Run frontend tests         |
| `npm --prefix server test`           | Run backend tests          |
| `npm --prefix client run test:watch` | Watch frontend tests       |
| `npm --prefix server run test:watch` | Watch backend tests        |
| `npm run lint:fix`                   | Apply automatic lint fixes |
| `npm run format`                     | Apply project formatting   |

## Automated coverage

**Frontend:** Vitest and React Testing Library run in jsdom. Tests cover dashboard
filtering, visit completion and totals, customer and scheduling forms, error
recovery, and AI summary display. API functions are mocked; these tests need no
running backend and do not provide browser end-to-end coverage.

**Backend:** Vitest and Supertest exercise Express routes with real SQLite
queries. Tests cover customer and visit validation, scheduling, completion,
date-specific reports, summary persistence, and preservation of existing notes
during database migration.

**AI integration:** Mocked HTTP responses test structured output parsing, empty
notes, missing credentials, refusals, malformed or incomplete output, and request
failures. Tests also verify that scheduling succeeds when AI is unavailable.
No real API key, paid requests, or internet connection are needed. These tests
do not establish model summary quality or live API compatibility.

## Test isolation

API tests use `DATABASE_PATH=:memory:` and clear customer and visit tables before
each test. The migration test creates a temporary database containing existing
notes and removes it afterward. Tests do not use the saved `Cleaning-flow.db`.
Supertest opens a temporary local port, so the environment must allow localhost
connections.

## Manual AI check

Enable AI summaries using the [README setup instructions](README.md#run-locally),
then restart the backend. This check makes a real API request and may incur a
charge.

1. Schedule a **new visit** with notes such as: “Clean the kitchen first. Do not
   use scented products. Leave the bedroom untouched. Arrive at 10:30.”
2. Open the visit on the dashboard and check that the summary preserves the
   priority, restrictions, and exact time without adding instructions.
3. Expand **Original notes** and confirm the full original text is available.
4. Repeat with Finnish notes to check that the summary stays in the same language.

Existing visits are not summarized automatically. Repeat this check after changing
models or summary instructions.

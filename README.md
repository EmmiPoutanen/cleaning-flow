# Cleaning Flow

A full-stack app for managing customers and cleaning visits. Schedule work,
track completed visits, and view daily workload summaries.

## Features

- Add and view customers.
- Schedule visits with an employee, date, duration, and notes.
- View visits by date, mark them completed, and track daily totals and hours.
- Generate optional AI summaries of visit notes while keeping the original notes.

## Tech stack

React, TypeScript, and Vite frontend; Express and SQLite (`better-sqlite3`)
backend. Tests use Vitest, React Testing Library, and Supertest.

## Run locally

Requires Node.js 22.18 or newer. From the project root:

```sh
npm ci
npm --prefix client ci
npm --prefix server ci
```

Start the backend and frontend in separate terminals:

```sh
npm --prefix server run dev
```

```sh
npm --prefix client run dev
```

Open the URL printed by Vite. The API runs at `http://localhost:3000/api`.
SQLite tables are created automatically. The default database is
`Cleaning-flow.db` in the server process's working directory; set `DATABASE_PATH`
to use another location.

To enable AI summaries, copy `server/.env.example` to `server/.env`, set
`OPENAI_API_KEY`, and restart the backend. `OPENAI_MODEL` defaults to
`gpt-5-mini`. Visit notes are sent to OpenAI when summaries are enabled. Keep
the API key on the server and out of Git. The app works without an API key.

## Usage

Add a customer, schedule a visit, select its date on the dashboard, and mark it
completed when finished.

## Development

```sh
npm run check
npm run build
```

These commands run linting, formatting checks, type checks, tests, and builds.
GitHub Actions runs both on pushes and pull requests. See [TESTING.md](TESTING.md)
for details.

## Project structure

- `client/`: React interface and API client.
- `server/`: Express API, SQLite storage, and AI summaries.

The API provides customer and visit management, visit status updates, daily
reports, and a health check at `/api/health`.

## Screenshots / demo

## Current limitations

Authentication and visit-note editing are not implemented. The frontend API URL
is currently hardcoded for localhost.

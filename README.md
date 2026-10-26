# RowReady — Data Quality Workbench

RowReady helps students, developers, analysts, and small businesses understand a CSV before using it. Upload real data, inspect missing values and exact duplicates, make explicit cleaning changes, revalidate the result, and download a spreadsheet-protected CSV. MongoDB keeps the findings available after the browser session ends.

**Deployment status:** implemented and verified locally with a real MongoDB database. No public deployment URL has been verified. Follow [deployment instructions](docs/DEPLOYMENT.md) to publish one Node service and connect MongoDB Atlas.

## What you can do

- Upload CSV files in UTF-8, UTF-16 (LE/BE), and Windows-1252 / ANSI encodings, including quoted fields, escaped quotes, multiline values, and standard delimiters (comma, semicolon, tab).
- Inspect actual row/column counts, missing percentages, duplicate counts, inferred column types, distinct counts, and numeric min/max/mean.
- Trim surrounding whitespace and remove exact duplicate rows. See counts and original/working previews; reset to the original at any point in the current session.
- Revalidate and save the current findings, with remaining warnings clearly visible.
- Download actual working rows with correct CSV escaping and mandatory spreadsheet formula protection. The export preview includes those exact protective changes.
- Reopen recent MongoDB reports and compare original findings with the latest saved validation.

There are no AI services, paid APIs, accounts, or fabricated results. The production app has no in-memory database fallback: failed persistence returns an actionable error.

## Quick start

Prerequisites: Node **22.12+** (tested with **24.13.1**), npm, and MongoDB 7+ locally or a MongoDB Atlas connection. The repository includes a lockfile; use `npm ci` for repeatable installs.

```sh
npm ci
```

Copy `.env.example` to `.env` **only if you do not already have an environment file**. In PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env`. Set `MONGODB_URI` in `.env` to your connection string. Never put it in the client or in a `VITE_` variable. For local MongoDB the default is `mongodb://127.0.0.1:27017/rowready`.

If you use Docker, this optional command starts a persistent local database:

```sh
docker run --name rowready-mongo -p 127.0.0.1:27017:27017 -v rowready-mongo-data:/data/db -d mongo:7
```

Start development:

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to Express on port 3000 (or `PORT`). React supports hot replacement; restart this command after changing server code or `.env`. Stop with Ctrl+C. Do not start a second server on the same port.

For the single-service production build, stop the development server first:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3000**. Set `NODE_ENV=production` on your HTTPS host. Express serves the built UI and API together, including refreshes of `/reports/:id`. `/api/health` returns HTTP 200 when MongoDB is connected and HTTP 503 when unavailable. The server retries an initially unavailable configured database every 15 seconds.

### This workspace’s local verification setup

During implementation, a cached MongoDB 7.0.24 executable was available and an isolated database was started on **127.0.0.1:27018**, storing files in ignored `.local/mongo-data`. The ignored local `.env` targets that instance. It is local test infrastructure, not part of a deployment. After restarting this machine, start a MongoDB instance again or change `.env` to your own local/Atlas URI. Normal fresh installations should follow the setup above.

## Architecture

A single Node/Express service owns all processing and persistence. React sends the selected file as bounded CSV bytes. The server validates and parses it, calculates the profile, saves a report, and returns the dataset plus findings. Cleaning and validation requests send the bounded working dataset back to the API. CSV export uses the same data and a shared spreadsheet-safety policy.

The browser holds the immutable original and current working data **in memory only**. No raw files, complete datasets, row examples, or session edit tokens are written to MongoDB, localStorage, IndexedDB, or application logs. The API necessarily holds request data transiently while processing. Navigating within the app preserves the session; closing or reloading it loses the dataset. A before-unload prompt reminds users to download first.

MongoDB stores the sanitized filename, source size, timestamps, original aggregate profile, and latest validated profile. Each profile includes named column statistics and supported warnings. A hash of a random upload-session capability protects report validation updates; only that browser session receives the capability. Public report responses exclude the hash and internal column fingerprint. This is an update capability, **not an account or a privacy boundary**.

### Main technologies

- React 19.2.7, Vite 8.3.4, and responsive plain CSS.
- Express 5.2.1, Mongoose 8.24.7, Zod 4.6.5.
- `d3-dsv` 3.0.1 for CSV parsing/serialization. A small strict quoting guard rejects malformed input that its permissive parser would otherwise tolerate. `csvParseRows` avoids dynamic code generation.
- Helmet and express-rate-limit for response headers and public API limits.
- Node’s test runner, Supertest, and React Testing Library with JSDOM. An optional Playwright workflow script is included.

Exact direct and transitive dependencies are pinned by `package-lock.json`. Compatible packages were installed from the device’s offline cache because registry access was unavailable. The ignored `.npm-cache` is not needed on a networked installation.

## Project structure

```text
client/
  public/sample.csv              Prepared demonstration dataset
  src/
    components/                  Upload, previews, metrics, warnings, feedback
    pages/                       Workbench and saved report screens
    services/api.js              Bounded fetch requests and error handling
    utils/                       Session state, formatting, downloads
    App.jsx                      Navigation, connection status, error boundary
    styles*.css                  Responsive styling
  vite.config.js
server/src/
  controllers/datasets.js         Analyze, clean, validate, export handlers
  services/csv.js                 UTF-8, strict CSV structure, serialization
  services/dataset.js             Zod contracts, limits, filename handling
  services/profile.js             Missing/duplicate/type/statistics calculations
  services/clean.js               Pure, deterministic transformations
  services/reports.js             Safe MongoDB queries and update capabilities
  models/Report.js                Explicit metadata-only document schema
  routes/api.js                  Routing, body parsers, rate limiting
  middleware/errors.js           Consistent non-sensitive errors
  app.js                         Security headers and production SPA serving
  config.js / index.js            Environment, database lifecycle, server
shared/limits.js                  Browser/server limits
shared/export-policy.js           Browser/server spreadsheet-safety rules
tests/                           Data, HTTP, SPA, and real MongoDB tests
scripts/                         Development, verification, UI/browser workflows
docs/                            Deployment, demo, verification, submission
render.yaml                      Single Node service blueprint
```

## Exact data rules

**CSV structure:** comma, semicolon, or tab-delimited; UTF-8, UTF-16 (LE/BE, with or without BOM), or Windows-1252/ANSI encodings; one header record and at least one data record. LF, CRLF, and CR line endings are accepted. Every record must have the header’s cell count. Blank physical records are records, so they can cause an inconsistent-row error; they are not silently skipped. A final record separator adds no row. Quotes must enclose an entire field; embedded quotes use `""`. Whitespace after a closing quote is rejected. Tabs and line breaks inside values are supported; binary nulls and ASCII control characters are rejected.

**Headers:** nonblank and unique after ignoring surrounding whitespace, case-sensitive; at most 128 characters each. Header text is preserved, with a warning for surrounding whitespace. `Name` and `name` are distinct. CSV formula protection also applies to headers at export.

**Missing values:** exactly those strings whose JavaScript `trim()` result is empty (including supported Unicode whitespace). Literal `NA`, `null`, `0`, and `false` are ordinary values. Percentages use data cells only, excluding headers, rounded to two decimals.

**Duplicates:** compare the full ordered array of parsed string values, exactly and case-sensitively, using collision-free JSON array serialization. Different CSV quoting that decodes to identical values is equivalent. Surrounding spaces matter until trimmed. A group of N identical rows contributes N−1 duplicates. Removal keeps the first occurrence and preserves survivor order.

**Trimming:** `String.prototype.trim()` on data cells only. Internal spaces and newlines stay unchanged. Headers are untouched. All stored working values remain strings; no type conversion or missing-value imputation occurs.

**Operation order:** when both options are selected, trim first, then deduplicate, regardless of request order. Trimming can create new exact duplicates. Trim counts include affected cells in rows subsequently removed. Repeating the same operations is idempotent. Reset restores the original browser snapshot and requires revalidation before export.

**Inference:** ignore missing values, then recognize case-insensitive `true`/`false`, finite decimal/scientific numbers without leading zero identifiers, and valid calendar dates exactly `YYYY-MM-DD`. Integers outside JavaScript’s safe integer range stay strings. Everything else is a string. A column containing more than one type is `mixed`; all-missing columns are `empty`. Inference trims for inspection without mutating the data. This is heuristic: a leading-zero identifier is a string, but an unpadded ID may infer as numeric. Numeric statistics are provided only for entirely numeric nonmissing columns and use JavaScript floating-point arithmetic. Distinct counts exclude missing cells and compare exact original strings.

**Validation:** recalculates these same checks over current data, saving only the latest result. Missing values and mixed types are warnings, not automatically fixed errors. Cleaning alone updates on-screen metrics but does not overwrite saved validation. The API checks the upload capability, matching headers, and original row ceiling; it does not certify data provenance or domain-specific correctness.

### Spreadsheet-safe CSV export

All public exports are UTF-8 with CRLF record separators. Embedded newlines, commas, and quotes are escaped by the CSV library. Before serialization, values beginning with tab/CR/LF, or with optional whitespace followed by `=`, `+`, `-`, `@` (including full-width equivalents), receive a leading apostrophe. This includes negative numbers and risky column names. The safe-export preview uses the same shared function; working data and original data are not modified.

This conservative policy changes the literal exported representation of those values, and some programs will display the apostrophe or treat numbers as text. There is no unprotected-download option in the public API. Spreadsheet import behavior varies; protection on this export is not a guarantee after re-saving or modifying a file in another tool.

## Limits and errors

- Uploaded CSV: **2 MiB** maximum.
- Dataset: **10,000 rows**, **100 columns**, **250,000 data cells**, **3 MiB** when represented as UTF-8 JSON. All limits apply together; a file below 2 MiB can still exceed a parsed limit.
- Each cell: **16,384 UTF-16 code units**. Each header: 128. Sanitized stored filename: 120.
- JSON requests: **4 MiB**, with compressed bodies rejected. Limits are enforced on the server as well as in the upload UI.
- Previews: first **50 rows**; cells scroll for longer values. Processing and export include all accepted rows.
- API calls except health: **60 requests per IP per 15 minutes**. HTTP 429 includes rate-limit headers. The limiter is in-process and suited to one service instance.
- Report lists: 12 by default, at most 50 per request, offsets up to 1,000. Details remain accessible by report ID.

Errors use `{ "error": { "code": "...", "message": "..." } }`. Responses include 400 for malformed input, 403 for an invalid upload capability, 404 for missing reports/routes, 409 for incompatible report data, 413 for limits, 415 for unsupported media/encoding, 429 for rate limits, and 503 for unavailable storage. Production responses do not expose stack traces or database details. A successful analyze/validate response means persistence succeeded.

## Environment variables

- `MONGODB_URI`: server-only local or Atlas MongoDB URI. Missing/failed configuration produces a degraded health response and unavailable report operations. Include the database name.
- `PORT`: server port, defaults to `3000`. Vite’s development proxy reads the same value.
- `NODE_ENV`: `development`, `test`, or `production`; defaults to `development`. Production enables HTTPS-oriented headers.
- `TRUST_PROXY`: `0` locally; `1` only behind one trusted reverse proxy, such as the intended Render service. Do not use `1` for a server directly exposed to arbitrary forwarded headers.
- `TEST_MONGODB_URI`: optional **dedicated test database**, used by real persistence and UI integration checks. Tests delete only reports they create.
- `E2E_BASE_URL`: optional browser-test target, defaults to `http://127.0.0.1:3000`.
- `PLAYWRIGHT_MODULE` / `CDP_URL`: optional browser-test overrides for an existing Playwright installation or a locally launched debugging browser. Not needed by the application.

No frontend secret or environment variable is required for the same-origin deployment.

## API reference

- `GET /api/health` → status, database readiness, and limits. HTTP 503 if storage is unavailable.
- `POST /api/datasets/analyze` → HTTP 201 with `{ dataset, profile, report, editToken }`. Body is **raw CSV**, `Content-Type: text/csv` (or `application/octet-stream`), and `X-Filename` is a URL-encoded `.csv` filename. `dataset` is `{ headers: string[], rows: string[][] }`. No multipart parser is needed.
- `POST /api/datasets/clean` → `{ dataset, profile, changes, operations }`. JSON body: `{ "dataset": ..., "operations": ["trim", "deduplicate"] }`. At least one supported, unrepeated operation is required. This endpoint is stateless.
- `POST /api/datasets/validate` → `{ profile, report }`. JSON body: `{ "dataset": ..., "reportId": "24-hex-id", "editToken": "64-hex-upload-capability" }`. Recalculates and saves the current validation. Only the upload session can update that report.
- `POST /api/datasets/export` → CSV attachment, with an `X-Protected-Cells` count. JSON body: `{ "dataset": ... }`. The public API always applies spreadsheet protection. The UI requires saved validation before enabling export; direct API export remains a validated, stateless operation.
- `GET /api/reports?limit=12&offset=0` → `{ reports, hasMore }`, ordered by upload time. List results omit full column statistics; open a report for those.
- `GET /api/reports/:id` → `{ report }`, containing original findings and optional `lastValidation: { profile, validatedAt }`.

Example upload (use `curl.exe` in Windows PowerShell):

```sh
curl -i http://127.0.0.1:3000/api/health
curl -X POST http://127.0.0.1:3000/api/datasets/analyze -H "Content-Type: text/csv" -H "X-Filename: sample.csv" --data-binary @client/public/sample.csv
```

## Testing

```sh
npm run check
npm run test:ui
```

`check` builds production assets, runs pure-function/API/SPA tests, and runs the real MongoDB test if `TEST_MONGODB_URI` is set. The production routing test is skipped when running `npm test` before building. Real MongoDB checks report a skip if their URI is absent. `test:ui` compiles the actual React components, drives upload/clean/reset/validate/export/report workflows in JSDOM, and talks to a real ephemeral Express listener and MongoDB. It **does not** verify visual layout.

Individual commands:

```sh
npm test
npm run test:db
npm run build
npm run format:check
```

For real browser checks, install Playwright as a local test tool, start the built application with MongoDB connected, then run:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:e2e
```

The script saves screenshots and a downloaded CSV in ignored `test-results/`. It creates sample reports on the selected instance; use a local/test database. It checks desktop/mobile upload, cleaning, reset, retained warnings, download bytes, deep refresh, invalid reports, and client errors. If an existing browser is used through CDP, give it a dedicated profile. Do not attach this test to a personal browsing session.

See [actual verification results and remaining checks](docs/VERIFICATION.md). No unexecuted browser or deployment check is counted as passing.

## Security and limitations

This MVP is a **shared, unauthenticated workbench**. Anyone reaching the instance can read report metadata. Do not upload confidential, personal, or regulated data. Filenames, column names, and numeric aggregates may themselves be sensitive. Multi-user privacy would require authentication and ownership checks before real private use.

The server uses explicit Mongoose schemas, server-computed metrics, strict request shapes, bounded payloads, validated ObjectIds, fixed operations, limited queries, same-origin API access, security headers, and rate limiting. No client-supplied database filters or executable transformations are accepted. HTTPS termination is the host’s responsibility. No raw request logging is configured.

Only comma-separated UTF-8 CSV and the documented checks are supported. There is no fuzzy matching, Excel import, data imputation, domain validation, background processing, or recovery of working data after a reload. Public metadata currently has no application-level delete/retention UI. Numeric inference and arithmetic have the limitations described above. Large requests are intentionally rejected rather than queued.

Git’s metadata directory was read-only in the implementation environment, so staging/commits could not be created there. Source files and lockfile are present; see the submission guide for recording and pushing them from a writable checkout. `.env`, build artifacts, local database files, test output, and caches are ignored.

The release audit also added exclusions for common credential files, private keys, environment backups, and MongoDB dumps outside `.local`. A Git-based regression test checks those exclusions while allowing `.env.example` and project source. Review staged contents before every commit: ignore rules do not block forced additions or secret literals in source.

## Demo and submission

- [3–5 minute demo script and expected sample results](docs/DEMO.md)
- [Atlas + Render deployment walkthrough](docs/DEPLOYMENT.md)
- [Verified checks and outstanding validation](docs/VERIFICATION.md)
- [Submission checklist](docs/SUBMISSION.md)
- [Authoritative end-term guidelines](END_TERM_PROJECT_GUIDELINES.md)

Submission deadline: **27 October 2026, 11:59 PM IST**. Official form: https://forms.gle/sBy4sfqyiRG2Zpom9

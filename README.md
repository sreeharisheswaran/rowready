# RowReady — Data Quality Workbench

**Understand a CSV before you use it.** RowReady lets you upload a CSV, see exactly what is wrong with it (missing values, duplicate rows, stray whitespace, mixed types), apply explicit cleaning steps, revalidate, and download a spreadsheet-safe file. Findings are saved to MongoDB so a report can be reopened later.

|                 |                                                                |
| --------------- | -------------------------------------------------------------- |
| **Live app**    | https://rowready.onrender.com                                  |
| **Demo video**  | `<PASTE DEMO VIDEO LINK HERE>`                                 |
| **Source code** | https://github.com/sreeharisheswaran/rowready                  |
| **Hosting**     | One Node/Express service on Render, connected to MongoDB Atlas |

> **Note:** the Render free tier sleeps when idle. The first request after a quiet period can take up to a minute to respond. Please wait for it to wake up, then reload.

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Target users](#target-users)
3. [Solution](#solution)
4. [Key features](#key-features)
5. [Tech stack](#tech-stack)
6. [Architecture](#architecture)
7. [Project structure](#project-structure)
8. [Local setup](#local-setup)
9. [Environment variables](#environment-variables)
10. [Deployment](#deployment)
11. [Exact data rules](#exact-data-rules)
12. [Limits and error handling](#limits-and-error-handling)
13. [API reference](#api-reference)
14. [Testing](#testing)
15. [Security](#security)
16. [Known limitations](#known-limitations)
17. [Originality and AI usage](#originality-and-ai-usage)
18. [Demo and submission](#demo-and-submission)

---

## Problem statement

CSV files are the default way data moves between people and systems, and they are rarely clean. Missing values, exact duplicate rows, leading and trailing whitespace, inconsistent column types, and cells that begin with `=`, `+`, `-` or `@` (which spreadsheets can interpret as formulas) are easy to miss. People usually discover these problems only after an analysis gives wrong results or a file misbehaves when imported or opened in Excel.

## Target users

- **Students and learners** working with datasets they did not create.
- **Developers** who receive CSV exports and need to check them before importing.
- **Analysts and small teams** who want a quick, trustworthy data-quality check without writing code or setting up a data platform.

## Solution

RowReady is a focused data-quality workbench. A user uploads a CSV and gets an accurate profile of it. They then choose explicit, reversible cleaning operations, revalidate the result, and export a file that is safe to open in a spreadsheet. Nothing is changed silently: every change is counted, previewed, and can be reset.

There are no AI services, paid APIs, accounts, or fabricated results. Every number shown is computed from the uploaded data.

## Key features

The application is built around five workflows.

1. **Upload and profile.** Upload CSV files in UTF-8, UTF-16 (LE/BE) or Windows-1252/ANSI encodings, with comma, semicolon or tab delimiters, quoted fields, escaped quotes and multiline values. Get real row and column counts, missing-value percentages, exact-duplicate counts, inferred column types, distinct counts, and numeric min/max/mean.
2. **Clean.** Trim surrounding whitespace and remove exact duplicate rows. See counts of what changed, compare original and working previews, and reset to the original at any point in the session.
3. **Revalidate and save.** Recalculate findings on the current working data and save them. Remaining warnings (such as missing values) stay visible rather than being hidden.
4. **Spreadsheet-safe export.** Download the working rows as CSV with correct escaping and mandatory formula-injection protection. The export preview shows the exact protective changes before you download.
5. **Saved reports.** Reopen recent reports stored in MongoDB and compare the original findings with the latest saved validation.

## Tech stack

| Layer        | Technology                                                                             |
| ------------ | -------------------------------------------------------------------------------------- |
| Frontend     | React 19, Vite 8, responsive plain CSS                                                 |
| Backend      | Node.js 22.12+ (tested on 24.13.1), Express 5                                          |
| Database     | MongoDB 7+ (Atlas in production) with Mongoose 8                                       |
| Validation   | Zod 4 for request and data contracts                                                   |
| CSV handling | `d3-dsv` for parsing and serialization, plus a strict quoting guard                    |
| Security     | Helmet (headers), express-rate-limit                                                   |
| Testing      | Node test runner, Supertest, React Testing Library (JSDOM), optional Playwright script |
| Hosting      | Render (single service via `render.yaml`)                                              |

Exact versions of all direct and transitive dependencies are pinned in `package-lock.json`.

**Why these choices:** a single Node service keeps deployment simple and lets the browser and server share limits and export rules. MongoDB fits the saved report documents, which are flexible, per-column statistics. React gives a responsive workbench with in-memory session state. Nothing was added without a reason.

## Architecture

```text
Browser (React)                         Server (Express)                   MongoDB
────────────────                        ────────────────                   ───────
Select CSV file
  │  raw bytes + X-Filename
  ├──────────────────────────────────►  validate → decode → strict parse
  │                                     compute profile
  │                                     save report (metadata only) ─────►  Report document
  │◄──────────────────────────────────  dataset + profile + report + editToken
Hold original + working data
in memory only
  │  dataset + operations
  ├──────────────────────────────────►  pure, deterministic cleaning (stateless)
  │◄──────────────────────────────────  cleaned dataset + profile + change counts
  │  dataset + reportId + editToken
  ├──────────────────────────────────►  verify capability → recalculate → save ─►  lastValidation
  │◄──────────────────────────────────  profile + report
  │  dataset
  ├──────────────────────────────────►  apply shared export policy → serialize
  │◄──────────────────────────────────  protected CSV download
```

A single Node/Express service owns all processing and persistence. React sends the selected file as bounded CSV bytes. The server validates and parses it, calculates the profile, saves a report, and returns the dataset plus findings. Cleaning and validation requests send the bounded working dataset back to the API. CSV export uses the same data and a shared spreadsheet-safety policy.

**What lives where**

- **Browser memory:** the immutable original dataset and the current working dataset. No raw files, full datasets, row examples or session edit tokens are written to MongoDB, localStorage, IndexedDB or application logs. Navigating inside the app preserves the session. Closing or reloading the page loses the dataset, and a before-unload prompt reminds users to download first.
- **MongoDB:** the sanitized filename, source size, timestamps, the original aggregate profile, and the latest validated profile. Each profile includes named column statistics and supported warnings.
- **Update capability:** a random token is created per upload session. Only its hash is stored. Only the browser session that uploaded the file can update that report's validation. Public report responses exclude the hash and the internal column fingerprint. This is an update capability, **not an account or a privacy boundary**.

**Key design decisions**

- Data stays in the browser. The database stores aggregates, not raw rows, which limits what a database leak could expose.
- Cleaning functions are pure and deterministic, so they are easy to test and are idempotent.
- Limits (`shared/limits.js`) and export rules (`shared/export-policy.js`) are shared by client and server, so the two cannot drift apart.
- There is no in-memory database fallback in production. If persistence fails, the API returns an actionable error instead of pretending to succeed.
- Missing values and mixed types are reported as warnings. They are never imputed or converted automatically.

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
  services/csv.js                 Decoding, strict CSV structure, serialization
  services/dataset.js             Zod contracts, limits, filename handling
  services/profile.js             Missing/duplicate/type/statistics calculations
  services/clean.js               Pure, deterministic transformations
  services/reports.js             Safe MongoDB queries and update capabilities
  models/Report.js                Explicit metadata-only document schema
  routes/api.js                   Routing, body parsers, rate limiting
  middleware/errors.js            Consistent non-sensitive errors
  app.js                          Security headers and production SPA serving
  config.js / index.js            Environment, database lifecycle, server
shared/
  limits.js                       Browser/server limits
  export-policy.js                Browser/server spreadsheet-safety rules
tests/                            Data, HTTP, SPA and real MongoDB tests
scripts/                          Development, verification, UI/browser workflows
docs/                             Deployment, demo, verification, submission notes
render.yaml                       Single Node service blueprint
```

## Local setup

**Prerequisites:** Node **22.12+**, npm, and either MongoDB 7+ running locally or a MongoDB Atlas connection string.

**1. Clone and install**

```bash
git clone https://github.com/sreeharisheswaran/rowready.git
cd rowready
npm ci
```

**2. Create your environment file**

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Open `.env` and set `MONGODB_URI`. For a local MongoDB the default is `mongodb://127.0.0.1:27017/rowready`. Never put this value in the client or in a `VITE_` variable.

**3. (Optional) Start a local MongoDB with Docker**

```bash
docker run --name rowready-mongo -p 127.0.0.1:27017:27017 -v rowready-mongo-data:/data/db -d mongo:7
```

**4. Run in development**

```bash
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to Express on port 3000 (or `PORT`). React supports hot reload. Restart the command after changing server code or `.env`. Stop with Ctrl+C, and do not start a second server on the same port.

**5. Run the production build locally**

Stop the development server first, then:

```bash
npm run build
npm start
```

Open **http://127.0.0.1:3000**. Express serves the built UI and the API together, including refreshes of `/reports/:id`. Try the app with `client/public/sample.csv`.

`GET /api/health` returns HTTP 200 when MongoDB is connected and HTTP 503 when it is not. The server retries an unavailable database every 15 seconds.

## Environment variables

| Variable                        | Required | Description                                                                                                                                                      |
| ------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                   | Yes      | Server-only MongoDB or Atlas connection string. Include the database name. If missing or failing, health reports degraded and report operations are unavailable. |
| `PORT`                          | No       | Server port. Defaults to `3000`. The Vite dev proxy reads the same value.                                                                                        |
| `NODE_ENV`                      | No       | `development`, `test` or `production`. Defaults to `development`. Production enables HTTPS-oriented headers and static serving.                                  |
| `TRUST_PROXY`                   | No       | `0` locally. Use `1` only behind one trusted reverse proxy, such as Render. Do not use `1` if the server is directly exposed.                                    |
| `TEST_MONGODB_URI`              | No       | A dedicated test database for the real-persistence and UI integration tests. Tests delete only reports they create.                                              |
| `E2E_BASE_URL`                  | No       | Browser-test target. Defaults to `http://127.0.0.1:3000`.                                                                                                        |
| `PLAYWRIGHT_MODULE` / `CDP_URL` | No       | Browser-test overrides. Not needed by the application.                                                                                                           |

No frontend secret or environment variable is required for the same-origin deployment. `.env` is git-ignored, and `.env.example` contains no real credentials.

## Deployment

The app is deployed as **one Node service** on Render, backed by **MongoDB Atlas**. Express serves both the API and the built React app, so there is a single origin and no CORS configuration.

**Live URL:** https://rowready.onrender.com

**To deploy your own copy:**

1. Create a free MongoDB Atlas cluster, add a database user, and allow network access from your host. Copy the connection string and include the database name (for example `/rowready`).
2. In Render, create a new Web Service from this repository. The included `render.yaml` defines the build and start commands.
3. Set the environment variables:
   - `MONGODB_URI` = your Atlas connection string
   - `NODE_ENV` = `production`
   - `TRUST_PROXY` = `1`
4. Deploy, then open `/api/health`. It should return HTTP 200 with the database marked ready.

A fuller walkthrough is in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Exact data rules

These rules are deterministic and covered by tests.

**CSV structure.** Comma, semicolon or tab delimited. Encodings: UTF-8, UTF-16 (LE/BE, with or without BOM) and Windows-1252/ANSI. One header record and at least one data record. LF, CRLF and CR line endings are accepted. Every record must have the same number of cells as the header. Blank physical records count as records, so they can cause an inconsistent-row error rather than being silently skipped. A final record separator adds no row. Quotes must enclose an entire field, and embedded quotes use `""`. Whitespace after a closing quote is rejected. Tabs and line breaks inside values are supported. Binary nulls and ASCII control characters are rejected.

**Headers.** Non-blank and unique after ignoring surrounding whitespace, case-sensitive, at most 128 characters. Header text is preserved, with a warning for surrounding whitespace. `Name` and `name` are different columns. Formula protection also applies to headers at export.

**Missing values.** Exactly the strings whose JavaScript `trim()` result is empty (including supported Unicode whitespace). The literal values `NA`, `null`, `0` and `false` are ordinary values. Percentages use data cells only, exclude headers, and are rounded to two decimals.

**Duplicates.** Rows are compared as the full ordered array of parsed string values, exactly and case-sensitively. Different CSV quoting that decodes to identical values is treated as equal. Surrounding spaces matter until trimmed. A group of N identical rows contributes N−1 duplicates. Removal keeps the first occurrence and preserves the order of survivors.

**Trimming.** `String.prototype.trim()` on data cells only. Internal spaces and newlines are unchanged and headers are untouched. All working values remain strings, with no type conversion and no imputation.

**Operation order.** When both operations are selected, trimming runs first and then deduplication, regardless of request order, because trimming can create new exact duplicates. Trim counts include affected cells in rows that are later removed. Repeating the same operations is idempotent. Reset restores the original browser snapshot and requires revalidation before export.

**Type inference.** Missing values are ignored first. The recognized types are:

- booleans: case-insensitive `true` / `false`
- numbers: finite decimal or scientific numbers without leading-zero identifiers
- dates: valid calendar dates in exactly `YYYY-MM-DD`
- strings: everything else, including integers outside JavaScript's safe integer range

A column with more than one type is `mixed`, and an all-missing column is `empty`. Inference is heuristic: a leading-zero identifier stays a string, but an unpadded ID may infer as numeric. Numeric statistics are given only for entirely numeric non-missing columns and use JavaScript floating-point arithmetic. Distinct counts exclude missing cells and compare exact original strings.

**Validation.** Recalculates the same checks over the current data and saves only the latest result. Missing values and mixed types are warnings and are not fixed automatically. Cleaning alone updates the on-screen metrics but does not overwrite the saved validation. The API checks the upload capability, matching headers and the original row ceiling. It does not certify data provenance or domain-specific correctness.

### Spreadsheet-safe CSV export

All exports are UTF-8 with CRLF record separators. Embedded newlines, commas and quotes are escaped by the CSV library. Before serialization, any value that begins with a tab, CR or LF, or with optional whitespace followed by `=`, `+`, `-` or `@` (including full-width equivalents), receives a leading apostrophe. This includes negative numbers and risky column names. The export preview uses the same shared function, and the working and original data are never modified.

This policy changes the literal exported representation of those values, and some programs will show the apostrophe or treat numbers as text. There is no unprotected-download option in the public API. Protection applies to this export only and is not guaranteed once a file is re-saved or modified in another tool.

## Limits and error handling

**Limits**

- Uploaded CSV: **10 MiB** maximum.
- Dataset: **50,000 rows**, **200 columns**, **1,000,000 data cells**, and **15 MiB** when represented as UTF-8 JSON. All limits apply together, so a file under 10 MiB can still exceed a parsed limit.
- Each cell: **16,384** UTF-16 code units. Each header: 128. Stored filename: 120 (sanitized).
- JSON requests: **16 MiB**, with compressed bodies rejected. Limits are enforced on the server as well as in the upload UI.
- Previews show the first **50 rows**. Processing and export include all accepted rows.
- API calls except health: **60 requests per IP per 15 minutes**. HTTP 429 includes rate-limit headers. The limiter is in-process and suited to a single instance.
- Report lists: 12 by default, at most 50 per request, offsets up to 1,000.

**Errors.** All API errors use one shape:

```json
{ "error": { "code": "...", "message": "..." } }
```

| Status | Meaning                            |
| ------ | ---------------------------------- |
| 400    | Malformed input                    |
| 403    | Invalid upload capability          |
| 404    | Missing report or route            |
| 409    | Incompatible report data           |
| 413    | A size limit was exceeded          |
| 415    | Unsupported media type or encoding |
| 429    | Rate limit reached                 |
| 503    | Storage unavailable                |

Production responses never expose stack traces or database details. A successful analyze or validate response means persistence succeeded. The UI shows loading, empty, success and error states, and the app has an error boundary and a connection-status indicator.

## API reference

- `GET /api/health` returns status, database readiness and limits. HTTP 503 if storage is unavailable.
- `POST /api/datasets/analyze` returns HTTP 201 with `{ dataset, profile, report, editToken }`. The body is **raw CSV** with `Content-Type: text/csv` (or `application/octet-stream`), and `X-Filename` is a URL-encoded `.csv` filename. `dataset` is `{ headers: string[], rows: string[][] }`.
- `POST /api/datasets/clean` returns `{ dataset, profile, changes, operations }`. JSON body: `{ "dataset": ..., "operations": ["trim", "deduplicate"] }`. At least one supported, non-repeated operation is required. This endpoint is stateless.
- `POST /api/datasets/validate` returns `{ profile, report }`. JSON body: `{ "dataset": ..., "reportId": "<24-hex-id>", "editToken": "<64-hex-capability>" }`. Recalculates and saves the current validation. Only the upload session can update that report.
- `POST /api/datasets/export` returns a CSV attachment with an `X-Protected-Cells` header giving the count of protected cells. JSON body: `{ "dataset": ... }`. Spreadsheet protection is always applied.
- `GET /api/reports?limit=12&offset=0` returns `{ reports, hasMore }`, ordered by upload time. The list omits full column statistics.
- `GET /api/reports/:id` returns `{ report }` with the original findings and an optional `lastValidation: { profile, validatedAt }`.

**Example**

```bash
curl -i http://127.0.0.1:3000/api/health
curl -X POST http://127.0.0.1:3000/api/datasets/analyze \
  -H "Content-Type: text/csv" -H "X-Filename: sample.csv" \
  --data-binary @client/public/sample.csv
```

On Windows PowerShell, use `curl.exe` instead of `curl`.

## Testing

```bash
npm run check      # build + unit, API and SPA tests (+ real MongoDB test if TEST_MONGODB_URI is set)
npm run test:ui    # real React components driven in JSDOM against a real Express listener and MongoDB
```

Individual commands:

```bash
npm test
npm run test:db
npm run build
npm run format:check
```

What the tests cover: CSV parsing and encodings, profiling, cleaning, export protection, HTTP routes and error codes, production SPA routing, real MongoDB persistence, and the UI workflows of upload, clean, reset, validate, export and reports. The JSDOM UI test does not verify visual layout.

For real browser checks, install Playwright as a local test tool, start the built app with MongoDB connected, then run:

```bash
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:e2e
```

The end-to-end script saves screenshots and a downloaded CSV into the git-ignored `test-results/` folder. It creates sample reports on the selected instance, so run it against a local or test database, not production. See [`docs/VERIFICATION.md`](docs/VERIFICATION.md) for recorded verification results.

## Security

- **Secrets:** all configuration comes from environment variables. `.env` and credential files are git-ignored, and `.env.example` holds placeholders only. A test checks the ignore rules.
- **Input validation:** strict Zod request shapes, bounded payloads, validated ObjectIds, a fixed set of operations, and limited queries. No client-supplied database filters or executable transformations are accepted.
- **Formula injection:** all exports are protected, including headers and negative numbers.
- **Abuse protection:** per-IP rate limiting and request size limits.
- **Headers and transport:** Helmet security headers, same-origin API access, and HTTPS termination by the host.
- **Data minimization:** raw rows are never stored or logged, and no raw request logging is configured.
- **Report updates:** require a random capability token, and only its hash is stored.

## Known limitations

- RowReady is a **shared, unauthenticated workbench**. Anyone who can reach the instance can read report metadata, such as filenames, column names and aggregates. **Do not upload confidential, personal or regulated data.** Multi-user privacy would need authentication and ownership checks.
- Working data lives only in the browser tab. Reloading or closing it loses the dataset. Saved reports keep findings, not rows.
- Two cleaning operations are supported: trimming whitespace and removing exact duplicates. There is no fuzzy matching, imputation, Excel import or domain-specific validation.
- Large requests are rejected rather than queued, and there is no background processing.
- Saved report metadata has no application-level delete or retention UI.
- The rate limiter is in-process, so it suits a single service instance.
- Numeric inference and arithmetic have the limits described in [Exact data rules](#exact-data-rules).

## Originality and AI usage

RowReady is original work and is not based on an existing open-source project. It uses open-source libraries (listed in the tech stack) and standard documentation.

<!-- Edit this paragraph to describe honestly how you used AI tools, if you did,
     e.g. "AI assistants were used for brainstorming, debugging and drafting tests.
     All design decisions and the final code were reviewed by me." -->

## Demo and submission

- **Live app:** https://rowready.onrender.com
- **Demo video:** `<PASTE DEMO VIDEO LINK HERE>`
- [Demo script and expected sample results](docs/DEMO.md)
- [Deployment walkthrough](docs/DEPLOYMENT.md)
- [Verification results](docs/VERIFICATION.md)
- [Submission checklist](docs/SUBMISSION.md)
- [Project guidelines](END_TERM_PROJECT_GUIDELINES.md)

**Author:** Sree Harish

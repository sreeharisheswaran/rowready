# Deploy one RowReady web service

No public URL has been verified. Local database and application verification are recorded in [VERIFICATION.md](VERIFICATION.md). Publishing requires your GitHub, MongoDB Atlas, and hosting accounts; these credentials were not available in the implementation session.

## 1. Put the source in GitHub

The repository was initialized on branch `main`, but the environment prevents writes to `.git/index.lock`. From a normal terminal or writable checkout:

```sh
git status --short
git check-ignore .env .local/mongo-data .npm-cache node_modules client/dist
```

Inspect the files before committing. Ensure `.env`, connection strings, `.local`, caches, and build output are absent from the staged diff. Because the original environment blocked all commits, there is no existing implementation history to claim or reconstruct. You can create honest, reviewable component commits now:

```sh
git add .gitignore .env.example .node-version .prettierignore .prettierrc.json package.json package-lock.json shared server tests END_TERM_PROJECT_GUIDELINES.md
git commit -m "Implement bounded CSV processing and MongoDB report API"
git add client scripts
git commit -m "Add interactive data workbench and workflow verification"
git add README.md docs render.yaml
git commit -m "Document deployment, verification and submission"
```

Review `git diff --cached` before each commit. Create a GitHub repository in your account, add its real remote, and push `main`. Do not force-push or overwrite another project. The final source repository must be accessible to evaluators.

## 2. Create MongoDB Atlas storage

1. Create an Atlas cluster in a nearby region. Choose a tier appropriate to your submission; no paid API is required.
2. Create a database user scoped to `readWrite` on the `rowready` database. Use a unique strong password and do not commit it.
3. Copy the Node driver connection URI. Include `/rowready` as the database, replace placeholders, and URL-encode reserved password characters. Example shape only: `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/rowready?retryWrites=true&w=majority`.
4. In Atlas Network Access, allow the hosting service’s published outbound IP ranges. Add your own IP separately if testing from your machine. Prefer scoped ranges to opening access globally.

## 3. Create the Render service

Use **New → Blueprint** and select the GitHub repository containing `render.yaml`, or create a Node web service manually with:

- Root directory: repository root.
- Build command: `npm ci --include=dev && npm run build && npm prune --omit=dev`.
- Start command: `npm start`.
- Health check: `/api/health`.
- Node version: `24.13.1` (also in `.node-version`).
- `NODE_ENV=production`.
- `TRUST_PROXY=1` for the intended single reverse proxy. Review this setting if you change host/network topology.
- `MONGODB_URI`: the real Atlas connection URI, configured as a host environment secret.

Let Render supply `PORT`. There is no separate frontend service, CORS origin list, or `VITE_` API secret to configure. Use the host-provided HTTPS address. Build tools are needed during the build and are pruned afterward; do not omit dev dependencies before the build.

The app starts listening while connecting to MongoDB. Health is 503 until MongoDB is connected. A failed initial connection retries every 15 seconds. Atlas credentials, IP access rules, and an included database name are the first things to check if deployment remains unhealthy. Application logs intentionally exclude connection details.

## 4. Verify the real deployment

Use your actual assigned URL in these checks. Do not record a URL as live until it responds successfully.

1. Open `/api/health`: expect HTTP 200, `status: "ok"`, `database: "connected"`.
2. Open `/` and download/upload `sample.csv`. Confirm 9 rows and 7 columns.
3. Apply both cleaning operations: 5 trimmed cells, 2 removed rows, 7 remaining rows.
4. Reset once, clean again, then revalidate. Confirm missing-value, mixed-type, and formula-risk warnings remain.
5. Download the cleaned CSV and compare it with the safe export preview, including `'=2+3`.
6. Open its saved report. Refresh the `/reports/:id` URL directly; the React app should load and retrieve the report.
7. Restart/redeploy the Node service and reopen that report. Its original and latest validation should still be in Atlas.
8. Try a malformed CSV, an oversized CSV, `/api/reports/not-an-id`, and a nonexistent valid ID. Errors should be actionable and contain no internals.
9. Verify the UI at a narrow phone width, by keyboard, and in an incognito window. Confirm evaluator access without sign-in.

Add the verified HTTPS URL to the README and submission form. Record the demo against that deployment. A free host may sleep between visits; check current provider behavior and warm it before recording or evaluation.

## Troubleshooting

- **503 / Storage unavailable:** verify Atlas user/password, database name, IP allowlist, and server environment. Local `127.0.0.1` MongoDB URIs will not reach your computer from a public host.
- **Frontend is not built:** ensure the build ran from the repository root and `client/dist/index.html` exists. Do not set the service root to `server/`.
- **Page refresh 404:** route all paths to this Express service; its SPA fallback excludes `/api` and missing assets.
- **415 uploads:** send CSV bytes as `text/csv`, with no content compression. JSON is used only for clean, validate, and export requests.
- **413 upload:** all file, row, column, cell, string, and parsed-byte limits apply together. Split large files.
- **429 requests:** wait for the 15-minute window; health is exempt. Confirm the host’s proxy configuration before changing any rate limit.
- **Report opens but no row preview:** expected. Only metadata is persistent; start a new upload to inspect data after reload.
- **Apostrophes in the CSV:** expected spreadsheet protection; see the README’s policy before removing protection in another tool.

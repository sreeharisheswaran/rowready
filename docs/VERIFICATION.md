# Actual verification results

## Malformed URL and dependency review — 25 October 2026

The malformed report URL defect is fixed. `GET /api/reports/%` and invalid percent/UTF-8 encodings now return HTTP 400 with `{ "error": { "code": "INVALID_URL", "message": "The request URL contains invalid encoding." } }`. The handler does not echo the URL, exception message, or stack. It recognizes Express's `URIError` with status 400; unrelated internal URI errors still return a generic 500. The earlier HTTP 415 fix remains intact.

Dependency remediation is **partial**: the targeted compatible update changed `ip-address` from 10.7.3 to 10.7.5. The final online audit still reports **two high-severity advisories**, for body-parser and Zod. No dependency regression was observed, but this is not a clean security audit or a completed release.

### Exact project files changed in this continuation

- `server/src/middleware/errors.js`: add the narrow, safe malformed-URL response.
- `tests/api.test.js`: add six regressions covering four malformed encodings, ordinary invalid IDs, literal percent IDs, valid plain/encoded report URLs, absent reports, and an internal URI error. Exact response comparisons prevent accidental error-detail exposure.
- `package-lock.json`: change only the `node_modules/ip-address` entry's version, resolved tarball, and integrity. Express-rate-limit's existing `^10.2.0` range accepts 10.7.5. `package.json`, all other locked dependency versions, and the prior work remain unchanged.
- `docs/VERIFICATION.md`: record this continuation's findings and actual commands separately from historical runs below.
- `docs/SUBMISSION.md`: update its latest-audit summary and link, including the unresolved security findings.

### Dependency advisories and verified applicability

The actual GitHub advisory JSON was fetched from `https://api.github.com/advisories/<GHSA-ID>` with `Invoke-RestMethod`, and compared with the online npm audit, installed source, and dependency tree.

- **body-parser 2.3.0**, introduced by `express@5.2.1` through `^2.2.1`: [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), **high, CVSS 7.5**, uncaught decompression errors from trailing bytes can terminate a process. The advisory specifies **2.4.0** as the patched 2.x release. Both RowReady parsers already use `inflate: false`, the advisory's documented workaround, and the API regressions confirm encoded bodies are rejected. This blocks the described decompression path but does not remove the installed-version audit finding.
- **Zod 4.6.5**, a direct exact dependency: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), **high, CVSS 7.5**, memory exhaustion while accumulating validation issues. The first patched release is **4.6.6**; npm audit recommends 4.6.7. RowReady passes client datasets through Zod array schemas. A bounded, harmless probe with `z.array(z.string()).max(1).safeParse(Array(100).fill(1))` produced **101 issues**, confirming that a collection maximum does not prevent validation of every invalid element in this installed version. The 4 MiB request limit bounds incoming bytes, but does not establish complete mitigation of validation memory amplification. No process-exhaustion attack was run.
- **ip-address 10.7.3 → 10.7.5**, introduced by `express-rate-limit@8.7.0` through `^10.2.0`: [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5), **moderate** in npm / **medium** in GitHub, with **no numeric CVSS score supplied**. The advisory concerns quadratic zone-identifier parsing and names 10.7.4 as the first patched release. The targeted update selected the newer compatible patch 10.7.5; installed source uses the corrected index-based zone scan. Express-rate-limit also gates `Address6` construction with Node's IPv6 validator; a small sample of the advisory's malformed input failed that gate. No application-level exploit was demonstrated. The final audit no longer reports this package.

**Registry limitation:** lookup of body-parser 2.4.0 and Zod 4.6.6/4.6.7 returned **E404**. Revalidation with `--prefer-online --offline=false --registry=https://registry.npmjs.org` still listed body-parser's latest release as 2.3.0 and Zod's 4.6 line as 4.6.5. This contradicts the patched versions cited by the advisory/audit data available during the run. Body-parser 1.20.9 appeared in the registry but is outside Express's required 2.x range, so it was not substituted. No forced update, override, downgrade, unpublished-source installation, or audit suppression was used. The two high findings remain open until compatible patched packages can be fetched and verified.

### Commands executed and results

Environment: Windows, Node **v24.13.1**, npm **11.8.0**, cached MongoDB **7.0.24**. These are results from this continuation, not claims copied from earlier runs.

- `node --test --test-isolation=none --test-name-pattern='report URL|internal URI' tests/api.test.js`: before the fix, **4 failed, 2 passed**; all malformed encodings reproduced HTTP 500 instead of 400.
- `node --test --test-isolation=none tests/api.test.js`: **25 passed, 0 failed, 0 skipped**, run after the URL fix and again after the dependency update.
- `npm explain body-parser ip-address zod` and `npm ls body-parser ip-address zod`: **exit 0**; confirmed the introducing dependencies and installed versions. The post-update `npm ls` showed ip-address 10.7.5, body-parser 2.3.0, and Zod 4.6.5.
- `npm audit --json --offline=false --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: initial online audit completed with **exit 1, 3 advisories (2 high, 1 moderate)**.
- `Invoke-RestMethod -Uri ('https://api.github.com/advisories/' + $reviewAdvisoryId) -TimeoutSec 20`: succeeded for each of the three advisory IDs above; response data was saved under ignored `.local/`.
- `npm view body-parser@2.4.0 version engines dependencies dist.integrity --json --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: **E404**.
- `npm view ip-address@10.7.4 version engines dependencies dist.integrity --json --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: **succeeded**, confirming an available patched release compatible with this Node version.
- `npm view zod@4.6.7 version engines dependencies dist.integrity --json --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: **E404**.
- `npm view body-parser version dist-tags versions --json --prefer-online --offline=false --registry=https://registry.npmjs.org --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: **succeeded**, but returned latest 2.3.0 and no 2.4.0.
- `npm view zod@4.6 version --json --prefer-online --offline=false --registry=https://registry.npmjs.org --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: **succeeded**, returning only 4.6.5.
- `npm view zod@4.6.6 version engines --json --prefer-online --offline=false --registry=https://registry.npmjs.org --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: **E404**.
- `npm update ip-address --ignore-scripts --no-audit --no-fund --prefer-online --offline=false --registry=https://registry.npmjs.org --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: **exit 0, changed 1 package**. The separate full audits before and after were retained; `--no-audit` here only avoids an implicit audit during installation. No `npm audit fix` or `--force` was run.
- `npm run check`: **44 passed, 0 failed, 0 skipped**, including 25 API tests, 16 data tests, Git-ignore and production-routing checks, real MongoDB persistence, and a successful production build.
- `npm run test:ui`: **9 React + real HTTP + MongoDB workflow checks passed** in JSDOM.
- `npm run build`: **passed** separately; 28 modules transformed, approximately 227.79 kB JavaScript and 21.83 kB CSS before gzip.
- `npm run format:check`: **passed**, including after this report and the submission summary were updated.
- `npm run test:e2e`: **exit 1 before browser tests ran**, because the optional `playwright` package is missing. No real-browser success is claimed.
- `npm audit --json --offline=false --registry=https://registry.npmjs.org --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=15000`: final fresh online audit completed with **exit 1, 2 high advisories, 0 moderate**. Body-parser and Zod remain; ip-address is resolved.

Read-only inspection also used `rg`, `Get-Content`, `git status --short`, `git remote`, and `git ls-files --cached`. The remote and tracked-file lists are empty. Before/after file hashing and a parsed lockfile comparison were used because the project was already untracked; Git status alone cannot show this continuation's edits. No fresh `npm ci` was run.

Real database tests used a new `.local/url-deps-mongo-data` directory on loopback port 27018, started with the same cached MongoDB executable documented in the previous run and `Start-Process -WindowStyle Hidden`. Before shutdown, the server's data path was verified and the test collection contained **zero remaining reports**. The review database was shut down successfully. Existing `.env` and database directories were preserved. Generated builds, local database files, package backups, advisory JSON, and hash records are ignored verification artifacts.

### Remaining release work

- **Confirmed application defects:** the reproduced malformed-URL defect is fixed, and the previous 415 fix still passes. No additional application defect was confirmed in the exercised checks. Shared unauthenticated report metadata remains a documented privacy limitation.
- **Dependency release gate:** obtain compatible published body-parser and Zod patches, rerun the tests and online audit, and resolve the two high findings above. The current audit is not clean.
- **Real browser:** install/configure Playwright and a browser, then run desktop/mobile workflows, keyboard/focus/accessibility checks, file downloads, deep refresh, and layout acceptance. JSDOM does not cover browser layout. Earlier Chrome IPC limitations were not retested here.
- **Atlas and deployment:** configure the real Atlas database user and scoped network access, configure host secrets/HTTPS/proxy settings, deploy only when separately authorized, and verify live health, workflows, and report persistence after a hosted restart. Local MongoDB results do not verify Atlas or hosting.
- **GitHub:** review source and secrets, create the intended commit history and repository/remote, and publish only when separately authorized. No staging, commit, push, or destructive Git operation occurred in this review.
- **Demo and submission:** record and publish the 3–5 minute demo, add verified repository/application/video links, check evaluator access and spreadsheet behavior, and complete the official form by **27 October 2026, 11:59 PM IST**. Nothing was deployed, published, or submitted by this review.

## HTTP 415 correction and review — 25 October 2026

This run fixes a confirmed error-contract defect: the shared handler mapped every HTTP 415 error to `UNSUPPORTED_ENCODING`, overwriting the routes' accurate `UNSUPPORTED_MEDIA_TYPE` codes and content-type guidance. It now maps only body-parser's `encoding.unsupported` and `charset.unsupported` errors to the existing encoding response. No features, UI redesign, dependency upgrades, Git writes, pushes, or deployments were performed.

### Files changed

- `server/src/middleware/errors.js`: narrow the encoding-error condition; preserve the routes' media-type errors.
- `tests/api.test.js`: replace status-only 415 assertions with nine regressions checking status, JSON response type, exact error code, and exact message. Coverage includes unsupported media on all four dataset endpoints, gzip and unknown compression on both raw/JSON parsers, and an unsupported JSON charset.
- `docs/VERIFICATION.md`: record this run separately from the historical results below.

### Commands actually executed and results

Environment: Windows, Node `v24.13.1`, npm `11.8.0`, installed dependencies, and cached MongoDB `7.0.24`. Existing environment values were checked without printing connection strings. No fresh dependency installation was run.

- `node --test --test-isolation=none --test-name-pattern='HTTP 415' tests/api.test.js`: before the fix, **4 failed and 5 passed**. All four media-type regressions reproduced the wrong code/message; the five encoding cases already passed.
- `node --test --test-isolation=none tests/api.test.js`: after the fix, **19 passed, 0 failed, 0 skipped**.
- `npm run check`: first run built successfully and reported **37 passed, 1 failed, 0 skipped**. The MongoDB test failed with `ECONNREFUSED 127.0.0.1:27018`, because the configured local server was stopped. After starting an isolated local MongoDB, the rerun built successfully and reported **38 passed, 0 failed, 0 skipped**: 19 API, 16 data, 1 Git-ignore, 1 production routing, and 1 real MongoDB persistence test.
- `npm run test:ui`: first run compiled the React components but failed connecting to that stopped database before running workflow checks. After starting the isolated database, the rerun **passed all 9 React + real HTTP + MongoDB workflow checks**. These use JSDOM, not a real browser.
- `npm run format:check`: **passed**, including a final run after this verification entry was added.
- `npm run build`: **passed** independently of `check`; Vite transformed 28 modules and generated approximately 227.79 kB JavaScript and 21.83 kB CSS before gzip.
- `npm run test:e2e`: **failed before any browser checks ran**, with `ERR_MODULE_NOT_FOUND` for the optional `playwright` package. No browser success is claimed.
- `npm audit --offline=false --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=8000`: initial sandbox attempt failed to reach the registry. The approved network-enabled rerun completed with **exit 1 and 3 vulnerabilities: 2 high, 1 moderate**. This is not a clean audit result.
- `npm explain body-parser ip-address zod`: **exit 0**; confirmed `body-parser@2.3.0` via Express, `ip-address@10.7.3` via express-rate-limit, and direct `zod@4.6.5`, all production dependencies.
- A `node --input-type=module` probe using Supertest and the existing memory report store requested `/api/reports/%` and `/api/reports/%E0%A4%A`: **both returned HTTP 500 with `INTERNAL_ERROR`**, confirming the remaining malformed-URL defect below. The probe itself exited 0.

Read-only review used `rg`, `Get-Content`, `git status --short`, and `git ls-files --cached --others --exclude-standard`. An initial inline environment-inspection command failed because of PowerShell/native argument quoting; its corrected stdin-based version succeeded. File hashes were recorded before editing because all project files were already untracked; Git status alone cannot identify this run's changes.

The cached executable at `D:/mern-exam-practice/node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe` was launched with `Start-Process -WindowStyle Hidden`, bound only to `127.0.0.1:27018`, with a new `D:/ROWREADY/.local/http-415-mongo-data` directory and `.local/http-415-mongodb.log`. Existing database files and `.env` were not changed. The review database was shut down after checking that the test reports had been removed. Generated production/UI bundles, the isolated database files, and review bookkeeping are ignored local artifacts, not source changes.

### Remaining confirmed defect and security concerns

- **Malformed report URLs are misclassified as server errors.** Express supplies a 400 `URIError` when it cannot decode a report path parameter; the shared handler falls through to 500 `INTERNAL_ERROR`. Both paths above reproduce it. This remains separate from the corrected 415 mapping. No stack or database details were exposed in those responses.
- **Installed dependency advisories:** `body-parser@2.3.0` has a high-severity compressed-request denial-of-service advisory, [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828); `zod@4.6.5` has a high-severity oversized-collection memory-exhaustion advisory, [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5); `ip-address@10.7.3` has a moderate-severity IPv6 zone-identifier denial-of-service advisory, [GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5). Affected installed versions are confirmed; application-level exploitation was not tested. Both request parsers have `inflate: false`, so RowReady rejects compressed bodies before the body-parser decompression path. Payload limits and IP validation are present but are not evidence that the other advisories are fully mitigated. No `npm audit fix` was run.
- **Public metadata is a confirmed privacy limitation:** the report list/detail routes have no authentication and expose filenames, column names, and aggregates to anyone reaching the instance. This behavior is documented and visible in the UI; it is not a newly introduced defect or a request to add accounts. Session capability checks protect validation updates, not report reads.

### Release checks still open

- **Real browser:** install/configure Playwright and its browser, then rerun desktop/mobile `test:e2e`. Verify layout, scrolling, focus/keyboard behavior, upload/download dialogs, browser reloads, and uncaught browser errors. JSDOM results do not cover these.
- **External network:** browser-tool downloads, a fresh lockfile installation on the actual hosting platform, dependency remediation followed by a clean online audit, and verification of the eventual public HTTPS URL and links. The online audit did run in this review; its findings remain unresolved.
- **MongoDB Atlas/hosting:** actual Atlas credentials and scoped network access, host secrets/proxy/HTTPS configuration, live readiness and workflows, and saved-report persistence after a hosted service restart. Local MongoDB success does not establish Atlas or deployment success. No service was deployed.
- **Manual verification:** responsive and accessibility acceptance, spreadsheet import/protection behavior in the intended spreadsheet tools, staged-file/secret review before any future commit, and demo/submission/link checks. No GitHub push or submission was made.

## Release audit — 25 October 2026

The existing application and release documentation were inspected without rebuilding the product, redesigning the UI, or adding features. No reproducible material defect was found in the application workflows exercised. The only implementation change was strengthening `.gitignore`, with a new regression test; the source and UI were left unchanged.

### Commands executed during this audit

- `npm run format:check`: passed.
- `npm run check`: **29 passed, 0 failed, 0 skipped**, including the production build, 16 data tests, 10 API tests, 1 Git-ignore regression test, 1 SPA-routing test, and 1 real MongoDB persistence test. The initial unchanged baseline passed 28 tests.
- `npm run test:ui`: **9 checks passed** against the actual React components, real HTTP endpoints, and a configured local MongoDB test database. These are DOM integration checks, not real-browser or visual verification.
- `npm start`: started successfully with MongoDB connected. A fresh request to `http://127.0.0.1:3000/api/health` returned **200** and `database: "connected"`. The Vite development server on port 5173 was not running during this audit.
- `node --test --test-isolation=none tests/gitignore.test.js`: first **failed** on the unignored `.env-backup` fixture; **passed after the fix**. The test also checks credential/key files, MongoDB artifacts, caches, and that `.env.example`, source, deployment configuration, and the demo CSV remain addable.
- `npm run test:e2e`: **failed before any browser test ran**, because the optional `playwright` package is not installed. The earlier Chrome IPC restriction below was not re-tested in this audit. Follow the README's Playwright installation steps from a normal development terminal, or perform the manual browser acceptance checks.
- `npm audit --offline=false --cache D:\ROWREADY\.npm-cache --fetch-retries=0 --fetch-timeout=8000`: **blocked**, because the registry audit endpoint connection was refused. This is not a clean vulnerability audit result.

No standalone `npm run build`, `npm run test:db`, or fresh `npm ci` was needed in this audit: the build and MongoDB test were actually executed by `npm run check`; the earlier fresh-install result is retained below as historical evidence.

### Git and secret handling

- `git status` / `git log` confirmed branch `main` still has **zero commits**. `git remote` returned no configured remotes; `git ls-files --cached` returned no tracked/staged files. No meaningful commit history or GitHub publication exists yet.
- No staging, commits, resets, pushes, or deployments were performed. This agent environment still grants read-only access to Git metadata; the earlier failed staging attempt is documented below. Use a normal writable terminal for the documented local commits.
- `.gitignore` already covered the current `.env`, `.local` database directory, and npm cache, but did not cover common credential files, keys, environment backups, or MongoDB dumps elsewhere. Those exclusions have now been added and checked using Git itself.
- A value-redacting pattern scan of **55 publishable files** found **zero suspected secrets**. No secret values were printed. The application URI is local; an Atlas connection was not configured or tested.
- Ignore rules protect normal additions of untracked files. They cannot prevent `git add -f`, secret literals in source, or already-tracked credentials. Review the staged diff before committing; do not treat ignore rules or a pattern scan as an absolute guarantee.

### Release gates still open, in order

1. **GitHub:** create honest local commits in a writable Git environment, create/select the repository, configure its remote, and obtain approval before this assistant pushes. No account access or repository URL is configured here.
2. **Atlas and hosting:** provide an Atlas cluster/database user, scoped network access, and the server-only URI through the host's secret settings. Create the Render service from `render.yaml` after approval, then verify the actual HTTPS URL, health, all four workflows, and saved reports after a host restart. No public deployment or Atlas success is claimed.
3. **Real browser and dependency audit:** install the optional browser test tools in an unrestricted/networked terminal; run the existing desktop/mobile workflow script, check keyboard behavior, and rerun `npm audit`. Record actual outcomes before release.
4. **Demo and submission:** record the prepared 3–5 minute demo, publish an accessible video, update the README with verified repository/deployment links, verify all links in an incognito window, and complete the official form by **27 October 2026, 11:59 PM IST**.

The exact immediate action is the local Git preparation in [DEPLOYMENT.md, step 1](DEPLOYMENT.md#1-put-the-source-in-github). Subsequent publication still requires the user's approval. The video and official form require the user's manual completion; nothing has been submitted on their behalf.

## Earlier implementation run

Verified locally on **25 October 2026**, Windows, Node **24.13.1**, npm **11.8.0**, MongoDB **7.0.24**. These results do not imply a public deployment or a completed real-browser layout check.

### Passed

- **`npm run check`: 28 tests passed, 0 failed, 0 skipped**, plus a successful Vite production build. This includes 16 pure-data tests, 10 API tests, 1 production-routing test, and 1 real MongoDB integration test.
- **`npm run format:check`: passed.** Source, configuration, styles, and documentation are consistently formatted. The supplied project guidelines were left unchanged.
- **Fresh lockfile installation: passed.** `npm ci` installed all 182 packages into a separate empty local verification directory using the lockfile and offline cache, without touching the running application's dependencies.
- **`npm run test:ui`: 9 workflow checks passed** using the actual React components, React Testing Library/JSDOM, a real HTTP Express listener, and a real MongoDB test database.
- **`npm run test:db`: 1 real MongoDB persistence test passed.** The test saves original analysis and cleaned validation, disconnects, checks real storage-unavailable responses, reconnects through a new app instance, and retrieves the saved data.
- **`npm run build`: production bundle generated successfully.** The final full build contained approximately 228 kB JavaScript and 22 kB CSS before gzip; about 71 kB and 6 kB after gzip. Dependencies and lockfile include the Linux native build package used by Vite.
- **Documented local commands exercised:** `npm start` served the built application; `npm run dev` started Express and Vite. Direct and development-proxied `/api/health` both returned HTTP 200 with `database: "connected"`.
- **Actual Node process restart checked:** a sample report with 9 original rows and a saved 7-row validation was retrieved successfully after stopping the serving Node process and starting a new process. MongoDB kept the report. The report’s production deep link returned the SPA HTML.
- **Secret/persistence review:** `.env`, local database files, dependency caches, generated builds, and test output are ignored. The checked source contained placeholders rather than real credentials. No MongoDB URI, internal capability hash, or internal header hash was found in the frontend bundle. The real database test inspected the stored document and confirmed no complete dataset or raw row values were stored.

### Workflow coverage

Data/API tests exercise ordinary CSV, quoted commas, escaped quotes, embedded CR/LF, UTF-8 BOM, empty and whitespace-only cells, duplicate detection and removal, trim behavior, original preservation, operation ordering/idempotence, inference, numeric statistics, malformed quoting, row consistency, empty/binary/invalid-encoding input, file/row/column/cell/parsed-byte limits, filename handling, invalid operations, CSV round trips, formula protection, strict JSON contracts, compressed-body rejection, report identifiers, absent reports, invalid update capabilities, unavailable storage, generic server errors, rate limiting, and SPA/API separation.

The React integration checks cover:

1. Client and backend upload errors.
2. Real upload, metrics, and row preview rendering.
3. Cleaning request failure, retained data, and successful retry.
4. Reset to original and deterministic repeated cleanup.
5. Revalidation with remaining warnings, protected download, and cell-for-cell preview/download comparison.
6. Cleaning/reset invalidating earlier validation and disabling export until revalidated.
7. Original and latest report findings after the React app is remounted without session data.
8. Invalid and nonexistent report errors.
9. Untrusted HTML-like cells rendered as inert text.

The prepared demo’s expected results are asserted: 9 × 7 original data, 2 missing cells, 1 original duplicate, 5 trims, 2 removed rows, 7 final rows, and 3 remaining warning categories.

### Not verified / remaining manual checks at that time

- **Real-browser workflow and visual checks:** the Playwright script was attempted, but Chrome terminated because the execution environment denied its Windows IPC channels (`Access is denied`, `platform_channel.cc`). Its debugging connection was unavailable. No browser pass, screenshot review, mobile layout pass, or keyboard acceptance pass is claimed. Run `npm run test:e2e` in an unrestricted development environment, or complete the manual demo in a real browser. DOM workflow tests do not establish visual correctness.
- **Public deployment and Atlas connectivity:** hosting and Atlas account credentials were unavailable. Local testing used real MongoDB, not Atlas. Follow [DEPLOYMENT.md](DEPLOYMENT.md), verify the actual HTTPS URL, and repeat the restart/persistence checks on the host.
- **Registry vulnerability audit:** registry network access was blocked. Dependencies were installed from cached packages and locked; no online audit result is claimed. Run `npm audit` when network access is available and assess any findings before public release.
- **Git commits/push:** Git was initialized, but attempts to stage or commit failed because `.git/index.lock` could not be created in the read-only Git metadata directory. No commits or pushes were made. Source and lockfile are available; use the guide from a writable Git environment.
- **Video and official form:** neither has been created/submitted by the application implementation. These remain the developer’s submission tasks.

The implementation has no known failing data/API/integration tests after the final fixes. Report visibility, transient datasets, inference, spreadsheet protection, and scope limitations are documented in the README. Treat the outstanding real-browser and deployed-host checks as release work, not as already passed criteria.

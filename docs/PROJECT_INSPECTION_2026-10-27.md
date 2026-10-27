# RowReady project inspection

Reviewed: 27 October 2026. Scope: current working copy, including existing uncommitted changes.

**14 actionable findings: 3 high, 7 medium, 4 low.** The principal risks are authentication configuration, public disclosure of account information through reports, and a vulnerable validation dependency. Existing automated checks pass but do not exercise several of the reproduced failure cases.

No application code or dependency versions were changed during this inspection. This report was added; temporary reproduction scripts and generated builds are under ignored `.local/` and `client/dist/` directories. Existing tests created and cleaned up their own MongoDB test records.

## Verification

- `npm run check`: production build succeeded; 46 tests passed, 0 failed, 0 skipped, including authentication and real MongoDB persistence.
- `npm run test:ui`: 9 React + HTTP + MongoDB workflow checks passed.
- `npm run format:check`: passed before adding this report.
- `npm audit`: 2 high-severity dependency advisories, with different application exposure as explained in F03.
- Targeted local probes reproduced F01, F02, F04–F09, and F11–F13. API probes used synthetic identities and the repository's test-only report store, without touching application reports. UI probes used compiled application components, JSDOM, and controlled fetch responses.
- F10 and F14 are supported by source inspection, not a completed browser E2E run.
- Real-browser layout, a deployed instance, and exploitability under production load were not tested. Playwright is not installed as a project dependency. No stress or denial-of-service attack was performed.

Severity reflects impact and the conditions needed to trigger it. A passing test suite is not evidence that these untested cases work.

## High priority

### F01 — Production accepts a public default JWT signing secret

**Location:** [server/src/config.js:12](../server/src/config.js#L12), [server/src/middleware/auth.js:19](../server/src/middleware/auth.js#L19), [render.yaml:9](../render.yaml#L9), [.env.example:8](../.env.example#L8).

**Problem:** `JWT_SECRET` defaults to a literal development key regardless of environment. The example environment file repeats that key, and the Render blueprint does not provision a replacement.

**Impact:** A deployment following the supplied configuration can accept attacker-created tokens claiming another user's identity. Report responses also reveal user IDs and account attributes, which makes impersonation easier. This finding is conditional on a missing/default secret; it does not establish that any live deployment uses it.

**Evidence:** In an isolated process with `NODE_ENV=production`, dotenv disabled, and no `JWT_SECRET`, configuration loaded successfully and `verifyToken()` accepted a synthetic token signed with the public default.

**Fix:** Require a strong, independently generated secret in production; reject missing and known development values at startup. Provision it in deployment configuration. Rotate the key and invalidate existing tokens on any deployment that used the default.

### F02 — Report privacy is enforced only in the UI; the API exposes uploader identities

**Location:** [server/src/routes/api.js:67](../server/src/routes/api.js#L67), [server/src/routes/api.js:84](../server/src/routes/api.js#L84), [server/src/services/reports.js:17](../server/src/services/reports.js#L17), [client/src/pages/Reports.jsx:45](../client/src/pages/Reports.jsx#L45).

**Problem:** The report list accepts anonymous requests, report details have no authentication middleware, and `publicReport()` includes uploader ID, email, and name. The report UI nevertheless states that reports remain private when signed out and that details are private to authenticated users.

**Impact:** Anyone who can reach the API can enumerate reports and retrieve uploader email addresses, filenames, column names, and aggregate statistics. Hiding the pages after logout does not prevent access.

**Evidence:** After a signed-in synthetic upload, both unauthenticated `GET /api/reports` and `GET /api/reports/:id` returned HTTP 200 with the uploader's email and ID.

**Fix:** Decide and enforce the intended visibility in the API. Private reports require authentication and ownership checks on list/detail operations. If shared reporting remains intentional, remove the privacy claims and omit account identifiers from public responses. The README and upload notice describe shared metadata; the account identity exposure and contrary privacy promises still need correction.

### F03 — Installed Zod has a high-severity memory-exhaustion advisory

**Location:** [package.json:37](../package.json#L37), [server/src/services/dataset.js:22](../server/src/services/dataset.js#L22), [package-lock.json:693](../package-lock.json#L693).

**Problem:** `zod@4.6.5` is affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): oversized constrained collections can exhaust memory. Unauthenticated processing endpoints accept nested arrays and pass them to Zod. The installed parser iterates array elements even when the collection exceeds a schema maximum.

**Impact:** The validation path is relevant to the advisory. The 16 MiB request limit and rate limiter reduce exposure but do not replace early structural bounds or a patched validator. No process-exhaustion reproduction was attempted.

**Fix:** Upgrade Zod to a patched release, at least 4.6.6; the audit currently offers 4.6.7. Check array sizes before expensive per-element validation and retain HTTP body limits.

**Separate dependency note:** Audit also reports `body-parser@2.3.0` for [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), a compressed-body denial of service. Both current parsers use `inflate: false`, and tests verify rejection of compressed input. Its described compressed-body trigger is therefore blocked on the reviewed routes. Update to 2.4.0 or later through the compatible dependency tree, but do not treat this as a demonstrated reachable exploit in this application.

## Medium priority

### F04 — Session restoration deletes valid tokens on cancellation or temporary failure

**Location:** [client/src/App.jsx:58](../client/src/App.jsx#L58), [client/src/main.jsx:8](../client/src/main.jsx#L8), [scripts/test-ui.js:97](../scripts/test-ui.js#L97).

**Problem:** Every rejected `/auth/me` request removes the stored token, including an aborted effect, network outage, rate limit, or server failure. React StrictMode reruns mount effects in development, aborting the first restoration request.

**Evidence:** Mounting the compiled App inside StrictMode with a valid synthetic session made two restoration calls. The UI displayed the authenticated user after the second call, but localStorage no longer contained the token.

**Impact:** Reloading development mode breaks persistent login and leaves a misleading signed-in UI. Later uploads may become anonymous. Temporary production API failures can also erase valid sessions. Existing UI tests mount App without StrictMode and miss this case.

**Fix:** Ignore canceled/stale requests, retain credentials on transient errors, and clear them only on an explicit authentication failure. Preserve HTTP status/error codes in the API client so these cases can be distinguished. Test the real root wrapper.

### F05 — In-flight work can repopulate the workspace after sign-out

**Location:** [client/src/App.jsx:91](../client/src/App.jsx#L91), [client/src/utils/useWorkspace.js:41](../client/src/utils/useWorkspace.js#L41), [client/src/utils/useWorkspace.js:127](../client/src/utils/useWorkspace.js#L127).

**Problem:** Sign-out clears the current session but does not cancel or invalidate active requests. Upload completion unconditionally calls `setSession`. Clean/validate completions similarly assume the old session still exists.

**Evidence:** A delayed upload was started while authenticated. After clicking Sign out, completing the upload restored its working-data preview while the UI showed Sign in.

**Impact:** A previous user's dataset can reappear after logout. Clean/validate completions may also encounter a null session. Sign-out clears an active dataset without the download/discard confirmation used by New upload.

**Fix:** Cancel requests or attach a session generation identifier and ignore stale completions after logout. Guard state updaters against cleared sessions, and confirm disposal of undownloaded work.

### F06 — Invalid or expired bearer tokens silently create anonymous reports

**Location:** [server/src/middleware/auth.js:39](../server/src/middleware/auth.js#L39), [server/src/routes/api.js:41](../server/src/routes/api.js#L41).

**Problem:** `optionalAuth` converts any token verification failure into `req.user = null`, even when the caller explicitly supplied credentials.

**Evidence:** Uploading with an expired synthetic JWT returned HTTP 201 and a report with `userId: null`.

**Impact:** Users whose seven-day token expires while the app remains open can continue receiving successful upload messages, but new reports disappear from My Reports and cannot later be claimed through an existing ownership workflow.

**Fix:** Allow anonymous access when credentials are absent; return 401 when supplied credentials are invalid. Have the UI request sign-in and retry without silently changing ownership.

### F07 — UTF-16 without a BOM fails for ordinary ASCII-containing CSV files

**Location:** [server/src/services/csv.js:56](../server/src/services/csv.js#L56).

**Problem:** The decoder tries UTF-8 before the BOM-less UTF-16 heuristic. ASCII UTF-16 bytes, including zero bytes, are valid UTF-8, so decoding returns early with embedded NUL characters. Dataset validation then rejects the result.

**Evidence:** Encoding `name,score\nAlice,10\n` as UTF-16LE or UTF-16BE without a BOM produced `INVALID_DATASET` in both cases, despite the documented support.

**Fix:** Apply the alternating-zero UTF-16 heuristic before accepting the UTF-8 result, or retry detection when a UTF-8 result contains NULs. Add BOM-less fixtures for both byte orders.

### F08 — Delimiter detection fails when a quoted header spans lines

**Location:** [server/src/services/csv.js:181](../server/src/services/csv.js#L181).

**Problem:** Delimiter detection inspects only the first physical line, which can end inside a quoted header. If the actual separator occurs after that newline, detection incorrectly defaults to a comma.

**Evidence:** Valid semicolon input `"first\nname";score\nAlice;10` returned `MALFORMED_CSV`; the equivalent tab-delimited input failed too.

**Impact:** Supported CSV formats are rejected solely because a column heading contains a newline.

**Fix:** Scan through the first complete logical record, respecting quoted fields and escaped quotes, before selecting a delimiter.

### F09 — Password limits exceed bcrypt's 72-byte limit

**Location:** [server/src/controllers/auth.js:12](../server/src/controllers/auth.js#L12), [server/src/controllers/auth.js:34](../server/src/controllers/auth.js#L34), [server/src/controllers/auth.js:57](../server/src/controllers/auth.js#L57).

**Problem:** Signup/login accept passwords up to 100 JavaScript characters, but bcrypt considers only the first 72 UTF-8 bytes. Multibyte characters reach the limit sooner.

**Evidence:** Hashing 72 `a` characters followed by `ONE`, then comparing 72 `a` characters followed by `TWO`, returned true. Both inputs satisfy the current password schemas.

**Impact:** Distinct accepted passwords authenticate as the same password; suffixes users believe are significant are ignored.

**Fix:** Enforce a clearly communicated 72-byte UTF-8 limit for bcrypt, or migrate to a password hash that handles the intended length. Preserve compatibility deliberately for existing accounts.

### F10 — Browser E2E workflow is stale after authentication changes

**Location:** [scripts/e2e.js:118](../scripts/e2e.js#L118), [client/src/pages/Reports.jsx:230](../client/src/pages/Reports.jsx#L230).

**Problem:** The browser script starts a fresh context, uploads without signing in, then expects the report filename and Saved findings immediately after View report. ReportDetail now requires a user and shows a sign-in gate instead.

**Evidence:** Source inspection shows no signup/login or authentication seeding in the E2E workflow before the report assertions. The passing JSDOM test explicitly seeds an account token, so it is exercising a different flow. A complete browser E2E run was not performed.

**Impact:** The advertised browser verification workflow cannot reach its later report/mobile assertions as written.

**Fix:** Establish an isolated test account through the intended authentication flow, cover authenticated and anonymous behavior separately, and clean up only records created by the test. Run it against a dedicated test instance.

## Low priority

### F11 — Sign up opens the sign-in form

**Location:** [client/src/App.jsx:210](../client/src/App.jsx#L210), [client/src/components/AuthModal.jsx:6](../client/src/components/AuthModal.jsx#L6).

**Evidence:** Clicking the top-bar Sign up button in a fresh app rendered the heading Sign in to RowReady. Both header buttons only open the modal, whose mode defaults to login and persists across closes.

**Fix:** Pass the requested initial mode from the invoking button and reset the modal when opening it for a different action.

### F12 — Automatically generated blank-column names can collide with later headers

**Location:** [server/src/services/csv.js:208](../server/src/services/csv.js#L208).

**Evidence:** `,Column_1\nAlice,10` produced `DUPLICATE_HEADERS`: the first blank heading becomes `Column_1` before the real later header has been reserved.

**Fix:** Reserve every existing nonblank header before generating unique names for blank columns, or consistently reject blanks if the documented nonblank-header policy is retained.

### F13 — Invalid authentication fields produce CSV-cleaning instructions

**Location:** [server/src/services/dataset.js:71](../server/src/services/dataset.js#L71), [server/src/controllers/auth.js:24](../server/src/controllers/auth.js#L24).

**Evidence:** Signup with a one-character name, valid email, and valid-length password returned HTTP 400 with “Supported operations are trim and deduplicate.” The generic request helper discards the schema's field-specific messages.

**Fix:** Return safe, context-appropriate validation messages or allow each controller to supply its own error message.

### F14 — README and security documentation no longer describe the implemented app

**Location:** [README.md:16](../README.md#L16), [README.md:209](../README.md#L209), [README.md:213](../README.md#L213).

**Problem:** The README says there are no accounts and describes the app as unauthenticated, although signup/login/account-linked reports are implemented. It also says only comma-separated UTF-8 is supported after documenting UTF-16, ANSI, semicolons, and tabs elsewhere. Its nonblank-header contract differs from the parser's automatic naming.

**Impact:** Users and deployers receive contradictory information about supported inputs and privacy. These contradictions make it harder to distinguish intentional shared reporting from a security boundary.

**Fix:** Update the architecture, authentication, public/private data policy, supported encodings, header rules, environment configuration, and test instructions to match the chosen behavior.

## Suggested fix order

1. Correct production secrets and report visibility; update the affected dependencies.
2. Fix authentication restoration, expired-token handling, and cancellation at sign-out.
3. Repair CSV detection and password-length handling.
4. Extend regression coverage for the reproduced cases; repair the browser E2E flow.
5. Resolve the form issues and align documentation with the implementation.

## Reproduction scripts

Temporary, local-only scripts are available in the inspected workspace:

- `.local/audit-probes.mjs`: configuration/token verification, anonymous report access, expired credentials, CSV inputs, bcrypt truncation, and signup error handling.
- `.local/audit-ui-probes.mjs`: StrictMode restoration, signup routing, and upload completion after sign-out. Requires `.local/ui-build/app.js`, generated by `npm run test:ui`.

Run from the project root with `node .local/audit-probes.mjs` and `node .local/audit-ui-probes.mjs`. They assert the observed buggy behavior and print confirmation; they are inspection evidence, not regression tests that pass only after a fix.

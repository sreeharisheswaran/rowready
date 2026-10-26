# Submission checklist

Deadline: **27 October 2026, 11:59 PM IST**.

Latest local release audit: **44 tests and 9 React/HTTP/MongoDB workflow checks passed**, with successful production and formatting checks. Malformed URL handling is fixed and ip-address is patched; **two high-severity dependency advisories remain unresolved** because the registry did not expose the compatible body-parser/Zod patches cited by the advisories. Git still has no commits or remote. Public deployment, Atlas verification, real-browser acceptance, the video, and the form remain incomplete. See [the current audit record](VERIFICATION.md#malformed-url-and-dependency-review--25-october-2026) for commands actually run and blockers. These local results do not mark the deployed-product checklist below complete.

## Finish in this order

1. **Public deployment:** push the source to GitHub from a writable Git environment, connect Atlas, and deploy using [DEPLOYMENT.md](DEPLOYMENT.md).
2. **Browser acceptance:** run the Playwright script or manually exercise the demo, phone layout, keyboard navigation, and report refresh. The implementation environment blocked Chrome’s IPC, so this check remains open.
3. **Verify persistence on the host:** save a report, restart/redeploy the Node service, and open that report again. Check `/api/health`.
4. **Record the demo:** follow [DEMO.md](DEMO.md); upload a 3–5 minute video and make the link accessible.
5. **Update the README:** add only the verified deployment and repository URLs. Keep environment secrets out of Git.
6. **Submit the form:** https://forms.gle/sBy4sfqyiRG2Zpom9

## Details to submit

```text
Project Name: RowReady — Data Quality Workbench
Student Name: [your submission name]
Problem Statement: Help people inspect CSV quality, make explicit cleaning changes,
                   verify the result, and retain analysis reports.
GitHub Repository: [verified repository URL]
Deployed Application: [verified HTTPS URL]
Demo Video: [accessible video URL]
Tech Stack: MongoDB, Express, React, Node.js, Vite, Mongoose, Zod, d3-dsv
Major Features: CSV analysis; deterministic trim and deduplication; reset and previews;
                saved validation; spreadsheet-safe export; MongoDB report history.
```

## Final check before submitting

- [ ] GitHub repository is accessible to evaluators and contains the source, lockfile, README, and `.env.example`.
- [ ] `.env`, `.local`, cache folders, database files, and real credentials are absent from committed files.
- [ ] Public health returns 200 and MongoDB is connected.
- [ ] The sample produces the expected original and cleaned metrics.
- [ ] Cleaning preview and downloaded values match, including documented formula protection.
- [ ] Remaining warnings are visible after revalidation.
- [ ] Saved reports survive browser refresh and a service restart.
- [ ] Invalid files, missing reports, and unavailable services have useful errors.
- [ ] Desktop, phone, and keyboard workflows have been checked in a real browser.
- [ ] Tests and production build pass; any remaining limitations are disclosed.
- [ ] Repository, deployment, and video links work in an incognito window.
- [ ] The official form is completed before the deadline.

Local implementation alone does not submit the project. The verified links, demo video, and completed form are required by the authoritative guidelines.

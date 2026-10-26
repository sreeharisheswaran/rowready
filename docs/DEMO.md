# A 3–5 minute product demo

Use [sample.csv](../client/public/sample.csv). It is a deliberately imperfect fictional dataset with leading-zero IDs, whitespace, exact duplicates, missing values, a quoted city containing a comma, escaped quotes, a multiline note, mixed score types, and one formula-like value. The UI’s sample-download button provides this same file.

## Expected results

- Original: **9 data rows**, **7 columns**, **63 data cells**.
- Missing: **2 cells**, **3.17%** (Mira’s email and Leena’s whitespace-only city).
- Exact duplicates at upload: **1** (Neel’s second identical row).
- Whitespace: **5 data cells**. Formula risk: **1 cell**. Mixed-type columns: **1** (`score` contains the literal `NA`).
- Trim then deduplicate: **5 cells trimmed**, **2 rows removed**, **7 rows left**. The trimmed Asha row becomes identical to another Asha row.
- Final: **49 data cells**, **2 missing (4.08%)**, **0 duplicates**, **0 surrounding-whitespace cells**, **1 formula risk**, **1 mixed column**.
- Three warning categories remain: missing values, mixed types, and formula risks. Lower completeness percentage after duplicate removal reflects the smaller denominator; it is not a new missing value.
- Safe export: **7 rows**, one apostrophe added before `=2+3`. IDs remain text such as `001`; the exporter does not convert them. Spreadsheet auto-formatting on import is outside the CSV format’s guarantees.

## Recording flow

**0:00–0:30 — Problem and audience.** Explain that analysts and students need to understand a CSV before feeding it into a project or spreadsheet. Show the workbench and describe the four-step upload → inspect/clean → validate/export → saved report workflow.

**0:30–1:15 — Upload and inspect.** Upload the sample. Point to the real row/column counts, missing values, and one exact duplicate. Scroll to column types and the data preview. Show `001`, `Mumbai, MH`, and the quoted/multiline notes. Mention that only findings, not raw rows, are stored in MongoDB.

**1:15–2:15 — Clean and compare.** Open Clean & compare. Apply both options, showing 5 trimmed cells and 2 removed rows. Explain that trimming reveals one more duplicate. Compare the 9-row original to the 7-row working data. Reset once to prove the original is preserved, then apply the same cleanup again.

**2:15–3:15 — Revalidate and export.** Open Validate & export. Show that download is disabled until revalidation. Save validation, and acknowledge the three remaining warning categories. Show the safe export preview with `'=2+3`. Download and open the CSV in a text editor to show actual row values and CSV escaping. Avoid claiming all data issues were fixed.

**3:15–4:00 — Saved reports and persistence.** Open the report, switch between original and latest validation, and reload its URL. Explain why findings remain while the working data session ends. Open Saved reports and show the real MongoDB history.

**4:00–4:30 — Reliability and engineering.** Upload a small malformed CSV to show a useful error. Briefly show the tests or documentation and the verified live URL. Name the boundaries: UTF-8 CSV, strict size limits, two explicit transformations, shared metadata, and no user accounts.

Before recording: connect MongoDB, confirm health, close unrelated tabs, use non-sensitive data, and test the microphone. Use the deployed URL once verified. Do not spend the video reading source code.

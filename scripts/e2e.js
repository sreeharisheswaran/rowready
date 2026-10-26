import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCsv } from '../server/src/services/csv.js';
import { cleanDataset } from '../server/src/services/clean.js';
import { spreadsheetValue } from '../shared/export-policy.js';

// Use an installed Playwright package, or PLAYWRIGHT_MODULE for an existing
// installation. CDP_URL lets restricted environments connect to Chrome already
// launched with --remote-debugging-port, without launching a child process.
const packageName = process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href
  : 'playwright';
const { chromium } = await import(packageName);
const browser = process.env.CDP_URL
  ? await chromium.connectOverCDP(process.env.CDP_URL)
  : await chromium.launch({ headless: true });
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const output = path.resolve('test-results');
await mkdir(output, { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());
let checks = 0;
function passed(label) {
  checks++;
  console.log(`PASS ${label}`);
}
try {
  await page.goto(baseURL);
  await page.getByText('Database connected', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, '01-desktop-upload.png'), fullPage: true });
  await page
    .getByLabel('Choose CSV file')
    .setInputFiles({ name: 'broken.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n"bad') });
  await page.getByRole('alert').filter({ hasText: 'quoted field is not closed' }).waitFor();
  passed('malformed upload reports the actual parsing error');

  await page.getByLabel('Choose CSV file').setInputFiles(path.resolve('client/public/sample.csv'));
  await page.getByText('Analysis complete.', { exact: false }).waitFor();
  assert.match(await page.locator('.metrics').textContent(), /9/);
  await page.screenshot({ path: path.join(output, '02-analysis.png'), fullPage: true });
  passed('real CSV upload and analysis render backend findings');

  await page.getByRole('tab', { name: 'Clean & compare' }).click();
  await page.route('**/api/datasets/clean', (route) => route.abort());
  await page.getByRole('button', { name: 'Apply cleaning' }).click();
  await page.getByRole('alert').filter({ hasText: 'Could not reach the API' }).waitFor();
  assert.match(
    await page.getByRole('region', { name: 'Working dataset', exact: true }).textContent(),
    / Asha Rao /,
  );
  await page.unroute('**/api/datasets/clean');
  passed('request failure leaves working data intact and enables retry');

  await page.getByRole('button', { name: 'Apply cleaning' }).click();
  await page.getByText('5 cells trimmed. 2 duplicate rows removed.', { exact: false }).waitFor();
  assert.equal(
    await page
      .getByRole('region', { name: 'Working dataset', exact: true })
      .locator('tbody tr')
      .count(),
    7,
  );
  assert.equal(
    await page
      .getByRole('region', { name: 'Original upload', exact: true })
      .locator('tbody tr')
      .count(),
    9,
  );
  await page.screenshot({ path: path.join(output, '03-comparison.png'), fullPage: true });
  await page.getByRole('button', { name: 'Reset to original' }).click();
  assert.equal(
    await page
      .getByRole('region', { name: 'Working dataset', exact: true })
      .locator('tbody tr')
      .count(),
    9,
  );
  await page.getByRole('button', { name: 'Apply cleaning' }).click();
  await page.getByText('5 cells trimmed. 2 duplicate rows removed.', { exact: false }).waitFor();
  passed('cleaning, before/after preview and reset use actual data');

  await page.getByRole('tab', { name: 'Validate & export' }).click();
  assert.equal(await page.getByRole('button', { name: 'Download cleaned CSV' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Revalidate & save report' }).click();
  await page.getByText('Current validation saved', { exact: true }).waitFor();
  await page.getByText('2 missing cells remain.', { exact: false }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download cleaned CSV' }).click();
  const download = await downloadPromise;
  const downloadedPath = path.join(output, download.suggestedFilename());
  await download.saveAs(downloadedPath);
  const downloaded = parseCsv(await readFile(downloadedPath));
  const expected = cleanDataset(parseCsv(await readFile('client/public/sample.csv')), [
    'trim',
    'deduplicate',
  ]).dataset;
  assert.deepEqual(downloaded, {
    headers: expected.headers.map(spreadsheetValue),
    rows: expected.rows.map((row) => row.map(spreadsheetValue)),
  });
  assert.equal(
    await page.getByRole('region', { name: 'Safe export preview' }).locator('tbody tr').count(),
    downloaded.rows.length,
  );
  await page.screenshot({ path: path.join(output, '04-validation-export.png'), fullPage: true });
  passed('revalidation retains warnings; downloaded CSV matches safe preview and transformed data');

  await page.getByRole('button', { name: 'View report', exact: true }).click();
  await page.getByRole('heading', { name: 'sample.csv', exact: true }).waitFor();
  const reportUrl = page.url();
  await page.reload();
  await page.getByRole('heading', { name: 'Saved findings', exact: true }).waitFor();
  assert.match(await page.locator('.metrics').textContent(), /7/);
  await page.getByLabel('Showing').selectOption('original');
  assert.match(await page.locator('.metrics').textContent(), /9/);
  assert.match(await page.locator('.session-indicator').textContent(), /No active dataset/);
  await page.getByRole('button', { name: 'All saved reports', exact: false }).click();
  await page
    .getByRole('link', { name: /sample.csv/ })
    .first()
    .waitFor();
  await page.screenshot({ path: path.join(output, '05-report-history.png'), fullPage: true });
  passed(
    'MongoDB report history, latest/original findings and deep refresh survive browser reload',
  );

  await page.goto(`${baseURL}/reports/not-an-id`);
  await page.getByRole('alert').filter({ hasText: '24 hexadecimal' }).waitFor();
  await page.goto(`${baseURL}/reports/aaaaaaaaaaaaaaaaaaaaaaaa`);
  await page.getByRole('alert').filter({ hasText: 'not found' }).waitFor();
  passed('invalid and missing saved reports show useful errors');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL);
  await page.getByRole('heading', { name: 'Good data starts here.' }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
  );
  await page.screenshot({ path: path.join(output, '06-mobile-upload.png'), fullPage: true });
  await page.getByLabel('Choose CSV file').setInputFiles(path.resolve('client/public/sample.csv'));
  await page.getByText('Analysis complete.', { exact: false }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
  );
  await page.getByRole('tab', { name: 'Clean & compare' }).click();
  await page.getByRole('button', { name: 'Apply cleaning' }).click();
  await page.getByText('5 cells trimmed. 2 duplicate rows removed.', { exact: false }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
  );
  await page.screenshot({ path: path.join(output, '07-mobile-cleaning.png'), fullPage: true });
  passed('mobile upload and cleaning work without page overflow');
  assert.deepEqual(browserErrors, []);
  passed('no uncaught browser JavaScript errors');
  await writeFile(
    path.join(output, 'e2e-results.json'),
    JSON.stringify(
      { timestamp: new Date().toISOString(), baseURL, checks, reportUrl, browserErrors },
      null,
      2,
    ),
  );
  console.log(`${checks} browser checks passed. Screenshots and downloaded CSV: test-results/`);
} finally {
  await context.close();
  await browser.close();
}

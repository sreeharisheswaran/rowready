import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import mongoose from 'mongoose';
import { createApp } from '../server/src/app.js';
import { Report } from '../server/src/models/Report.js';
import { User } from '../server/src/models/User.js';
import { signToken } from '../server/src/middleware/auth.js';
import { parseCsv } from '../server/src/services/csv.js';

if (!process.env.TEST_MONGODB_URI) {
  console.log(
    'SKIPPED: set TEST_MONGODB_URI to a dedicated test database to run React + HTTP + MongoDB workflows.',
  );
  process.exit(0);
}
// Compile the real React components, with React externalized so Testing Library
// and the application share a single React instance. Production output is untouched.
const outputDirectory = path.resolve('.local/ui-build');
await build({
  configFile: 'client/vite.config.js',
  configLoader: 'native',
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    copyPublicDir: false,
    lib: { entry: path.resolve('client/src/App.jsx'), formats: ['es'], fileName: 'app' },
    rolldownOptions: { external: [/^react(?:\/|$)/, /^react-dom(?:\/|$)/] },
  },
});
await mongoose.connect(process.env.TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const server = createApp().listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: origin });
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'MutationObserver',
  'getComputedStyle',
  'localStorage',
])
  globalThis[name] = dom.window[name];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};
dom.window.confirm = () => true;
const nativeFetch = globalThis.fetch;
const originalCreateURL = URL.createObjectURL;
const originalRevokeURL = URL.revokeObjectURL;
let download;
URL.createObjectURL = (blob) => {
  download = blob;
  return 'blob:rowready-test';
};
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function () {
  /* verify captured blob instead of navigating */
};
let failCleaning = false;
const reportIds = [];
globalThis.fetch = async (url, options) => {
  if (failCleaning && String(url).endsWith('/datasets/clean'))
    throw new TypeError('Simulated network interruption');
  const response = await nativeFetch(new URL(url, origin), options);
  if (String(url).endsWith('/datasets/analyze') && response.ok)
    reportIds.push((await response.clone().json()).report.id);
  return response;
};
const { createElement } = await import('react');
const { render, screen, fireEvent, waitFor, cleanup, within } =
  await import('@testing-library/react');
const { default: App } = await import(pathToFileURL(path.join(outputDirectory, 'app.js')).href);
let checks = 0;
const passed = (message) => {
  checks++;
  console.log(`PASS ${message}`);
};
const click = (role, name) => fireEvent.click(screen.getByRole(role, { name }));
const waitForText = (text) => waitFor(() => assert.ok(screen.getByText(text)), { timeout: 10000 });
const upload = (file) =>
  fireEvent.change(screen.getByLabelText('Choose CSV file'), { target: { files: [file] } });
const testUser = await User.create({
  name: 'Test Analyst',
  email: `test-ui-${Date.now()}@example.com`,
  password: 'password123',
});
const testToken = signToken(testUser);
globalThis.localStorage.setItem('rowready_token', testToken);

try {
  render(createElement(App));
  await waitForText('Database connected');
  upload(new File(['a\nx'], 'book.xlsx'));
  await waitForText(/Choose a .csv file/);
  upload(new File(['a,b\n"broken'], 'broken.csv'));
  await waitForText(/A quoted field is not closed/);
  passed('frontend and server reject invalid uploads with actionable errors');

  const sample = await readFile('client/public/sample.csv');
  upload(new File([sample], 'sample.csv', { type: 'text/csv' }));
  await waitForText(/Analysis complete/);
  assert.equal(document.querySelector('.metric strong').textContent, '9');
  assert.equal(
    screen.getByRole('region', { name: 'Working dataset preview' }).querySelectorAll('tbody tr')
      .length,
    9,
  );
  passed('real CSV upload renders dimensions, metrics and row values');

  click('tab', /Clean & compare/);
  failCleaning = true;
  click('button', 'Apply cleaning');
  await waitForText(/Could not reach the API/);
  const workingRegion = () => screen.getByRole('region', { name: 'Working dataset' });
  assert.equal(workingRegion().querySelectorAll('tbody tr').length, 9);
  failCleaning = false;
  click('button', 'Apply cleaning');
  await waitForText(/5 cells trimmed. 2 duplicate rows removed/);
  assert.equal(workingRegion().querySelectorAll('tbody tr').length, 7);
  assert.equal(
    screen.getByRole('region', { name: 'Original upload' }).querySelectorAll('tbody tr').length,
    9,
  );
  passed('failed cleaning preserves data, retry trims 5 cells and removes 2 rows');

  click('button', 'Reset to original');
  assert.equal(workingRegion().querySelectorAll('tbody tr').length, 9);
  click('button', 'Apply cleaning');
  await waitForText(/5 cells trimmed. 2 duplicate rows removed/);
  passed('reset restores the original; repeated cleanup gives the same result');

  click('tab', /Validate & export/);
  assert.equal(screen.getByRole('button', { name: 'Download cleaned CSV' }).disabled, true);
  click('button', 'Revalidate & save report');
  await waitForText('Current validation saved');
  await waitForText(/2 missing cells remain/);
  assert.equal(screen.getByRole('button', { name: 'Download cleaned CSV' }).disabled, false);
  click('button', 'Download cleaned CSV');
  await waitForText(/CSV download prepared with 7 rows/);
  const exported = parseCsv(Buffer.from(await download.text()));
  assert.equal(exported.rows.length, 7);
  assert.equal(exported.rows[0][1], 'Asha Rao');
  assert.equal(exported.rows[3][6], "'=2+3");
  assert.equal(exported.rows[6][6], 'Two lines:\nfollow up');
  const previewRows = screen
    .getByRole('region', { name: 'Safe export preview' })
    .querySelectorAll('tbody tr');
  const values = [...previewRows].map((row) =>
    [...row.querySelectorAll('td')].map((cell) =>
      cell.classList.contains('missing-cell') && cell.textContent === 'empty'
        ? ''
        : cell.textContent,
    ),
  );
  assert.deepEqual(values, exported.rows);
  passed('validation saves real warnings; downloaded CSV exactly matches the safe preview');

  click('tab', /Clean & compare/);
  click('button', 'Reset to original');
  click('tab', /Validate & export/);
  assert.equal(screen.getByRole('button', { name: 'Download cleaned CSV' }).disabled, true);
  passed('changes invalidate saved validation and disable stale exports');

  click('button', 'View report');
  await waitForText('Saved findings');
  assert.equal(document.querySelector('.metric strong').textContent, '7');
  const reportPath = window.location.pathname;
  cleanup();
  render(createElement(App));
  await waitForText('Saved findings');
  assert.equal(window.location.pathname, reportPath);
  await waitForText('No active dataset');
  assert.equal(document.querySelector('.metric strong').textContent, '7');
  fireEvent.change(screen.getByLabelText('Showing'), { target: { value: 'original' } });
  assert.equal(document.querySelector('.metric strong').textContent, '9');
  click('button', /All saved reports/);
  await waitFor(() => assert.ok(screen.getAllByRole('link', { name: /sample.csv/ }).length > 0));
  passed('saved original and validation findings reopen after remount with no browser dataset');

  cleanup();
  window.history.replaceState({}, '', '/reports/not-an-id');
  render(createElement(App));
  await waitForText(/24 hexadecimal/);
  cleanup();
  window.history.replaceState({}, '', '/reports/aaaaaaaaaaaaaaaaaaaaaaaa');
  render(createElement(App));
  await waitForText(/This saved report was not found/);
  passed('invalid and missing reports render backend errors');

  cleanup();
  window.history.replaceState({}, '', '/');
  render(createElement(App));
  upload(new File(['name\n<script>alert(1)</script>'], 'untrusted.csv'));
  await waitForText(/Analysis complete/);
  assert.ok(
    within(screen.getByRole('region', { name: 'Working dataset preview' })).getByText(
      '<script>alert(1)</script>',
    ),
  );
  assert.equal(document.querySelectorAll('script').length, 0);
  passed('untrusted values render as text, without executable HTML');
  console.log(
    `${checks} React + real HTTP + MongoDB workflow checks passed. DOM tests do not verify browser layout.`,
  );
} finally {
  cleanup();
  URL.createObjectURL = originalCreateURL;
  URL.revokeObjectURL = originalRevokeURL;
  globalThis.fetch = nativeFetch;
  dom.window.close();
  for (const id of reportIds) await Report.deleteOne({ _id: id });
  if (testUser) await User.deleteOne({ _id: testUser._id });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

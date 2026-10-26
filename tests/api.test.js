import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { memoryReportStore } from './helpers/report-store.js';
import { AppError } from '../server/src/middleware/errors.js';
import { parseCsv } from '../server/src/services/csv.js';
import { LIMITS } from '../shared/limits.js';

const fixture = 'name,score,note\n Ana ,10,"a,b"\nAna,10,"a,b"\nBo,,"=1+1"';
const setup = () => {
  const store = memoryReportStore();
  return { store, app: createApp({ reportStore: store, serveClient: false, rateLimitMax: 500 }) };
};
const upload = (app, csv = fixture) =>
  request(app)
    .post('/api/datasets/analyze')
    .set('Content-Type', 'text/csv')
    .set('X-Filename', 'example.csv')
    .send(csv);

test('health returns readiness, safe limits and security headers', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.database, 'connected');
  assert.equal(response.body.limits.fileBytes, LIMITS.fileBytes);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(response.headers['content-security-policy']);
});

test('full API workflow analyzes, cleans, revalidates, exports and reopens metadata', async () => {
  const { app, store } = setup();
  const initial = (await upload(app).expect(201)).body;
  assert.equal(initial.profile.rowCount, 3);
  assert.equal(initial.profile.missingCells, 1);
  assert.equal(initial.profile.duplicateRows, 0);
  assert.match(initial.editToken, /^[a-f0-9]{64}$/);
  assert.equal(initial.report.editTokenHash, undefined);
  assert.equal(initial.report.headerHash, undefined);
  const stored = store.documents.get(initial.report.id);
  assert.equal(stored.rows, undefined);
  assert.equal(stored.dataset, undefined);
  assert.equal(JSON.stringify(stored).includes('a,b'), false);
  const cleaned = (
    await request(app)
      .post('/api/datasets/clean')
      .send({ dataset: initial.dataset, operations: ['deduplicate', 'trim'] })
      .expect(200)
  ).body;
  assert.deepEqual(cleaned.changes, { trimmedCells: 1, removedRows: 1 });
  assert.equal(cleaned.profile.rowCount, 2);
  const validation = (
    await request(app)
      .post('/api/datasets/validate')
      .send({ dataset: cleaned.dataset, reportId: initial.report.id, editToken: initial.editToken })
      .expect(200)
  ).body;
  assert.equal(validation.report.lastValidation.profile.rowCount, 2);
  assert.ok(validation.profile.warnings.some((warning) => warning.code === 'MISSING_VALUES'));
  const exported = await request(app)
    .post('/api/datasets/export')
    .send({ dataset: cleaned.dataset })
    .expect(200);
  assert.equal(exported.headers['x-protected-cells'], '1');
  const downloaded = parseCsv(Buffer.from(exported.text));
  assert.deepEqual(downloaded.rows, [
    ['Ana', '10', 'a,b'],
    ['Bo', '', "'=1+1"],
  ]);
  const history = (await request(app).get('/api/reports').expect(200)).body;
  assert.equal(history.reports.length, 1);
  const reopened = (await request(app).get(`/api/reports/${initial.report.id}`).expect(200)).body
    .report;
  assert.equal(reopened.original.rowCount, 3);
  assert.equal(reopened.lastValidation.profile.rowCount, 2);
  assert.equal(reopened.dataset, undefined);
});

test('identifiers, absent reports and unknown endpoints return consistent errors', async () => {
  const { app } = setup();
  const invalid = await request(app).get('/api/reports/not-an-id').expect(400);
  assert.equal(invalid.body.error.code, 'INVALID_REPORT_ID');
  await request(app).get('/api/reports/aaaaaaaaaaaaaaaaaaaaaaaa').expect(404);
  await request(app).get('/api/absent').expect(404).expect('Content-Type', /json/);
  await request(app).get('/api/reports?limit=999').expect(400);
  await request(app).get('/api/reports?filter[$ne]=x').expect(400);
});

for (const id of ['%', '%ZZ', '%E0%A4%A', '%ED%A0%80']) {
  test(`malformed report URL ${id} returns a safe HTTP 400 error`, async () => {
    const { app } = setup();
    const response = await request(app)
      .get(`/api/reports/${id}`)
      .expect(400)
      .expect('Content-Type', /json/);
    assert.deepEqual(response.body, {
      error: { code: 'INVALID_URL', message: 'The request URL contains invalid encoding.' },
    });
  });
}

test('well-formed report URLs retain identifier validation and report responses', async () => {
  const { app } = setup();
  for (const id of ['not-an-id', '%25', '%2525']) {
    const response = await request(app).get(`/api/reports/${id}`).expect(400);
    assert.deepEqual(response.body, {
      error: {
        code: 'INVALID_REPORT_ID',
        message: 'Report identifiers must contain 24 hexadecimal characters.',
      },
    });
  }
  const initial = (await upload(app).expect(201)).body;
  const encodedId = [...initial.report.id]
    .map((character) => `%${character.charCodeAt(0).toString(16)}`)
    .join('');
  for (const id of [initial.report.id, encodedId]) {
    const response = await request(app).get(`/api/reports/${id}`).expect(200);
    assert.deepEqual(response.body.report, initial.report);
  }
  const absent = await request(app).get('/api/reports/aaaaaaaaaaaaaaaaaaaaaaaa').expect(404);
  assert.equal(absent.body.error.code, 'REPORT_NOT_FOUND');
});

test('invalid uploads and malformed requests fail', async () => {
  const { app } = setup();
  await upload(app, 'a,b\n"broken').expect(400);
  await upload(app, 'a,b\nx').expect(400);
  await upload(app, '').expect(400);
  await request(app)
    .post('/api/datasets/analyze')
    .set('Content-Type', 'text/csv')
    .set('X-Filename', 'book.xlsx')
    .send('a\nx')
    .expect(400);
  await request(app)
    .post('/api/datasets/analyze')
    .set('Content-Type', 'text/csv')
    .set('X-Filename', '%broken')
    .send('a\nx')
    .expect(400);
  await request(app)
    .post('/api/datasets/clean')
    .set('Content-Type', 'application/json')
    .send('{bad')
    .expect(400);
  for (const operations of [[], ['fill'], ['trim', 'trim']])
    await request(app)
      .post('/api/datasets/clean')
      .send({ dataset: { headers: ['a'], rows: [['x']] }, operations })
      .expect(400);
});

for (const endpoint of ['analyze', 'clean', 'validate', 'export']) {
  test(`${endpoint} returns an accurate HTTP 415 error for unsupported media types`, async () => {
    const { app } = setup();
    const response = await request(app)
      .post(`/api/datasets/${endpoint}`)
      .set('Content-Type', endpoint === 'analyze' ? 'application/json' : 'text/plain')
      .send('{}')
      .expect(415)
      .expect('Content-Type', /json/);
    assert.deepEqual(response.body, {
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message:
          endpoint === 'analyze'
            ? 'Upload CSV bytes with Content-Type: text/csv.'
            : 'Send a JSON request with Content-Type: application/json.',
      },
    });
  });
}

for (const contentEncoding of ['gzip', 'compress']) {
  for (const endpoint of ['analyze', 'clean']) {
    test(`${endpoint} retains its HTTP 415 encoding error for ${contentEncoding} requests`, async () => {
      const { app } = setup();
      // Compression is disabled: rejection must happen before decoding the body.
      const response = await request(app)
        .post(`/api/datasets/${endpoint}`)
        .set('Content-Type', endpoint === 'analyze' ? 'text/csv' : 'application/json')
        .set('Content-Encoding', contentEncoding)
        .send(endpoint === 'analyze' ? fixture : '{}')
        .expect(415)
        .expect('Content-Type', /json/);
      assert.deepEqual(response.body, {
        error: {
          code: 'UNSUPPORTED_ENCODING',
          message: 'Send uncompressed UTF-8 CSV or JSON. This request encoding is not supported.',
        },
      });
    });
  }
}

test('unsupported JSON charsets retain their HTTP 415 encoding error', async () => {
  const { app } = setup();
  const response = await request(app)
    .post('/api/datasets/clean')
    .set('Content-Type', 'application/json; charset=iso-8859-1')
    .send('{}')
    .expect(415)
    .expect('Content-Type', /json/);
  assert.deepEqual(response.body, {
    error: {
      code: 'UNSUPPORTED_ENCODING',
      message: 'Send uncompressed UTF-8 CSV or JSON. This request encoding is not supported.',
    },
  });
});

test('raw upload and JSON body size limits are enforced', async () => {
  const { app } = setup();
  await upload(app, 'x'.repeat(LIMITS.fileBytes + 1)).expect(413);
  await request(app)
    .post('/api/datasets/clean')
    .send({ dataset: 'x'.repeat(LIMITS.requestBytes) })
    .expect(413);
});

test('saved validation requires the upload capability and matching columns', async () => {
  const { app } = setup();
  const initial = (await upload(app).expect(201)).body;
  const body = { dataset: initial.dataset, reportId: initial.report.id, editToken: 'a'.repeat(64) };
  await request(app).post('/api/datasets/validate').send(body).expect(403);
  await request(app)
    .post('/api/datasets/validate')
    .send({
      ...body,
      editToken: initial.editToken,
      dataset: { headers: ['another'], rows: [['x']] },
    })
    .expect(409);
  await request(app)
    .post('/api/datasets/validate')
    .send({ ...body, editToken: initial.editToken, reportId: 'b'.repeat(24) })
    .expect(404);
  await request(app)
    .post('/api/datasets/export')
    .send({ dataset: initial.dataset, spreadsheetSafe: false })
    .expect(400);
});

test('database failure returns 503, leaks no internals and never invents saved reports', async () => {
  const unavailable = () => {
    throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Report storage is unavailable.');
  };
  const app = createApp({
    reportStore: {
      ready: () => false,
      create: unavailable,
      list: unavailable,
      get: unavailable,
      validate: unavailable,
    },
    serveClient: false,
  });
  assert.equal((await request(app).get('/api/health').expect(503)).body.status, 'degraded');
  assert.equal((await upload(app).expect(503)).body.report, undefined);
  await request(app).get('/api/reports').expect(503);
  await request(app).get('/api/reports/aaaaaaaaaaaaaaaaaaaaaaaa').expect(503);
});

test('unexpected errors use a generic response without stack or secret details', async () => {
  const app = createApp({
    reportStore: {
      ready: () => true,
      list: () => {
        throw new Error('secret-connection-string');
      },
    },
    serveClient: false,
  });
  const response = await request(app).get('/api/reports').expect(500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(response.body).includes('secret'), false);
  assert.equal(response.body.error.stack, undefined);
});

test('internal URI errors remain generic HTTP 500 responses', async () => {
  const app = createApp({
    reportStore: {
      ready: () => true,
      list: () => {
        throw new URIError('private internal decoding details');
      },
    },
    serveClient: false,
  });
  const response = await request(app).get('/api/reports').expect(500);
  assert.deepEqual(response.body, {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
});

test('rate limits apply to public API requests but leave health available', async () => {
  const app = createApp({ reportStore: memoryReportStore(), rateLimitMax: 1, serveClient: false });
  await request(app).get('/api/reports').expect(200);
  const response = await request(app).get('/api/reports').expect(429);
  assert.equal(response.body.error.code, 'RATE_LIMITED');
  await request(app).get('/api/health').expect(200);
});

test('every JSON processing endpoint rechecks data structure and rejects extra properties', async () => {
  const { app } = setup();
  const malformed = { headers: ['a', 'b'], rows: [['x']] };
  await request(app)
    .post('/api/datasets/clean')
    .send({ dataset: malformed, operations: ['trim'] })
    .expect(400);
  await request(app)
    .post('/api/datasets/validate')
    .send({ dataset: malformed, reportId: 'a'.repeat(24), editToken: 'b'.repeat(64) })
    .expect(400);
  await request(app).post('/api/datasets/export').send({ dataset: malformed }).expect(400);
  await request(app)
    .post('/api/datasets/export')
    .send({ dataset: { headers: ['a'], rows: [['x']], unexpected: true } })
    .expect(400);
});

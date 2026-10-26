import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { memoryReportStore } from './helpers/report-store.js';

test(
  'built SPA loads on deep refresh; API and missing assets keep their own responses',
  { skip: !existsSync('client/dist/index.html') },
  async () => {
    const app = createApp({ reportStore: memoryReportStore(), production: true });
    for (const path of ['/', '/reports', '/reports/aaaaaaaaaaaaaaaaaaaaaaaa']) {
      const response = await request(app).get(path).expect(200).expect('Content-Type', /html/);
      assert.match(response.text, /<div id="root">/);
    }
    await request(app).get('/api/health').expect(200).expect('Content-Type', /json/);
    await request(app).get('/api/not-real').expect(404).expect('Content-Type', /json/);
    await request(app).get('/assets/missing.js').expect(404);
    await request(app).get('/sample.csv').expect(200).expect('Content-Type', /csv/);
  },
);

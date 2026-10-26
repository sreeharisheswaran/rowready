import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../../server/src/app.js';
import { Report } from '../../server/src/models/Report.js';

test(
  'real MongoDB persists metadata and validation across a new connection and app instance',
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    let reportId;
    try {
      await mongoose.connect(process.env.TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      const app = createApp({ serveClient: false });
      const uploaded = (
        await request(app)
          .post('/api/datasets/analyze')
          .set('Content-Type', 'text/csv')
          .set('X-Filename', 'integration.csv')
          .send('name,score\n Ana ,10\nAna,10')
          .expect(201)
      ).body;
      reportId = uploaded.report.id;
      const clean = (
        await request(app)
          .post('/api/datasets/clean')
          .send({ dataset: uploaded.dataset, operations: ['trim', 'deduplicate'] })
          .expect(200)
      ).body;
      await request(app)
        .post('/api/datasets/validate')
        .send({ dataset: clean.dataset, reportId, editToken: uploaded.editToken })
        .expect(200);
      const document = await Report.collection.findOne({
        _id: new mongoose.Types.ObjectId(reportId),
      });
      assert.equal(document.original.rowCount, 2);
      assert.equal(document.lastValidation.profile.rowCount, 1);
      assert.equal(document.dataset, undefined);
      assert.equal(document.rows, undefined);
      assert.equal(JSON.stringify(document).includes(' Ana '), false);
      await mongoose.disconnect();
      await request(app).get('/api/health').expect(503);
      await request(app).get(`/api/reports/${reportId}`).expect(503);
      await mongoose.connect(process.env.TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      const restartedApp = createApp({ serveClient: false });
      const report = (await request(restartedApp).get(`/api/reports/${reportId}`).expect(200)).body
        .report;
      assert.equal(report.original.rowCount, 2);
      assert.equal(report.lastValidation.profile.rowCount, 1);
      assert.equal(report.editTokenHash, undefined);
      await request(restartedApp).get('/api/health').expect(200);
    } finally {
      if (reportId && mongoose.connection.readyState === 1)
        await Report.deleteOne({ _id: reportId });
      await mongoose.disconnect();
    }
  },
);

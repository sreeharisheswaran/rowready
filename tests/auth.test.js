import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { memoryReportStore } from './helpers/report-store.js';

test(
  'authentication workflow: signup, duplicate rejection, login and me verification',
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const app = createApp({ reportStore: memoryReportStore(), serveClient: false });
    const email = `test-${Date.now()}@example.com`;

    try {
      // 1. Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Alex Analyst', email, password: 'password123' })
        .expect(201);

      assert.ok(signupRes.body.token);
      assert.equal(signupRes.body.user.name, 'Alex Analyst');
      assert.equal(signupRes.body.user.email, email);

      // 2. Duplicate signup should fail with 409
      const dupRes = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Alex Duplicate', email, password: 'password123' })
        .expect(409);
      assert.equal(dupRes.body.error.code, 'EMAIL_EXISTS');

      // 3. Login with wrong password should fail with 401
      const wrongRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrongpassword' })
        .expect(401);
      assert.equal(wrongRes.body.error.code, 'INVALID_CREDENTIALS');

      // 4. Login with correct password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'password123' })
        .expect(200);
      assert.ok(loginRes.body.token);
      assert.equal(loginRes.body.user.email, email);

      // 5. Verify /api/auth/me with Bearer token
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .expect(200);
      assert.equal(meRes.body.user.name, 'Alex Analyst');

      // 6. Verify /api/auth/me without token fails with 401
      await request(app).get('/api/auth/me').expect(401);
    } finally {
      await User.deleteMany({ email });
      await mongoose.disconnect();
    }
  },
);

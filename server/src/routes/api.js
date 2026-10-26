import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { datasetControllers, reportIdSchema } from '../controllers/datasets.js';
import { parseRequest } from '../services/dataset.js';
import { AppError } from '../middleware/errors.js';
import { LIMITS } from '../../../shared/limits.js';

export function apiRouter(reportStore, { rateLimitMax = 60 } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/health', (req, res) => {
    const ready = reportStore.ready();
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      database: ready ? 'connected' : 'unavailable',
      limits: LIMITS,
    });
  });
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait up to 15 minutes and try again.',
      },
    },
  });
  router.use(limiter);
  const controllers = datasetControllers(reportStore);
  router.post(
    '/datasets/analyze',
    express.raw({
      type: ['text/csv', 'application/octet-stream'],
      limit: LIMITS.fileBytes,
      inflate: false,
    }),
    controllers.analyze,
  );
  router.use(express.json({ limit: LIMITS.requestBytes, strict: true, inflate: false }));
  const requireJson = (req, res, next) => {
    if (!req.is('application/json'))
      return next(
        new AppError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Send a JSON request with Content-Type: application/json.',
        ),
      );
    next();
  };
  router.post('/datasets/clean', requireJson, controllers.clean);
  router.post('/datasets/validate', requireJson, controllers.validate);
  router.post('/datasets/export', requireJson, controllers.export);
  router.get('/reports', async (req, res) => {
    const pagination = parseRequest(
      z
        .object({
          limit: z.coerce.number().int().min(1).max(50).default(12),
          offset: z.coerce.number().int().min(0).max(1000).default(0),
        })
        .strict(),
      req.query,
    );
    res.json(await reportStore.list(pagination));
  });
  router.get('/reports/:id', async (req, res) => {
    const parsed = reportIdSchema.safeParse(req.params.id);
    if (!parsed.success)
      throw new AppError(
        400,
        'INVALID_REPORT_ID',
        'Report identifiers must contain 24 hexadecimal characters.',
      );
    res.json({ report: await reportStore.get(parsed.data) });
  });
  router.use((req, res) =>
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'This API endpoint does not exist.' } }),
  );
  return router;
}

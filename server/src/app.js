import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { apiRouter } from './routes/api.js';
import { mongoReportStore } from './services/reports.js';
import { errorHandler } from './middleware/errors.js';

export function createApp({
  reportStore = mongoReportStore,
  trustProxy = 0,
  rateLimitMax,
  serveClient = true,
  production = process.env.NODE_ENV === 'production',
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'style-src': ["'self'"],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'upgrade-insecure-requests': production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use('/api', apiRouter(reportStore, { rateLimitMax }));
  const clientDirectory = fileURLToPath(new URL('../../client/dist', import.meta.url));
  if (serveClient && existsSync(path.join(clientDirectory, 'index.html'))) {
    app.use(express.static(clientDirectory, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (req, res) => {
      if (path.extname(req.path)) return res.status(404).send('Not found');
      res.set('Cache-Control', 'no-cache').sendFile(path.join(clientDirectory, 'index.html'));
    });
  } else {
    app.get('/', (req, res) =>
      res
        .status(503)
        .send('RowReady frontend is not built. Run npm run build, or use npm run dev.'),
    );
  }
  app.use(errorHandler);
  return app;
}

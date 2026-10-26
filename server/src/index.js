import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';

mongoose.set('bufferCommands', false);
let shuttingDown = false;
let retryTimer;
async function connectDatabase() {
  if (!config.mongoUri) {
    console.warn(
      'MONGODB_URI is not configured. Report endpoints will return 503 until configured and restarted.',
    );
    return;
  }
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 5,
    });
    console.info('MongoDB connected.');
  } catch {
    console.warn('MongoDB connection unavailable. Retrying in 15 seconds.');
    if (!shuttingDown) retryTimer = setTimeout(connectDatabase, 15000);
  }
}
mongoose.connection.on('error', () =>
  console.warn('MongoDB connection error. Report requests may temporarily fail.'),
);
mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));

const server = createApp({ trustProxy: config.trustProxy, production: config.production }).listen(
  config.port,
  () => {
    console.info(`RowReady listening on port ${config.port}.`);
    void connectDatabase();
  },
);
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.on('error', () => {
  console.error('The server could not start. Check PORT and whether another process is using it.');
  process.exit(1);
});

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(retryTimer);
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    await mongoose.disconnect();
    clearTimeout(timeout);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

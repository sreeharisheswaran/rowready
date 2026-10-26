import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test(
  'release ignore rules exclude private configuration and database artifacts while allowing source',
  { skip: !existsSync('.git') },
  () => {
    // These are synthetic path queries: no credential or database files are created or read.
    const privatePaths = [
      '.env',
      'server/.env.production',
      '.env-backup',
      'deployment.env',
      '.aws/credentials',
      '.ssh/id_rsa',
      '.gnupg/private-keys-v1.d/example.key',
      '.secrets/local.json',
      '.credentials',
      '.npmrc',
      'credentials.json',
      'server/credentials.production.json',
      'service-account-production.json',
      'server/serviceAccountKey.json',
      'server/private.pem',
      'server/signing.key',
      'certificates/private.p12',
      'certificates/private.pfx',
      'signing.jks',
      'signing.keystore',
      '.local/mongo-data/WiredTiger',
      'data/db/collection.wt',
      'server/data/db/WiredTiger',
      'mongo-data/collection.wt',
      'dump/rowready/reports.bson',
      'backups/reports.bson',
      'WiredTiger.wt',
      'mongod.lock',
      'diagnostic.data/metrics',
      '.npm-cache/example',
      '.npm/example',
      '.cache/example',
      '.vite/example',
      'node_modules/example/index.js',
      'client/dist/index.html',
      'test-results/download.csv',
      'server.log',
    ];
    const publicPaths = [
      '.env.example',
      'README.md',
      'package-lock.json',
      'render.yaml',
      'client/public/sample.csv',
      'server/src/app.js',
    ];
    for (const [paths, expected] of [
      [privatePaths, 0],
      [publicPaths, 1],
    ]) {
      for (const file of paths) {
        const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', file], {
          stdio: 'inherit',
        });
        assert.equal(result.error, undefined, 'Git must be available for release ignore checks.');
        assert.equal(result.status, expected, `Unexpected ignore status for ${file}`);
      }
    }
  },
);

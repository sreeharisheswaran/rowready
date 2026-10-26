import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const defaultPath = path.resolve('.local/mongo-data');
if (!existsSync(defaultPath)) {
  mkdirSync(defaultPath, { recursive: true });
}

const cachedBinary =
  'D:\\mern-exam-practice\\node_modules\\.cache\\mongodb-memory-server\\mongod-x64-win32-7.0.24.exe';
const mongodPath = existsSync(cachedBinary) ? cachedBinary : 'mongod';

console.info(`Starting MongoDB on 127.0.0.1:27018 (dbpath: ${defaultPath})...`);
const proc = spawn(
  mongodPath,
  ['--bind_ip', '127.0.0.1', '--port', '27018', '--dbpath', defaultPath],
  { stdio: 'inherit' },
);

proc.on('error', (err) => {
  console.error('Failed to start MongoDB:', err.message);
  console.info('Ensure mongod is installed or set MONGODB_URI in .env to a MongoDB Atlas cluster.');
  process.exit(1);
});

process.on('SIGINT', () => proc.kill('SIGINT'));
process.on('SIGTERM', () => proc.kill('SIGTERM'));

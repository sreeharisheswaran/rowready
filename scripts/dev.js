import { createServer } from 'vite';
import '../server/src/index.js';

// A single process is sufficient; Vite provides React hot module replacement.
// Restart npm run dev after changing server code or environment settings.
const vite = await createServer({ configFile: 'client/vite.config.js', configLoader: 'native' });
await vite.listen();
vite.printUrls();
process.on('SIGINT', () => {
  void vite.close();
});
process.on('SIGTERM', () => {
  void vite.close();
});

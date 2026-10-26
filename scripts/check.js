import { globSync } from 'node:fs';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { build } from 'vite';

await build({ configFile: 'client/vite.config.js', configLoader: 'native' });
const stream = run({
  files: [...globSync('tests/*.test.js'), ...globSync('tests/integration/*.test.js')],
  isolation: 'none',
});
stream.on('test:fail', () => {
  process.exitCode = 1;
});
stream.compose(spec).pipe(process.stdout);

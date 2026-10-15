import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const output = mkdtempSync(join(tmpdir(), 'spatialos-tests-'));
try {
  const compile = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.test.json', '--outDir', output], { stdio: 'inherit' });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const tests = readdirSync(join(output, 'tests')).filter((name) => name.endsWith('.test.js')).map((name) => join(output, 'tests', name));
    const run = spawnSync(process.execPath, ['--test', ...tests], {
      stdio: 'inherit', env: { ...process.env, NODE_PATH: resolve('node_modules') },
    });
    process.exitCode = run.status ?? 1;
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}

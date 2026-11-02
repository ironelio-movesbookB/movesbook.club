/**
 * Production Next build wrapper.
 * Next 14.2.35 ships with optional @next/swc-* at 14.2.33; on Linux CI/servers
 * that mismatch can crash patch-incorrect-lockfile.js (reading `.os` of undefined).
 * NEXT_IGNORE_INCORRECT_LOCKFILE skips that patcher safely when SWC is installed.
 */
const { spawnSync } = require('child_process');
const path = require('path');

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = '1';

const nextBin = path.join(
  __dirname,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);

const result = spawnSync(
  process.execPath,
  ['--max-old-space-size=6144', nextBin, 'build', ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
);

process.exit(result.status == null ? 1 : result.status);

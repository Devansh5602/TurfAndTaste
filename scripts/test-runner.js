#!/usr/bin/env node

/**
 * Isolated Test Runner for Turf & Taste
 *
 * Ensures all test suites execute against a dedicated, isolated database
 * without mutating or depending on the local development database (server/data/turf_and_taste.db).
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const tempDbName = `turf_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`;
const tempDbPath = path.join(os.tmpdir(), tempDbName);

const env = {
  ...process.env,
  SQLITE_DB_PATH: process.env.SQLITE_DB_PATH || tempDbPath,
  DATABASE_URL: process.env.DATABASE_URL || ''
};

const testArgs = process.argv.slice(2);
const testFiles = testArgs.length > 0 ? testArgs : [
  'tests/stage0-platform-foundation.test.js',
  'tests/stage05-canonical-operationalization.test.js',
  'tests/stage06-hardening.test.js',
  'tests/stage07-release-gate.test.js',
  'tests/stage08-release-gate.test.js',
  'tests/stage09-release-gate.test.js',
  'tests/customer-mobile-regression.test.js'
];

const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...testFiles], {
  env,
  stdio: 'inherit'
});

// Clean up temporary test database sidecars
try {
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  if (fs.existsSync(`${tempDbPath}-wal`)) fs.unlinkSync(`${tempDbPath}-wal`);
  if (fs.existsSync(`${tempDbPath}-shm`)) fs.unlinkSync(`${tempDbPath}-shm`);
} catch (_e) {}

process.exit(result.status ?? 1);

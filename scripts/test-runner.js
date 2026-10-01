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
  // Tests must never inherit a caller's development or production database.
  // `server/db.js` respects already-defined environment values, so set these
  // explicitly before it loads dotenv.
  SQLITE_DB_PATH: tempDbPath,
  DATABASE_URL: '',
  TURF_TEST_MODE: '1',
  DEFAULT_ADMIN_USERNAME: 'test-admin',
  DEFAULT_ADMIN_PASSWORD: 'TurfTasteTestOnly-NotProduction',
  JWT_SECRET: 'turf-taste-test-only-jwt-secret'
};

const testArgs = process.argv.slice(2);
const testFiles = testArgs.length > 0 ? testArgs : [
  'tests/stage0-platform-foundation.test.js',
  'tests/stage05-canonical-operationalization.test.js',
  'tests/stage06-hardening.test.js',
  'tests/stage07-release-gate.test.js',
  'tests/stage08-release-gate.test.js',
  'tests/stage09-release-gate.test.js',
  'tests/admin-phase1.test.js',
  'tests/admin-phase12-integration.test.js',
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

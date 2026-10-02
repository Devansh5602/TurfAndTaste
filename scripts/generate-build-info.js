#!/usr/bin/env node
// Build metadata generator - runs at build time
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const version = process.env.npm_package_version || '1.0.0';
const versionCode = process.env.BUILD_NUMBER || '1';

let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8', stdio: 'pipe' }).trim();
} catch {
  // git not available
}

const buildTimestamp = new Date().toISOString();

const buildInfo = {
  version,
  versionCode,
  gitCommit,
  buildTimestamp,
  buildDate: new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }),
};

const outputPath = resolve('src/generated/build-info.json');
writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));
console.log('Build info generated:', buildInfo);
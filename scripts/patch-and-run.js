#!/usr/bin/env node

/**
 * Runtime-patch ESPN fetches in existing scripts, then run them.
 * Used so cache-data.js can keep its original source while still
 * sending browser headers and using the current NFL season year.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const target = process.argv[2];
if (!target) {
    console.error('Usage: node scripts/patch-and-run.js <script.js>');
    process.exit(1);
}

const abs = path.resolve(target);
let src = fs.readFileSync(abs, 'utf8');

src = src.replace(
    /const fetch = \(\.\.\.args\) => import\('node-fetch'\)\.then\(\(\{default: fetch\}\) => fetch\(\.\.\.args\)\);/,
    "const { fetch, currentNflSeasonYear } = require('./espn-fetch');\nconst SEASON_YEAR = currentNflSeasonYear();"
);

src = src.replace(/dates=2025/g, 'dates=${SEASON_YEAR}');
src = src.replace('const seasonYear = 2025;', 'const seasonYear = SEASON_YEAR;');
src = src.replace(
    "eloRatings = eloData.seasons?.['2025']?.startOfSeasonRatings || {};",
    "eloRatings = eloData.seasons?.[String(currentNflSeasonYear())]?.startOfSeasonRatings || eloData.seasons?.[String(currentNflSeasonYear() - 1)]?.startOfSeasonRatings || {};"
);

const compiled = new Module(abs, module);
compiled.filename = abs;
compiled.paths = Module._nodeModulePaths(path.dirname(abs));
compiled._compile(src, abs);

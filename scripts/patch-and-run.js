#!/usr/bin/env node

/**
 * Runtime-patch ESPN fetches in existing scripts, then run them.
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
    [
        "const { fetch, currentNflSeasonYear } = require('./espn-fetch');",
        "const SEASON_YEAR = currentNflSeasonYear();",
        "const _now = new Date();",
        "const STATS_SEASON_YEAR = (_now.getMonth() < 9 || (_now.getMonth() === 9 && _now.getDate() < 15)) ? SEASON_YEAR - 1 : SEASON_YEAR;",
        "console.log('Season year', SEASON_YEAR, '| stats year', STATS_SEASON_YEAR);"
    ].join('\n')
);

// Current scoreboard (no dates=) is the live week, including 2026 week 1.
src = src.replace(
    "fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025')",
    "fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard')"
);

// Template literals can interpolate. Quoted strings cannot — use concat there.
src = src.replace(/`([^`]*?)dates=2025([^`]*?)`/g, (_, a, b) => '`' + a + 'dates=${STATS_SEASON_YEAR}' + b + '`');
src = src.replace(/dates=2025/g, "dates=' + STATS_SEASON_YEAR + '");
src = src.replace('const seasonYear = 2025;', 'const seasonYear = STATS_SEASON_YEAR;');
src = src.replace(
    "eloRatings = eloData.seasons?.['2025']?.startOfSeasonRatings || {};",
    "eloRatings = eloData.seasons?.[String(currentNflSeasonYear())]?.startOfSeasonRatings || eloData.seasons?.[String(currentNflSeasonYear() - 1)]?.startOfSeasonRatings || {};"
);

const compiled = new Module(abs, module);
compiled.filename = abs;
compiled.paths = Module._nodeModulePaths(path.dirname(abs));
compiled._compile(src, abs);

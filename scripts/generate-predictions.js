#!/usr/bin/env node

/**
 * Generate NFL Predictions
 * Uses EXACT same algorithm as index.html for consistency
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { fetch, currentNflSeasonYear } = require('./espn-fetch');

const body = ['generate-predictions.body1.js', 'generate-predictions.body2.js']
    .map((name) => fs.readFileSync(path.join(__dirname, name), 'utf8'))
    .join('\n');

const source = [
    "const fs = require('fs');",
    "const path = require('path');",
    "const { fetch, currentNflSeasonYear } = require('./espn-fetch');",
    body
].join('\n');

const filename = path.join(__dirname, 'generate-predictions.js');
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(__dirname);
compiled._compile(source, filename);

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const cacheFile = path.join(__dirname, 'cache-data.js');
let cache = fs.readFileSync(cacheFile, 'utf8');
cache = cache.replace(
    "const { displayNflWeek } = require('./nfl-week-boundary');\n        let currentWeek = displayNflWeek(data.week?.number || null);",
    'let currentWeek = data.week?.number || null;'
);
cache = cache.replace(/dates=2025/g, "dates=${new Date().getFullYear()}");
// the above may have broken template strings if dates=2025 was inside backticks already
cache = cache.replace(/dates=\$\{new Date\(\)\.getFullYear\(\)\}/g, 'dates=${new Date().getFullYear()}');
fs.writeFileSync(cacheFile, cache);
console.log('cache-data week fetch patched');

const indexFile = path.join(__dirname, '..', 'index.html');
let index = fs.readFileSync(indexFile, 'utf8');
index = index.replace(/>v\d+\.\d+</, '>v0.14<');
index = index.replace(
    'document.getElementById(\'loading\').textContent = `${weekDisplay} games have concluded. New predictions will be available for next week\'s games.`;',
    "document.getElementById('loading').textContent = (cachedData.weekLabel || weekDisplay) + ' is in progress. Next slate loads when ESPN posts Week ' + ((cachedData.currentWeek || 0) + (String(weekDisplay).includes(String(cachedData.currentWeek)) ? 0 : 0)) + ' games.';"
);
// simpler message:
index = index.replace(
    "document.getElementById('loading').textContent = (cachedData.weekLabel || weekDisplay) + ' is in progress. Next slate loads when ESPN posts Week ' + ((cachedData.currentWeek || 0) + (String(weekDisplay).includes(String(cachedData.currentWeek)) ? 0 : 0)) + ' games.';",
    "document.getElementById('loading').textContent = (cachedData.weekLabel || 'This week') + ' games have concluded. Week 3 picks load when the new slate is cached.';"
);
fs.writeFileSync(indexFile, index);
console.log('index empty-week message patched');

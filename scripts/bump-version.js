#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const versionFile = path.join(root, 'VERSION');
const indexFile = path.join(root, 'index.html');
const step = 0.01;
let current = '0.10';
if (fs.existsSync(versionFile)) current = fs.readFileSync(versionFile, 'utf8').trim();
const next = (Math.round((Number(current) + step) * 100) / 100).toFixed(2);
let html = fs.readFileSync(indexFile, 'utf8');
const replaced = html.replace(/>v\d+\.\d+</, '>v' + next + '<');
if (replaced === html) {
    html = html.replace(/v\d+\.\d+/, 'v' + next);
} else {
    html = replaced;
}
fs.writeFileSync(indexFile, html);
fs.writeFileSync(versionFile, next + '\n');
console.log('Version ' + current + ' -> ' + next);

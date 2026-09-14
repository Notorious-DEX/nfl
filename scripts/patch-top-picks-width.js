#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
const from = 'id="picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem;"';
const to = 'id="picks-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 280px)); gap: 0.75rem; justify-content: start;"';
const from2 = 'id="also-picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem; opacity: 0.92;"';
const to2 = 'id="also-picks-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 280px)); gap: 0.75rem; justify-content: start; opacity: 0.92;"';
if (!text.includes(from) && !text.includes('minmax(250px, 280px)')) {
    console.error('Could not find picks-list grid');
    process.exit(1);
}
text = text.replace(from, to).replace(from2, to2);
fs.writeFileSync(file, text);
console.log('Capped Top Picks tile width');

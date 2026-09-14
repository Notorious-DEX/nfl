#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
text = text.replace(
    '        </div></div>\n\n        <div id="weekresults"',
    '        </div>\n\n        <div id="weekresults"'
);
text = text.replace(
    'id="picks-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 280px)); gap: 0.75rem; justify-content: start;"',
    'id="picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem;"'
);
text = text.replace(
    'id="also-picks-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 280px)); gap: 0.75rem; justify-content: start; opacity: 0.92;"',
    'id="also-picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem; opacity: 0.92;"'
);
if (!text.includes('id="weekresults"')) {
    console.error('weekresults missing');
    process.exit(1);
}
fs.writeFileSync(file, text);
console.log('Restored container indent and wide pick tiles');

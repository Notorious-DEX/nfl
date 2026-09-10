#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

html = html.replace(
    /<div>© 20\d{2} BROpicks\. All rights reserved\.<\/div>/,
    '<div>© <span id="copyrightYear">2026</span> BROpicks. All rights reserved.</div>'
);

if (!html.includes('copyright-year.js')) {
    html = html.replace('</body>', '    <script src="copyright-year.js"></script>\n</body>');
}

fs.writeFileSync(file, html);
console.log('Patched index.html footer year');

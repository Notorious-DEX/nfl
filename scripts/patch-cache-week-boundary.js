#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'cache-data.js');
let text = fs.readFileSync(file, 'utf8');
const needle = 'let currentWeek = data.week?.number || null;';
if (!text.includes("require('./nfl-week-boundary')") && text.includes(needle)) {
    text = text.replace(
        needle,
        "const { displayNflWeek } = require('./nfl-week-boundary');\n        let currentWeek = displayNflWeek(data.week?.number || null);"
    );
    fs.writeFileSync(file, text);
    console.log('cache-data uses Monday week boundary');
} else {
    console.log('cache-data week boundary already present or marker missing');
}

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dropdown = spawnSync(process.execPath, [path.join(__dirname, 'patch-dropdown-years.js')], { stdio: 'inherit' });
if (dropdown.status) process.exit(dropdown.status);

const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
const weekOld = "document.getElementById('weekIndicator').textContent = getWeekDisplay(cachedData.currentWeek);";
const weekNew = "document.getElementById('weekIndicator').textContent = cachedData.weekLabel || getWeekDisplay(cachedData.currentWeek);";
if (text.includes(weekOld)) {
    text = text.replace(weekOld, weekNew);
    console.log('Replaced week indicator from cache');
}
const displayOld = '        function getWeekDisplay(weekNumber) {\n            // Convert week number to display string with playoff round labels\n            if (weekNumber <= 18) {\n                return `Week ${weekNumber}`;\n            }';
const displayNew = "        function getWeekDisplay(weekNumber) {\n            if (weekNumber === 0 || weekNumber == null || weekNumber === '') {\n                return 'Offseason';\n            }\n            if (weekNumber <= 18) {\n                return `Week ${weekNumber}`;\n            }";
if (text.includes(displayOld)) {
    text = text.replace(displayOld, displayNew);
    console.log('Replaced getWeekDisplay empty');
}
fs.writeFileSync(file, text);
console.log('index.html season patches applied');

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
function mustReplace(label, oldStr, newStr) {
    if (!html.includes(oldStr)) { console.error('Could not find: ' + label); process.exit(1); }
    html = html.replace(oldStr, newStr);
    console.log('Replaced ' + label);
}
mustReplace('week indicator from cache', "document.getElementById('weekIndicator').textContent = getWeekDisplay(cachedData.currentWeek);", "document.getElementById('weekIndicator').textContent = cachedData.weekLabel || getWeekDisplay(cachedData.currentWeek);");
mustReplace('getWeekDisplay empty', '        function getWeekDisplay(weekNumber) {\n            // Convert week number to display string with playoff round labels\n            if (weekNumber <= 18) {\n                return `Week ${weekNumber}`;\n            }', '        function getWeekDisplay(weekNumber) {\n            if (weekNumber === 0 || weekNumber == null || weekNumber === \'\') {\n                return \'Offseason\';\n            }\n            if (weekNumber <= 18) {\n                return `Week ${weekNumber}`;\n            }');
mustReplace('accuracy years include next', "            const current = nflSeasonYearFromDate(new Date().toISOString());\n            if (current && !years.includes(current)) years.unshift(current);", "            const current = nflSeasonYearFromDate(new Date().toISOString());\n            [current - 1, current, current + 1].filter(Boolean).forEach((year) => {\n                if (!years.includes(year)) years.push(year);\n            });\n            years.sort((a, b) => b - a);");
fs.writeFileSync(file, html);
console.log('Patched index season labels');

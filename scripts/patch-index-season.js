#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function patch(file, pairs) {
    let text = fs.readFileSync(file, 'utf8');
    for (const [label, oldStr, newStr] of pairs) {
        if (!text.includes(oldStr)) {
            console.error('Could not find: ' + label + ' in ' + file);
            process.exit(1);
        }
        text = text.replace(oldStr, newStr);
        console.log('Replaced ' + label);
    }
    fs.writeFileSync(file, text);
}

patch(path.join(__dirname, '..', 'index.html'), [
    ['week indicator from cache', "document.getElementById('weekIndicator').textContent = getWeekDisplay(cachedData.currentWeek);", "document.getElementById('weekIndicator').textContent = cachedData.weekLabel || getWeekDisplay(cachedData.currentWeek);"],
    ['getWeekDisplay empty', '        function getWeekDisplay(weekNumber) {\n            // Convert week number to display string with playoff round labels\n            if (weekNumber <= 18) {\n                return `Week ${weekNumber}`;\n            }', '        function getWeekDisplay(weekNumber) {\n            if (weekNumber === 0 || weekNumber == null || weekNumber === \'\') {\n                return \'Offseason\';\n            }\n            if (weekNumber <= 18) {\n                return `Week ${weekNumber}`;\n            }'],
    ['accuracy years include next', '            const current = nflSeasonYearFromDate(new Date().toISOString());\n            if (current && !years.includes(current)) years.unshift(current);', '            const current = nflSeasonYearFromDate(new Date().toISOString());\n            [current - 1, current, current + 1].filter(Boolean).forEach((year) => {\n                if (!years.includes(year)) years.push(year);\n            });\n            years.sort((a, b) => b - a);']
]);

const history = path.join(__dirname, '..', 'prediction-history.js');
let hist = fs.readFileSync(history, 'utf8');
const oldH = '        years.add(current);\n        years.add(current - 1);';
const newH = '        years.add(current);\n        years.add(current - 1);\n        years.add(current + 1);';
if (hist.includes(oldH) && !hist.includes('years.add(current + 1)')) {
    hist = hist.replace(oldH, newH);
    fs.writeFileSync(history, hist);
    console.log('Replaced history next season');
} else {
    console.log('History next season already present or pattern missing');
}

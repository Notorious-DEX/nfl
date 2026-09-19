#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');

text = text.replace(/>v\d+\.\d+</, '>v0.12<');

const oldFetch = `                const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
                const data = await response.json();`;
const newFetch = `                const weekNum = (typeof cachedData !== 'undefined' && cachedData && cachedData.currentWeek) || '';
                const seasonYear = (typeof cachedData !== 'undefined' && cachedData && cachedData.seasonYear) || new Date().getFullYear();
                const scoreboardUrl = weekNum
                    ? ('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=' + weekNum + '&seasontype=2&dates=' + seasonYear)
                    : 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
                const response = await fetch(scoreboardUrl);
                const data = await response.json();
                if (data && data.week && data.week.number && document.getElementById('weekIndicator')) {
                    document.getElementById('weekIndicator').textContent = 'Week ' + data.week.number;
                    if (typeof cachedData !== 'undefined' && cachedData) {
                        cachedData.currentWeek = data.week.number;
                        cachedData.weekLabel = 'Week ' + data.week.number;
                    }
                }`;

if (text.includes(oldFetch)) {
    // only replace the one inside populateWeekResults
    const fn = text.indexOf('async function populateWeekResults');
    const at = text.indexOf(oldFetch, fn);
    if (at > 0) text = text.slice(0, at) + newFetch + text.slice(at + oldFetch.length);
    else text = text.replace(oldFetch, newFetch);
}

text = text.replace(
    'weekResultsTitle.textContent = `\ud83d\udcca Week Results: ${correct}-${total - correct} (${percentage}%)`;',
    "weekResultsTitle.textContent = '\ud83d\udcca Week ' + ((typeof cachedData !== 'undefined' && cachedData && cachedData.currentWeek) || '') + ' Results: ' + correct + '-' + (total - correct) + ' (' + percentage + '%)';"
);

const defaultTitle = 'id="weekresults-title">\ud83d\udcca Week Results: 0-0 (0%)</h2>';
if (text.includes(defaultTitle)) {
    text = text.replace(defaultTitle, 'id="weekresults-title">\ud83d\udcca Week Results</h2>');
}

fs.writeFileSync(file, text);
console.log('Week Results uses current week label');

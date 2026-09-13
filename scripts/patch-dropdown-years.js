#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
const oldAlwaysNext = `            const current = nflSeasonYearFromDate(new Date().toISOString());
            [current - 1, current, current + 1].filter(Boolean).forEach((year) => {
                if (!years.includes(year)) years.push(year);
            });`;
const oldCurrentOnly = `            const current = nflSeasonYearFromDate(new Date().toISOString());
            [current - 1, current].filter(Boolean).forEach((year) => {
                if (!years.includes(year)) years.push(year);
            });`;
const next = `            const current = nflSeasonYearFromDate(new Date().toISOString());
            [current - 1, current].filter(Boolean).forEach((year) => {
                if (!years.includes(year)) years.push(year);
            });
            const phase = (typeof cachedData !== 'undefined' && cachedData && cachedData.seasonPhase) || '';
            const upcoming = typeof cachedData !== 'undefined' && cachedData && cachedData.upcomingSeason;
            if ((phase === 'prep' || phase === 'preseason') && upcoming && !years.includes(upcoming)) {
                years.push(upcoming);
            }`;
if (text.includes(oldAlwaysNext)) {
    text = text.replace(oldAlwaysNext, next);
    console.log('Replaced current+1 dropdown seed');
} else if (text.includes(next)) {
    console.log('Dropdown already gated to prep/preseason');
} else if (text.includes(oldCurrentOnly)) {
    text = text.replace(oldCurrentOnly, next);
    console.log('Added prep/preseason upcoming season gate');
} else {
    console.error('Could not find dropdown year seed in index.html');
    process.exit(1);
}
fs.writeFileSync(file, text);

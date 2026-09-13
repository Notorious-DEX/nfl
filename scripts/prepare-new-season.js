#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadCalendar } = require('./season-calendar');

function latestWinTotals() {
    const dataDir = path.join(__dirname, '..', 'data');
    const files = fs.readdirSync(dataDir).filter((name) => /^\d{4}-win-totals\.json$/.test(name)).sort();
    return files.length ? path.join(dataDir, files[files.length - 1]) : null;
}

function main() {
    const calendar = loadCalendar() || {};
    const year = calendar.upcomingSeason || calendar.seasonYear;
    const dest = path.join(__dirname, '..', 'data', 'win-totals.json');
    const yearFile = year ? path.join(__dirname, '..', 'data', year + '-win-totals.json') : null;
    const source = (yearFile && fs.existsSync(yearFile)) ? yearFile : latestWinTotals();
    if (source) {
        const totals = JSON.parse(fs.readFileSync(source, 'utf8'));
        totals.appliedSeason = year || totals.season;
        totals.preparedAt = new Date().toISOString();
        fs.writeFileSync(dest, JSON.stringify(totals, null, 2));
        console.log('Win totals ready from ' + path.basename(source) + ' for season ' + (year || totals.season));
    } else {
        console.log('No win-totals file found; market priors will skip');
    }
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'season-prep.json'), JSON.stringify({
        preparedAt: new Date().toISOString(),
        upcomingSeason: year || null,
        phase: calendar.phase || null,
        kickoff: calendar.kickoff || null
    }, null, 2));
}

main();

#!/usr/bin/env node

const fs = require('fs');
const { updateCalendar } = require('./season-calendar');

function writeOutput(calendar) {
    const force = process.env.FORCE_SEASON_JOBS === '1' || process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
    const active = force || calendar.active;
    const lines = [
        'active=' + (active ? 'true' : 'false'),
        'rebuild=' + (calendar.rebuild ? 'true' : 'false'),
        'freeze=' + (calendar.freeze ? 'true' : 'false'),
        'phase=' + calendar.phase,
        'seasonYear=' + calendar.seasonYear,
        'upcomingSeason=' + calendar.upcomingSeason,
        'weekLabel=' + calendar.weekLabel
    ];
    console.log(lines.join('\n'));
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
    }
}

updateCalendar()
    .then((calendar) => {
        console.log('Season gate: ' + calendar.phase + ' (' + calendar.source + ')');
        if (!calendar.active) console.log('Offseason window — heavy jobs will skip unless manually dispatched.');
        writeOutput(calendar);
    })
    .catch((error) => {
        console.error('Season gate failed open:', error.message);
        writeOutput({ active: true, rebuild: false, freeze: false, phase: 'unknown', seasonYear: '', upcomingSeason: '', weekLabel: '' });
    });

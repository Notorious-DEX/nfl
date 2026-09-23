#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { fetchJson, currentNflSeasonYear } = require('./espn-fetch');

const CACHE_PATH = path.join(__dirname, '..', 'cached-data.json');
const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

function isUpcoming(event) {
    const status = event && event.competitions && event.competitions[0] && event.competitions[0].status;
    const name = status && status.type && status.type.name;
    const state = status && status.type && status.type.state;
    const completed = status && status.type && status.type.completed;
    return !completed && (state === 'pre' || name === 'STATUS_SCHEDULED' || name === 'STATUS_IN_PROGRESS');
}

async function main() {
    if (!fs.existsSync(CACHE_PATH)) process.exit(0);
    const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const year = cached.seasonYear || currentNflSeasonYear();
    let chosenWeek = null;
    let games = [];
    for (let week = 1; week <= 18; week++) {
        try {
            const data = await fetchJson(SCOREBOARD + '?dates=' + year + '&seasontype=2&week=' + week);
            const upcoming = (data.events || []).filter(isUpcoming);
            if (upcoming.length) {
                chosenWeek = week;
                games = upcoming;
                break;
            }
        } catch (error) {
            console.warn('week ' + week + ':', error.message);
        }
    }
    if (games.length) {
        cached.games = games;
        cached.currentWeek = chosenWeek;
        cached.weekLabel = 'Week ' + chosenWeek;
        cached.lastUpdated = new Date().toISOString();
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cached, null, 2));
        console.log('Filled slate with ' + games.length + ' Week ' + chosenWeek + ' games');
    } else {
        console.warn('No upcoming regular-season games found');
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

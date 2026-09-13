#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { fetchJson } = require('./espn-fetch');
const { loadCalendar, weekLabel } = require('./season-calendar');

const CACHE_PATH = path.join(__dirname, '..', 'cached-data.json');
const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

function isPreseason(event) {
    const type = Number((event && event.season && event.season.type) || (event && event.week && event.week.type) || 0);
    const slug = String((event && event.season && event.season.slug) || '').toLowerCase();
    return type === 1 || slug.includes('preseason');
}

async function weekOneGames(seasonYear) {
    try {
        const data = await fetchJson(SCOREBOARD + '?dates=' + seasonYear + '&seasontype=2&week=1');
        return (data.events || []).filter((event) => !isPreseason(event));
    } catch (error) {
        console.warn('Could not load Week 1 slate:', error.message);
        return [];
    }
}

async function main() {
    if (!fs.existsSync(CACHE_PATH)) {
        console.error('cached-data.json missing');
        process.exit(1);
    }
    const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const calendar = loadCalendar() || {};
    const rawGames = Array.isArray(cached.games) ? cached.games : [];
    let games = rawGames.filter((event) => !isPreseason(event));
    if (games.length < rawGames.length) console.log('Removed ' + (rawGames.length - games.length) + ' preseason games from slate');
    const upcoming = calendar.upcomingSeason || calendar.seasonYear;
    if (!games.length && ['prep', 'preseason', 'offseason'].includes(calendar.phase) && upcoming) {
        games = await weekOneGames(upcoming);
        if (games.length) {
            cached.currentWeek = 1;
            console.log('Loaded ' + games.length + ' Week 1 regular-season games for ' + upcoming);
        }
    }
    if (calendar.phase === 'offseason' && !games.length) cached.currentWeek = 0;
    cached.games = games;
    cached.seasonYear = calendar.seasonYear || null;
    cached.upcomingSeason = calendar.upcomingSeason || null;
    cached.seasonPhase = calendar.phase || null;
    cached.weekLabel = calendar.weekLabel || weekLabel(calendar.phase, cached.currentWeek, calendar.espnSeasonType);
    cached.seasonCalendar = { kickoff: calendar.kickoff || null, resumeAt: calendar.resumeAt || null, superBowlEnd: calendar.superBowlEnd || null };
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cached, null, 2));
    console.log('Cache finalized: ' + (cached.weekLabel || 'n/a') + ', ' + games.length + ' games');
}

main().catch((error) => { console.error(error); process.exit(1); });

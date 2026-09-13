#!/usr/bin/env node

/**
 * Pull Las Vegas regular-season win totals for the upcoming NFL year.
 * Intended to run only when jobs wake up before kickoff (prep/preseason),
 * not during the current regular season.
 */

const fs = require('fs');
const path = require('path');
const { fetch } = require('./espn-fetch');
const { loadCalendar } = require('./season-calendar');

const SOURCE_URL = 'https://www.boydsbets.com/nfl-season-win-totals/';
const TEAM_ALIASES = {
    'LA Rams': 'Los Angeles Rams',
    'L.A. Rams': 'Los Angeles Rams',
    'LA Chargers': 'Los Angeles Chargers',
    'L.A. Chargers': 'Los Angeles Chargers',
    'NY Giants': 'New York Giants',
    'NY Jets': 'New York Jets',
    'Washington': 'Washington Commanders',
    'Washington Football Team': 'Washington Commanders'
};

function normalizeTeam(name) {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    return TEAM_ALIASES[clean] || clean;
}

function parseTotals(html) {
    const totals = {};
    const row = /<td class="bbw-wt-team"><b>([^<]+)<\/b><\/td>\s*<td class="bbw-r bbw-wt-total">([0-9.]+)<\/td>/g;
    let match;
    while ((match = row.exec(html))) {
        totals[normalizeTeam(match[1])] = Number(match[2]);
    }
    if (Object.keys(totals).length < 32) {
        const loose = /<b>([A-Za-z .]+)<\/b><\/td>\s*<td[^>]*>\s*([0-9]+\.[05])\s*<\/td>/g;
        while ((match = loose.exec(html))) {
            const team = normalizeTeam(match[1]);
            if (!totals[team]) totals[team] = Number(match[2]);
        }
    }
    return totals;
}

async function fetchTotalsHtml() {
    const response = await fetch(SOURCE_URL, { headers: { Accept: 'text/html' } });
    const html = await response.text();
    if (!html || html.length < 1000) throw new Error('Win-totals page was empty');
    return html;
}

async function main() {
    const calendar = loadCalendar() || {};
    const force = process.argv.includes('--force');
    const allowed = ['prep', 'preseason'].includes(calendar.phase);
    if (!force && !allowed) {
        console.log('Skipping win-total fetch until preseason prep (phase=' + (calendar.phase || 'unknown') + ')');
        return;
    }

    const year = calendar.upcomingSeason || calendar.seasonYear;
    const html = await fetchTotalsHtml();
    const winTotals = parseTotals(html);
    const count = Object.keys(winTotals).length;
    if (count < 28) {
        throw new Error('Parsed only ' + count + ' team win totals');
    }

    const payload = {
        season: year,
        source: 'Boyd\'s Bets consensus (DraftKings / BetMGM / Caesars / BetRivers) ' + new Date().toISOString().slice(0, 10),
        notes: 'Auto-fetched during preseason prep. Used only as an early-season prior.',
        games: 17,
        fetchedAt: new Date().toISOString(),
        winTotals
    };

    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const yearPath = path.join(dataDir, year + '-win-totals.json');
    const genericPath = path.join(dataDir, 'win-totals.json');
    fs.writeFileSync(yearPath, JSON.stringify(payload, null, 2));
    fs.writeFileSync(genericPath, JSON.stringify(payload, null, 2));
    console.log('Saved ' + count + ' win totals for ' + year + ' to data/' + year + '-win-totals.json');
}

main().catch((error) => {
    console.error('Win-total fetch failed, keeping existing file:', error.message);
    process.exit(0);
});

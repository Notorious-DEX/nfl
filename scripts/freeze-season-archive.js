#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadCalendar, currentNflSeasonYear } = require('./season-calendar');

function seasonYearOf(game) {
    if (game.seasonYear) return Number(game.seasonYear);
    const d = new Date(game.date);
    if (Number.isNaN(d.getTime())) return null;
    return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

function main() {
    const calendar = loadCalendar() || {};
    const resultsPath = path.join(__dirname, '..', 'results.json');
    if (!fs.existsSync(resultsPath)) {
        console.log('No results.json to freeze');
        return;
    }
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const games = results.games || [];
    const years = [...new Set(games.map(seasonYearOf).filter(Boolean))].sort();
    const archiveDir = path.join(__dirname, '..', 'data', 'archives');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    const targetYear = calendar.seasonYear || currentNflSeasonYear();
    for (const year of years.filter((y) => y <= targetYear)) {
        const dest = path.join(archiveDir, year + '.json');
        if (fs.existsSync(dest)) {
            console.log('Archive already frozen: ' + year);
            continue;
        }
        const seasonGames = games.filter((g) => seasonYearOf(g) === year);
        const correct = seasonGames.filter((g) => g.correct).length;
        fs.writeFileSync(dest, JSON.stringify({
            frozenAt: new Date().toISOString(),
            seasonYear: year,
            correct,
            total: seasonGames.length,
            accuracy: seasonGames.length ? ((correct / seasonGames.length) * 100).toFixed(1) : '0.0',
            games: seasonGames
        }, null, 2));
        console.log('Froze ' + seasonGames.length + ' games for ' + year);
    }
}

main();

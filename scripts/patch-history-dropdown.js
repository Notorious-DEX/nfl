#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'prediction-history.js');
let text = fs.readFileSync(file, 'utf8');
if (text.includes('upcomingSeasonYear')) {
    console.log('History dropdown already gated');
    process.exit(0);
}
const old = `function availableSeasons() {
    const years = new Set(allGames.map(gameSeason).filter(Boolean));
    const current = currentNflSeason();
    if (current) {
        years.add(current);
        years.add(current - 1);
    }
    return [...years].sort((a, b) => b - a);
}`;
const next = `let upcomingSeasonYear = null;

function availableSeasons() {
    const years = new Set(allGames.map(gameSeason).filter(Boolean));
    const current = currentNflSeason();
    if (current) {
        years.add(current);
        years.add(current - 1);
    }
    if (upcomingSeasonYear) years.add(upcomingSeasonYear);
    return [...years].sort((a, b) => b - a);
}`;
if (!text.includes(old)) {
    console.error('Could not find availableSeasons() in prediction-history.js');
    process.exit(1);
}
text = text.replace(old, next);
const loadOld = `        allGames = data.games || [];
        populateFilters();`;
const loadNew = `        allGames = data.games || [];
        try {
            const cacheRes = await fetch('cached-data.json');
            if (cacheRes.ok) {
                const cache = await cacheRes.json();
                if (cache.seasonPhase === 'prep' || cache.seasonPhase === 'preseason') {
                    upcomingSeasonYear = Number(cache.upcomingSeason || cache.seasonYear || 0) || null;
                } else {
                    upcomingSeasonYear = null;
                }
            }
        } catch (e) {}
        populateFilters();`;
if (!text.includes(loadOld)) {
    console.error('Could not find history load hook');
    process.exit(1);
}
text = text.replace(loadOld, loadNew);
fs.writeFileSync(file, text);
console.log('Patched prediction-history.js dropdown gate');

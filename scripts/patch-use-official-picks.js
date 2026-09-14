#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');

if (!text.includes('function officialPickForGame')) {
    const helper = `
        function officialPickForGame(game) {
            const id = String(game && game.id || '');
            const fromCache = typeof cachedData !== 'undefined' && cachedData && cachedData.officialPicks && cachedData.officialPicks[id];
            if (fromCache && fromCache.winner) {
                return {
                    winner: fromCache.winner,
                    homeScore: fromCache.homeScore,
                    awayScore: fromCache.awayScore,
                    official: true,
                    confidence: fromCache.confidence || 'Medium'
                };
            }
            return null;
        }
`;
    text = text.replace('function generatePrediction', helper + '        function generatePrediction');
}

const oldCall = `                const weather = await fetchWeather(homeTeam, game.date);
                const prediction = generatePrediction(game, gameOdds, weather);`;
const newCall = `                const weather = await fetchWeather(homeTeam, game.date);
                const lockedPick = officialPickForGame(game);
                const prediction = lockedPick || generatePrediction(game, gameOdds, weather);
                if (lockedPick) prediction.calculations = prediction.calculations || ['Official locked pick'];`;
if (text.includes(oldCall)) {
    text = text.replace(oldCall, newCall);
} else if (text.includes('lockedPick || generatePrediction')) {
    console.log('Homepage already uses official picks');
} else {
    console.error('Could not find generatePrediction call site');
    process.exit(1);
}

fs.writeFileSync(file, text);
console.log('Homepage reads official locked picks');

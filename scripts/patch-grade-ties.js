#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const check = path.join(__dirname, 'check-results.js');
let text = fs.readFileSync(check, 'utf8');
text = text.replace(
    'const actualWinner = homeScore > awayScore ? actualHomeTeam : actualAwayTeam;',
    "const actualWinner = homeScore === awayScore ? 'Tie' : (homeScore > awayScore ? actualHomeTeam : actualAwayTeam);"
);
fs.writeFileSync(check, text);

const index = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(index, 'utf8');
html = html.replace(/>v\d+\.\d+</, '>v0.18<');
html = html.replace(
    'const actualWinner = actualHomeScore > actualAwayScore ? homeTeam : awayTeam;',
    "const actualWinner = actualHomeScore === actualAwayScore ? 'Tie' : (actualHomeScore > actualAwayScore ? homeTeam : awayTeam);"
);
html = html.replace(
    'const actualWinner = actualHomeScore > actualAwayScore ? prediction.homeTeam : prediction.awayTeam;',
    "const actualWinner = actualHomeScore === actualAwayScore ? 'Tie' : (actualHomeScore > actualAwayScore ? prediction.homeTeam : prediction.awayTeam);"
);
html = html.replace(
    'const actualWinner = homeScore > awayScore ? homeTeam.team.displayName : awayTeam.team.displayName;',
    "const actualWinner = homeScore === awayScore ? 'Tie' : (homeScore > awayScore ? homeTeam.team.displayName : awayTeam.team.displayName);"
);
fs.writeFileSync(index, html);

const resultsPath = path.join(__dirname, '..', 'results.json');
if (fs.existsSync(resultsPath)) {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    let changed = 0;
    for (const game of results.games || []) {
        if (game.actualHomeScore != null && game.actualAwayScore != null && Number(game.actualHomeScore) === Number(game.actualAwayScore)) {
            game.actualWinner = 'Tie';
            game.correct = false;
            changed++;
        }
    }
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2) + '\n');
    console.log('Updated ' + changed + ' tied results');
}
console.log('Tie grading patched');

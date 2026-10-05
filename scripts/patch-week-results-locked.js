#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
text = text.replace(/>v\d+\.\d+</, '>v0.17<');
const old = `const archived = (typeof allAccuracyGames !== 'undefined' ? allAccuracyGames : []).find((row) =>
                    String(row.gameId) === String(game.id) ||
                    (row.homeTeam === homeTeam && row.awayTeam === awayTeam)
                );
                const savedPrediction = predictions[game.id];
                let prediction = null;
                let predictionFailed = false;

                if (archived && archived.winner) {
                    prediction = { winner: archived.winner };
                } else if (savedPrediction && savedPrediction.prediction && savedPrediction.prediction.winner) {
                    prediction = savedPrediction.prediction;
                } else {
                    predictionFailed = true;
                }`;
const neu = `const locked = typeof officialPickForGame === 'function' ? officialPickForGame(game) : null;
                const archived = (typeof allAccuracyGames !== 'undefined' ? allAccuracyGames : []).find((row) =>
                    String(row.gameId) === String(game.id)
                );
                const savedPrediction = predictions[game.id];
                let prediction = null;
                let predictionFailed = false;

                if (locked && locked.winner) {
                    prediction = locked;
                } else if (archived && archived.winner) {
                    prediction = { winner: archived.winner };
                } else if (savedPrediction && savedPrediction.prediction && savedPrediction.prediction.winner) {
                    prediction = savedPrediction.prediction;
                } else {
                    predictionFailed = true;
                }`;
if (!text.includes(old)) {
    console.error('marker missing');
    process.exit(1);
}
text = text.replace(old, neu);
fs.writeFileSync(file, text);
console.log('Week Results uses locked pick');

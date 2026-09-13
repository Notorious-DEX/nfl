#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
const old = `                // Get our prediction from localStorage or generate one
                const savedPrediction = predictions[game.id];
                let prediction = null;
                let predictionFailed = false;

                if (savedPrediction && savedPrediction.prediction) {
                    prediction = savedPrediction.prediction;
                } else {
                    // Generate prediction for completed games we didn't predict before
                    try {
                        prediction = generatePrediction(game, null, null);
                        if (prediction.error) {
                            predictionFailed = true;
                        }
                    } catch (err) {
                        predictionFailed = true;
                    }
                }`;
const next = `                const archived = (typeof allAccuracyGames !== 'undefined' ? allAccuracyGames : []).find((row) =>
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
if (text.includes(next)) {
    console.log('Week Results already uses stored picks');
} else if (!text.includes(old)) {
    console.error('Could not find Week Results prediction block');
    process.exit(1);
} else {
    text = text.replace(old, next);
    fs.writeFileSync(file, text);
    console.log('Patched Week Results to use stored picks only');
}

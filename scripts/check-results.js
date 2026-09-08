#!/usr/bin/env node

/**
 * Check NFL Prediction Results
 * Appends newly completed games onto results.json.
 * Never deletes or replaces previous seasons.
 */

const fs = require('fs');
const path = require('path');
const { fetch } = require('./espn-fetch');

function nflSeasonYear(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    return month >= 7 ? year : year - 1;
}

function recount(results) {
    const games = results.games || [];
    results.total = games.length;
    results.correct = games.filter((g) => g.correct).length;
    results.accuracy = results.total > 0 ? ((results.correct / results.total) * 100).toFixed(1) : '0.0';
    const weeks = games.map((g) => g.week).filter((w) => w != null);
    if (weeks.length) results.weeks = Math.max(...weeks);
}

async function checkResults() {
    try {
        console.log('\ud83c\udfc8 Checking prediction results...\n');

        const resultsPath = path.join(__dirname, '..', 'results.json');
        const predictionsPath = path.join(__dirname, '..', 'predictions.json');

        if (!fs.existsSync(resultsPath)) {
            console.log('No results.json yet; starting empty archive.');
            fs.writeFileSync(resultsPath, JSON.stringify({
                lastUpdated: new Date().toISOString(),
                version: 'v0.06',
                method: 'index.html-algorithm',
                kFactor: 20,
                weeks: 0,
                correct: 0,
                total: 0,
                accuracy: '0.0',
                games: []
            }, null, 2));
        }

        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        if (!Array.isArray(results.games)) results.games = [];
        const archivedCount = results.games.length;

        if (!fs.existsSync(predictionsPath)) {
            console.log('No predictions file found. Leaving archived results untouched.');
            recount(results);
            results.lastUpdated = new Date().toISOString();
            fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
            return;
        }

        const predictionsData = JSON.parse(fs.readFileSync(predictionsPath, 'utf8'));
        const predictions = predictionsData.predictions || [];

        const now = new Date();
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
        let newChecks = 0;

        for (const prediction of predictions) {
            const gameDate = new Date(prediction.date);
            if (gameDate > fourHoursAgo) continue;
            if (results.games.some((g) => g.gameId === prediction.gameId)) continue;

            try {
                const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${prediction.gameId}`);
                const data = await response.json();

                const weekNumber = data.header?.week || null;
                const gameData = data.header?.competitions?.[0];
                if (!gameData) {
                    console.warn(`  \u26a0\ufe0f  No game data for ${prediction.gameId}`);
                    continue;
                }
                if (!gameData.status?.type?.completed) {
                    console.log(`  \u23f3 Game ${prediction.gameId} not yet completed`);
                    continue;
                }

                const homeComp = gameData.competitors?.find((c) => c.homeAway === 'home');
                const awayComp = gameData.competitors?.find((c) => c.homeAway === 'away');
                if (!homeComp || !awayComp) {
                    console.warn(`  \u26a0\ufe0f  Missing competitor data for ${prediction.gameId}`);
                    continue;
                }

                const homeScore = parseInt(homeComp.score) || 0;
                const awayScore = parseInt(awayComp.score) || 0;
                const actualHomeTeam = homeComp.team?.displayName;
                const actualAwayTeam = awayComp.team?.displayName;
                const actualWinner = homeScore > awayScore ? actualHomeTeam : actualAwayTeam;
                const correct = actualWinner === prediction.winner;
                const scoreDiff = Math.abs(prediction.homeScore - prediction.awayScore);
                let confidence = 'medium';
                if (scoreDiff >= 7) confidence = 'high';
                else if (scoreDiff <= 3) confidence = 'low';

                results.games.push({
                    gameId: prediction.gameId,
                    seasonYear: nflSeasonYear(prediction.date),
                    week: weekNumber,
                    date: prediction.date,
                    homeTeam: prediction.homeTeam,
                    awayTeam: prediction.awayTeam,
                    homeScore: prediction.homeScore,
                    awayScore: prediction.awayScore,
                    winner: prediction.winner,
                    confidence,
                    method: 'index.html-algorithm',
                    actualHomeScore: homeScore,
                    actualAwayScore: awayScore,
                    actualWinner,
                    correct
                });

                newChecks++;
                const symbol = correct ? '\u2705' : '\u274c';
                console.log(`  ${symbol} ${prediction.awayTeam} @ ${prediction.homeTeam} (Week ${weekNumber || '?'})`);
                console.log(`     Predicted: ${prediction.winner} (${prediction.awayScore}-${prediction.homeScore})`);
                console.log(`     Actual: ${actualWinner} (${awayScore}-${homeScore})\n`);
            } catch (error) {
                console.warn(`  \u26a0\ufe0f  Could not check result for ${prediction.gameId}: ${error.message}`);
            }
        }

        if (results.games.length < archivedCount) {
            throw new Error(`Refusing to save: games shrank from ${archivedCount} to ${results.games.length}`);
        }

        recount(results);
        results.lastUpdated = new Date().toISOString();
        results.method = 'index.html-algorithm';
        if (!results.kFactor) results.kFactor = 20;

        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

        console.log('\ud83d\udcca Results Summary:');
        console.log(`   Archived games kept: ${archivedCount}`);
        console.log(`   New checks: ${newChecks}`);
        console.log(`   Correct: ${results.correct}`);
        console.log(`   Total: ${results.total}`);
        console.log(`   Accuracy: ${results.accuracy}%`);
        console.log('\n\u2705 Results saved to results.json');
    } catch (error) {
        console.error('\u274c Error checking results:', error);
        process.exit(1);
    }
}

checkResults();

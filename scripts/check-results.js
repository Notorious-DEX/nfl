#!/usr/bin/env node

/**
 * Check NFL Prediction Results
 * This script checks completed games against predictions and updates accuracy stats
 * Updates results.json with accuracy data
 */

const fs = require('fs');
const path = require('path');
const { fetch } = require('./espn-fetch');

async function checkResults() {
    try {
        console.log('🏈 Checking prediction results...\n');

        // Load predictions
        const predictionsPath = path.join(__dirname, '..', 'predictions.json');
        if (!fs.existsSync(predictionsPath)) {
            console.log('No predictions file found. Creating empty results.');
            const resultsPath = path.join(__dirname, '..', 'results.json');
            fs.writeFileSync(resultsPath, JSON.stringify({
                lastUpdated: new Date().toISOString(),
                correct: 0,
                total: 0,
                accuracy: 0,
                games: []
            }, null, 2));
            return;
        }

        const predictionsData = JSON.parse(fs.readFileSync(predictionsPath, 'utf8'));
        const predictions = predictionsData.predictions || [];

        // Load existing results
        const resultsPath = path.join(__dirname, '..', 'results.json');
        let results = {
            lastUpdated: new Date().toISOString(),
            version: 'v0.06',
            method: 'index.html-algorithm',
            kFactor: 20,
            weeks: 17,
            correct: 0,
            total: 0,
            accuracy: '0.0',
            games: []
        };

        if (fs.existsSync(resultsPath)) {
            results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
            results.version = 'v0.06';
            results.method = 'index.html-algorithm';
            if (!results.kFactor) results.kFactor = 20;
            if (!results.games) results.games = [];
        }

        const now = new Date();
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

        let newChecks = 0;

        for (const prediction of predictions) {
            const gameDate = new Date(prediction.date);
            if (gameDate > fourHoursAgo) {
                continue;
            }

            const alreadyCounted = results.games.some(g => g.gameId === prediction.gameId);
            if (alreadyCounted) {
                continue;
            }

            try {
                const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${prediction.gameId}`);
                const data = await response.json();

                const weekNumber = data.header?.week || null;
                const gameData = data.header?.competitions?.[0];

                if (!gameData) {
                    console.warn(`  ⚠️  No game data for ${prediction.gameId}`);
                    continue;
                }

                if (!gameData.status?.type?.completed) {
                    console.log(`  ⏳ Game ${prediction.gameId} not yet completed`);
                    continue;
                }

                const homeComp = gameData.competitors?.find(c => c.homeAway === 'home');
                const awayComp = gameData.competitors?.find(c => c.homeAway === 'away');

                if (!homeComp || !awayComp) {
                    console.warn(`  ⚠️  Missing competitor data for ${prediction.gameId}`);
                    continue;
                }

                const homeScore = parseInt(homeComp.score) || 0;
                const awayScore = parseInt(awayComp.score) || 0;
                const actualHomeTeam = homeComp.team?.displayName;
                const actualAwayTeam = awayComp.team?.displayName;
                const actualWinner = homeScore > awayScore ? actualHomeTeam : actualAwayTeam;
                const predictedWinner = prediction.winner;
                const correct = actualWinner === predictedWinner;

                results.total++;
                if (correct) {
                    results.correct++;
                }

                const scoreDiff = Math.abs(prediction.homeScore - prediction.awayScore);
                let confidence = 'medium';
                if (scoreDiff >= 7) confidence = 'high';
                else if (scoreDiff <= 3) confidence = 'low';

                results.games.push({
                    gameId: prediction.gameId,
                    week: weekNumber,
                    date: prediction.date,
                    homeTeam: prediction.homeTeam,
                    awayTeam: prediction.awayTeam,
                    homeScore: prediction.homeScore,
                    awayScore: prediction.awayScore,
                    winner: prediction.winner,
                    confidence: confidence,
                    method: 'index.html-algorithm',
                    actualHomeScore: homeScore,
                    actualAwayScore: awayScore,
                    actualWinner: actualWinner,
                    correct: correct
                });

                if (weekNumber && (!results.weeks || weekNumber > results.weeks)) {
                    results.weeks = weekNumber;
                }

                newChecks++;

                const symbol = correct ? '✅' : '❌';
                console.log(`  ${symbol} ${prediction.awayTeam} @ ${prediction.homeTeam} (Week ${weekNumber || '?'})`);
                console.log(`     Predicted: ${predictedWinner} (${prediction.awayScore}-${prediction.homeScore})`);
                console.log(`     Actual: ${actualWinner} (${awayScore}-${homeScore})\n`);
            } catch (error) {
                console.warn(`  ⚠️  Could not check result for game ${prediction.gameId}: ${error.message}`);
            }
        }

        results.accuracy = results.total > 0 ? ((results.correct / results.total) * 100).toFixed(1) : '0.0';
        results.lastUpdated = new Date().toISOString();

        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

        console.log('📊 Results Summary:');
        console.log(`   Correct: ${results.correct}`);
        console.log(`   Total: ${results.total}`);
        console.log(`   Accuracy: ${results.accuracy}%`);
        console.log(`   New checks: ${newChecks}`);
        console.log(`\n✅ Results saved to results.json`);

    } catch (error) {
        console.error('❌ Error checking results:', error);
        process.exit(1);
    }
}

checkResults();

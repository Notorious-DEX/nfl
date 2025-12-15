#!/usr/bin/env node

/**
 * Check NFL Prediction Results
 * This script checks completed games against predictions and updates accuracy stats
 * Updates results.json with accuracy data
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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
            correct: 0,
            total: 0,
            games: []
        };

        if (fs.existsSync(resultsPath)) {
            results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        }

        const now = new Date();
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

        let newChecks = 0;

        for (const prediction of predictions) {
            const gameDate = new Date(prediction.date);

            // Skip future games
            if (gameDate > fourHoursAgo) {
                continue;
            }

            // Check if we've already counted this game
            const alreadyCounted = results.games.some(g => g.gameId === prediction.gameId);
            if (alreadyCounted) {
                continue;
            }

            // Fetch game result
            try {
                const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${prediction.gameId}`);
                const data = await response.json();

                const competition = data.boxscore?.teams;
                if (competition && competition.length === 2) {
                    const homeTeam = competition.find(t => t.homeAway === 'home');
                    const awayTeam = competition.find(t => t.homeAway === 'away');

                    const homeScore = parseInt(homeTeam.statistics.find(s => s.name === 'points')?.displayValue || 0);
                    const awayScore = parseInt(awayTeam.statistics.find(s => s.name === 'points')?.displayValue || 0);

                    // Only count if game is complete with valid scores
                    if (homeScore > 0 || awayScore > 0) {
                        const actualWinner = homeScore > awayScore ? homeTeam.team.displayName : awayTeam.team.displayName;
                        const predictedWinner = prediction.winner;
                        const correct = actualWinner === predictedWinner;

                        results.total++;
                        if (correct) {
                            results.correct++;
                        }

                        results.games.push({
                            gameId: prediction.gameId,
                            date: prediction.date,
                            homeTeam: prediction.homeTeam,
                            awayTeam: prediction.awayTeam,
                            predictedWinner: predictedWinner,
                            predictedHomeScore: prediction.homeScore,
                            predictedAwayScore: prediction.awayScore,
                            actualWinner: actualWinner,
                            actualHomeScore: homeScore,
                            actualAwayScore: awayScore,
                            correct: correct,
                            checkedAt: new Date().toISOString()
                        });

                        newChecks++;

                        const symbol = correct ? '✅' : '❌';
                        console.log(`  ${symbol} ${prediction.awayTeam} @ ${prediction.homeTeam}`);
                        console.log(`     Predicted: ${predictedWinner} (${prediction.awayScore}-${prediction.homeScore})`);
                        console.log(`     Actual: ${actualWinner} (${awayScore}-${homeScore})\n`);
                    }
                }
            } catch (error) {
                console.warn(`  ⚠️  Could not check result for game ${prediction.gameId}`);
            }
        }

        // Calculate accuracy
        results.accuracy = results.total > 0 ? ((results.correct / results.total) * 100).toFixed(1) : 0;
        results.lastUpdated = new Date().toISOString();

        // Save results
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

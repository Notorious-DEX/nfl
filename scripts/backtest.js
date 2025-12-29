#!/usr/bin/env node

/**
 * Backtest NFL Predictions - v0.05
 * Tests prediction model accuracy by:
 * - Uses Elo ratings for all weeks (carried over from prior season with 1/3 regression)
 * - Updates Elo ratings after each week with K=20
 * - Pure Elo approach - no temporary adjustments
 * - Compare predictions to actual results
 * - Save to test-predictions.json and results.json
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const elo = require('./elo');
const { generatePrediction: generatePredictionShared } = require('./prediction-engine');

const TEAM_DATA = {
    "Arizona Cardinals": { lat: 33.5276, lon: -112.2626 },
    "Atlanta Falcons": { lat: 33.7554, lon: -84.4008 },
    "Baltimore Ravens": { lat: 39.2780, lon: -76.6227 },
    "Buffalo Bills": { lat: 42.7738, lon: -78.7870 },
    "Carolina Panthers": { lat: 35.2258, lon: -80.8530 },
    "Chicago Bears": { lat: 41.8623, lon: -87.6167 },
    "Cincinnati Bengals": { lat: 39.0954, lon: -84.5160 },
    "Cleveland Browns": { lat: 41.5061, lon: -81.6995 },
    "Dallas Cowboys": { lat: 32.7473, lon: -97.0945 },
    "Denver Broncos": { lat: 39.7439, lon: -105.0201 },
    "Detroit Lions": { lat: 42.3400, lon: -83.0456 },
    "Green Bay Packers": { lat: 44.5013, lon: -88.0622 },
    "Houston Texans": { lat: 29.6847, lon: -95.4107 },
    "Indianapolis Colts": { lat: 39.7601, lon: -86.1639 },
    "Jacksonville Jaguars": { lat: 30.3240, lon: -81.6373 },
    "Kansas City Chiefs": { lat: 39.0489, lon: -94.4839 },
    "Las Vegas Raiders": { lat: 36.0908, lon: -115.1831 },
    "Los Angeles Chargers": { lat: 33.9535, lon: -118.3390 },
    "Los Angeles Rams": { lat: 33.9535, lon: -118.3390 },
    "Miami Dolphins": { lat: 25.9580, lon: -80.2389 },
    "Minnesota Vikings": { lat: 44.9738, lon: -93.2577 },
    "New England Patriots": { lat: 42.0909, lon: -71.2643 },
    "New Orleans Saints": { lat: 29.9511, lon: -90.0812 },
    "New York Giants": { lat: 40.8128, lon: -74.0742 },
    "New York Jets": { lat: 40.8128, lon: -74.0742 },
    "Philadelphia Eagles": { lat: 39.9008, lon: -75.1675 },
    "Pittsburgh Steelers": { lat: 40.4468, lon: -80.0158 },
    "San Francisco 49ers": { lat: 37.4032, lon: -121.9697 },
    "Seattle Seahawks": { lat: 47.5952, lon: -122.3316 },
    "Tampa Bay Buccaneers": { lat: 27.9759, lon: -82.5033 },
    "Tennessee Titans": { lat: 36.1665, lon: -86.7713 },
    "Washington Commanders": { lat: 38.9076, lon: -76.8645 }
};

let leagueStats = {
    teams: {},
    rankings: {},
    hasData: false
};

let eloRatings = null; // Will be loaded from historical-elo.json
let weeklyEloSnapshots = {}; // Track Elo ratings at the end of each week
let injuries = {}; // Loaded from cached-data.json
let qualityWins = {}; // Loaded from cached-data.json

async function fetchLeagueStats(upToWeek, usePreseason = false) {
    console.log(`📊 Calculating team stats ${usePreseason ? 'from preseason' : `through week ${upToWeek - 1}`}...`);

    const teamStats = {};
    for (const teamName in TEAM_DATA) {
        teamStats[teamName] = {
            pointsScored: 0, pointsAllowed: 0,
            rushYards: 0, rushYardsAllowed: 0,
            passYards: 0, passYardsAllowed: 0,
            thirdDownConversions: 0, thirdDownAttempts: 0,
            redZoneScores: 0, redZoneAttempts: 0,
            sacksAllowed: 0, sacksTaken: 0,
            turnovers: 0, takeaways: 0,
            gamesPlayed: 0
        };
    }

    let totalGames = 0;

    if (usePreseason) {
        // Fetch preseason games (weeks 1-4 of preseason)
        for (let week = 1; week <= 4; week++) {
            try {
                const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=1&week=${week}`);
                const data = await response.json();

                for (const event of data.events || []) {
                    const competition = event.competitions[0];
                    if (competition.status.type.completed) {
                        const homeComp = competition.competitors.find(c => c.homeAway === 'home');
                        const awayComp = competition.competitors.find(c => c.homeAway === 'away');
                        const homeTeam = homeComp.team.displayName;
                        const awayTeam = awayComp.team.displayName;
                        const homeScore = parseInt(homeComp.score) || 0;
                        const awayScore = parseInt(awayComp.score) || 0;

                        if (teamStats[homeTeam]) {
                            teamStats[homeTeam].pointsScored += homeScore;
                            teamStats[homeTeam].pointsAllowed += awayScore;
                            teamStats[homeTeam].gamesPlayed++;
                        }
                        if (teamStats[awayTeam]) {
                            teamStats[awayTeam].pointsScored += awayScore;
                            teamStats[awayTeam].pointsAllowed += homeScore;
                            teamStats[awayTeam].gamesPlayed++;
                        }

                        await processBoxScore(event.id, homeTeam, awayTeam, teamStats);
                        totalGames++;
                    }
                }
            } catch (e) {
                console.warn(`Could not fetch preseason week ${week}`);
            }
        }
    } else {
        // Fetch regular season games up to (but not including) upToWeek
        for (let week = 1; week < upToWeek; week++) {
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2&week=${week}`);
            const data = await response.json();

            for (const event of data.events || []) {
                const competition = event.competitions[0];
                if (competition.status.type.completed) {
                    const homeComp = competition.competitors.find(c => c.homeAway === 'home');
                    const awayComp = competition.competitors.find(c => c.homeAway === 'away');
                    const homeTeam = homeComp.team.displayName;
                    const awayTeam = awayComp.team.displayName;
                    const homeScore = parseInt(homeComp.score) || 0;
                    const awayScore = parseInt(awayComp.score) || 0;

                    if (teamStats[homeTeam]) {
                        teamStats[homeTeam].pointsScored += homeScore;
                        teamStats[homeTeam].pointsAllowed += awayScore;
                        teamStats[homeTeam].gamesPlayed++;
                    }
                    if (teamStats[awayTeam]) {
                        teamStats[awayTeam].pointsScored += awayScore;
                        teamStats[awayTeam].pointsAllowed += homeScore;
                        teamStats[awayTeam].gamesPlayed++;
                    }

                    await processBoxScore(event.id, homeTeam, awayTeam, teamStats);
                    totalGames++;
                }
            }
        }
    }

    // Calculate per-game averages
    for (const teamName in teamStats) {
        const stats = teamStats[teamName];
        if (stats.gamesPlayed > 0) {
            leagueStats.teams[teamName] = {
                offensiveRating: stats.pointsScored / stats.gamesPlayed,
                defensiveRating: stats.pointsAllowed / stats.gamesPlayed,
                rushYPG: stats.rushYards / stats.gamesPlayed,
                rushDefYPG: stats.rushYardsAllowed / stats.gamesPlayed,
                passYPG: stats.passYards / stats.gamesPlayed,
                passDefYPG: stats.passYardsAllowed / stats.gamesPlayed,
                thirdDownPct: stats.thirdDownAttempts > 0 ? (stats.thirdDownConversions / stats.thirdDownAttempts) * 100 : 40,
                redZonePct: stats.redZoneAttempts > 0 ? (stats.redZoneScores / stats.redZoneAttempts) * 100 : 50,
                sacksAllowedPG: stats.sacksAllowed / stats.gamesPlayed,
                sacksTakenPG: stats.sacksTaken / stats.gamesPlayed,
                turnoverDiff: stats.takeaways - stats.turnovers,
                gamesPlayed: stats.gamesPlayed
            };
        }
    }

    calculateRankings();
    leagueStats.hasData = totalGames > 0;
    console.log(`✅ Processed ${totalGames} games`);
}

async function processBoxScore(eventId, homeTeam, awayTeam, teamStats) {
    try {
        const statsUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;
        const statsResponse = await fetch(statsUrl);
        const statsData = await statsResponse.json();

        const boxscore = statsData.boxscore;
        if (boxscore && boxscore.teams) {
            const homeStats = boxscore.teams.find(t => t.homeAway === 'home');
            const awayStats = boxscore.teams.find(t => t.homeAway === 'away');

            const homeYards = { rush: 0, pass: 0 };
            const awayYards = { rush: 0, pass: 0 };

            if (homeStats && homeStats.statistics) {
                parseTeamStats(homeStats.statistics, teamStats[homeTeam], homeYards);
            }
            if (awayStats && awayStats.statistics) {
                parseTeamStats(awayStats.statistics, teamStats[awayTeam], awayYards);
            }

            if (teamStats[homeTeam]) {
                teamStats[homeTeam].rushYardsAllowed += awayYards.rush;
                teamStats[homeTeam].passYardsAllowed += awayYards.pass;
            }
            if (teamStats[awayTeam]) {
                teamStats[awayTeam].rushYardsAllowed += homeYards.rush;
                teamStats[awayTeam].passYardsAllowed += homeYards.pass;
            }
        }
    } catch (e) {
        // Skip if box score unavailable
    }
}

function parseTeamStats(statistics, teamStats, yards) {
    for (const stat of statistics) {
        const name = stat.name.toLowerCase();
        const value = parseFloat(stat.displayValue) || 0;

        if (name === 'rushingyards') {
            teamStats.rushYards += value;
            if (yards) yards.rush = value;
        }
        else if (name === 'passingyards') {
            teamStats.passYards += value;
            if (yards) yards.pass = value;
        }
        else if (name === 'thirddowneff') {
            const parts = stat.displayValue.split('-');
            if (parts.length === 2) {
                teamStats.thirdDownConversions += parseInt(parts[0]) || 0;
                teamStats.thirdDownAttempts += parseInt(parts[1]) || 0;
            }
        }
        else if (name === 'redzoneeff' || name === 'redzonemade-att') {
            const parts = stat.displayValue.split('-');
            if (parts.length === 2) {
                teamStats.redZoneScores += parseInt(parts[0]) || 0;
                teamStats.redZoneAttempts += parseInt(parts[1]) || 0;
            }
        }
        else if (name === 'sacks' || name === 'sacks-yardslost') {
            const parts = stat.displayValue.split('-');
            teamStats.sacksAllowed += parseInt(parts[0]) || 0;
        }
        else if (name === 'interceptions' || name === 'interceptionthrown') {
            teamStats.turnovers += value;
        }
        else if (name === 'fumblelost' || name === 'fumbleslost') {
            teamStats.turnovers += value;
        }
        else if (name === 'defensiveinterceptions') {
            teamStats.takeaways += value;
        }
        else if (name === 'defensivefumblerecoveries' || name === 'fumblerecoveries') {
            teamStats.takeaways += value;
        }
        else if (name === 'defensivesacks' || name === 'totalsacks') {
            teamStats.sacksTaken += value;
        }
    }
}

function calculateRankings() {
    const teams = Object.keys(leagueStats.teams);

    teams.forEach(team => {
        leagueStats.rankings[team] = {
            rushOffRank: 0, passOffRank: 0,
            rushDefRank: 0, passDefRank: 0
        };
    });

    const rushOffRanked = [...teams].sort((a, b) => leagueStats.teams[b].rushYPG - leagueStats.teams[a].rushYPG);
    rushOffRanked.forEach((team, idx) => leagueStats.rankings[team].rushOffRank = idx + 1);

    const passOffRanked = [...teams].sort((a, b) => leagueStats.teams[b].passYPG - leagueStats.teams[a].passYPG);
    passOffRanked.forEach((team, idx) => leagueStats.rankings[team].passOffRank = idx + 1);

    const rushDefRanked = [...teams].sort((a, b) => leagueStats.teams[a].rushDefYPG - leagueStats.teams[b].rushDefYPG);
    rushDefRanked.forEach((team, idx) => leagueStats.rankings[team].rushDefRank = idx + 1);

    const passDefRanked = [...teams].sort((a, b) => leagueStats.teams[a].passDefYPG - leagueStats.teams[b].passDefYPG);
    passDefRanked.forEach((team, idx) => leagueStats.rankings[team].passDefRank = idx + 1);
}

async function fetchWeekGames(week) {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2&week=${week}`);
    const data = await response.json();
    return data.events || [];
}

// Old prediction functions removed - now using shared prediction-engine.js

function loadCachedData() {
    try {
        const cachedDataPath = path.join(__dirname, '..', 'cached-data.json');
        if (fs.existsSync(cachedDataPath)) {
            const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
            injuries = cachedData.injuries || {};
            qualityWins = cachedData.qualityWins || {};
            console.log(`✅ Loaded cached data: ${Object.keys(injuries).length} teams with injuries, ${Object.keys(qualityWins).length} teams with quality wins\n`);
        } else {
            console.warn('⚠️  cached-data.json not found\n');
        }
    } catch (error) {
        console.error('Error loading cached data:', error);
    }
}

async function main() {
    try {
        console.log('🏈 NFL Prediction Backtesting Starting...\n');

        // Load cached data (injuries, quality wins)
        loadCachedData();

        // Load historical Elo ratings for Week 1 predictions
        const eloPath = path.join(__dirname, '..', 'historical-elo.json');
        if (fs.existsSync(eloPath)) {
            const eloData = JSON.parse(fs.readFileSync(eloPath, 'utf8'));
            if (eloData.seasons['2025'] && eloData.seasons['2025'].startOfSeasonRatings) {
                eloRatings = eloData.seasons['2025'].startOfSeasonRatings;
                console.log('✅ Loaded 2025 starting Elo ratings from historical data\n');
            }
        } else {
            console.warn('⚠️  No historical Elo data found, will use preseason for Week 1\n');
        }

        const allPredictions = [];
        const allResults = [];
        let totalCorrect = 0;
        let totalGames = 0;

        // Fetch current week from ESPN API
        console.log('📅 Fetching current NFL week...');
        const currentWeekResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
        const currentWeekData = await currentWeekResponse.json();
        const currentWeek = currentWeekData.week?.number || 18;
        console.log(`✅ Current NFL week: ${currentWeek}\n`);

        for (let week = 1; week <= currentWeek; week++) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📅 WEEK ${week}`);
            console.log('='.repeat(60));

            if (!eloRatings) {
                console.error('❌ No Elo ratings available, cannot continue');
                process.exit(1);
            }

            console.log('📊 Using Elo-based predictions');

            // Fetch this week's games
            const games = await fetchWeekGames(week);
            console.log(`\n🎯 Generating predictions for ${games.length} games...`);

            // Generate predictions
            for (const game of games) {
                const competition = game.competitions[0];
                if (!competition.status.type.completed) continue;

                // Use shared prediction engine (same as index.html)
                const prediction = generatePredictionShared(game, null, leagueStats, injuries, qualityWins, eloRatings);
                if (!prediction) continue;

                // Get actual result
                const homeComp = competition.competitors.find(c => c.homeAway === 'home');
                const awayComp = competition.competitors.find(c => c.homeAway === 'away');
                const actualHomeScore = parseInt(homeComp.score) || 0;
                const actualAwayScore = parseInt(awayComp.score) || 0;
                const actualWinner = actualHomeScore > actualAwayScore ? prediction.homeTeam : prediction.awayTeam;

                const correct = prediction.winner === actualWinner;

                allPredictions.push(prediction);
                allResults.push({
                    ...prediction,
                    week, // Explicitly set week from loop variable
                    actualHomeScore,
                    actualAwayScore,
                    actualWinner,
                    correct
                });

                if (correct) totalCorrect++;
                totalGames++;

                const symbol = correct ? '✅' : '❌';
                console.log(`  ${symbol} ${prediction.awayTeam} @ ${prediction.homeTeam}`);
                console.log(`     Predicted: ${prediction.winner} (${prediction.awayScore}-${prediction.homeScore})`);
                console.log(`     Actual: ${actualWinner} (${actualAwayScore}-${actualHomeScore})`);
            }

            const weekAccuracy = allResults.filter(r => r.week === week).filter(r => r.correct).length;
            const weekTotal = allResults.filter(r => r.week === week).length;
            const weekPct = weekTotal > 0 ? ((weekAccuracy / weekTotal) * 100).toFixed(1) : 0;
            console.log(`\n📊 Week ${week} Accuracy: ${weekAccuracy}/${weekTotal} (${weekPct}%)`);
            console.log(`📊 Season So Far: ${totalCorrect}/${totalGames} (${((totalCorrect / totalGames) * 100).toFixed(1)}%)`);

            // Update Elo ratings based on this week's actual results
            const kFactor = 20;
            console.log(`🔄 Updating Elo ratings with K=${kFactor}...`);

            for (const game of games) {
                const competition = game.competitions[0];
                if (!competition.status.type.completed) continue;

                const homeComp = competition.competitors.find(c => c.homeAway === 'home');
                const awayComp = competition.competitors.find(c => c.homeAway === 'away');
                const homeTeam = homeComp.team.displayName;
                const awayTeam = awayComp.team.displayName;
                const homeScore = parseInt(homeComp.score) || 0;
                const awayScore = parseInt(awayComp.score) || 0;

                if (!eloRatings[homeTeam] || !eloRatings[awayTeam]) continue;

                const homeElo = eloRatings[homeTeam];
                const awayElo = eloRatings[awayTeam];

                if (homeScore > awayScore) {
                    // Home team won
                    const updated = elo.updateElo(homeElo, awayElo, homeScore - awayScore, true, kFactor);
                    eloRatings[homeTeam] = updated.winnerElo;
                    eloRatings[awayTeam] = updated.loserElo;
                } else if (awayScore > homeScore) {
                    // Away team won
                    const updated = elo.updateElo(awayElo, homeElo, awayScore - homeScore, false, kFactor);
                    eloRatings[awayTeam] = updated.winnerElo;
                    eloRatings[homeTeam] = updated.loserElo;
                }
                // Ties don't update Elo
            }

            // Save snapshot of Elo ratings at end of this week
            weeklyEloSnapshots[`week${week}`] = { ...eloRatings };
        }

        // Save results
        const predictionsPath = path.join(__dirname, '..', 'test-predictions.json');
        fs.writeFileSync(predictionsPath, JSON.stringify({
            generated: new Date().toISOString(),
            version: 'v0.05',
            method: 'elo-pure',
            kFactor: 20,
            weeks: currentWeek,
            predictions: allPredictions
        }, null, 2));

        // Save weekly Elo snapshots for trend visualization
        const eloSnapshotsPath = path.join(__dirname, '..', 'weekly-elo.json');
        fs.writeFileSync(eloSnapshotsPath, JSON.stringify({
            lastUpdated: new Date().toISOString(),
            season: '2025',
            weeks: currentWeek,
            snapshots: weeklyEloSnapshots
        }, null, 2));

        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 FINAL RESULTS');
        console.log('='.repeat(60));
        console.log(`Total Games: ${totalGames}`);
        console.log(`Correct Predictions: ${totalCorrect}`);
        console.log(`Accuracy: ${((totalCorrect / totalGames) * 100).toFixed(1)}%`);
        console.log(`\n✅ Results saved to:`);
        console.log(`   - test-predictions.json`);
        console.log(`   - weekly-elo.json (${Object.keys(weeklyEloSnapshots).length} weeks)`);

    } catch (error) {
        console.error('❌ Error during backtesting:', error);
        process.exit(1);
    }
}

main();

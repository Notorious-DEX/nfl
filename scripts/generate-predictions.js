#!/usr/bin/env node

/**
 * Generate NFL Predictions
 * This script fetches NFL data and generates predictions for upcoming games
 * Saves predictions to predictions.json
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Team data with logos and coordinates
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

async function fetchLeagueStats() {
    console.log('📊 Calculating comprehensive team statistics...');

    try {
        const teamStats = {};
        for (const teamName in TEAM_DATA) {
            teamStats[teamName] = {
                pointsScored: 0,
                pointsAllowed: 0,
                rushYards: 0,
                rushYardsAllowed: 0,
                passYards: 0,
                passYardsAllowed: 0,
                thirdDownConversions: 0,
                thirdDownAttempts: 0,
                redZoneScores: 0,
                redZoneAttempts: 0,
                sacksAllowed: 0,
                sacksTaken: 0,
                turnovers: 0,
                takeaways: 0,
                gamesPlayed: 0
            };
        }

        // Fetch current week from ESPN API
        const currentWeekResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
        const currentWeekData = await currentWeekResponse.json();
        const currentWeek = currentWeekData.week?.number || 18;
        console.log(`📅 Current NFL week: ${currentWeek}`);

        let totalGames = 0;

        for (let week = 1; week <= currentWeek; week++) {
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

                    try {
                        const statsUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${event.id}`;
                        const statsResponse = await fetch(statsUrl);
                        const statsData = await statsResponse.json();

                        const boxscore = statsData.boxscore;
                        if (boxscore && boxscore.teams) {
                            const homeStats = boxscore.teams.find(t => t.homeAway === 'home');
                            const awayStats = boxscore.teams.find(t => t.homeAway === 'away');

                            // Temporary objects to store yards before assigning to defense
                            const homeYards = { rush: 0, pass: 0 };
                            const awayYards = { rush: 0, pass: 0 };

                            if (homeStats && homeStats.statistics) {
                                parseTeamStats(homeStats.statistics, teamStats[homeTeam], homeYards);
                            }
                            if (awayStats && awayStats.statistics) {
                                parseTeamStats(awayStats.statistics, teamStats[awayTeam], awayYards);
                            }

                            // Assign defensive stats (opponent's yards = yards allowed)
                            if (teamStats[homeTeam]) {
                                teamStats[homeTeam].rushYardsAllowed += awayYards.rush;
                                teamStats[homeTeam].passYardsAllowed += awayYards.pass;
                            }
                            if (teamStats[awayTeam]) {
                                teamStats[awayTeam].rushYardsAllowed += homeYards.rush;
                                teamStats[awayTeam].passYardsAllowed += homeYards.pass;
                            }
                        }
                    } catch (statErr) {
                        console.warn(`Could not fetch stats for game ${event.id}`);
                    }

                    totalGames++;
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

        console.log(`✅ Processed ${totalGames} completed games`);
    } catch (error) {
        console.error('Failed to calculate team stats:', error);
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
            rushOffRank: 0,
            passOffRank: 0,
            rushDefRank: 0,
            passDefRank: 0
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

async function fetchGames() {
    console.log('📥 Fetching upcoming games...');

    const games = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    const data = await response.json();

    for (const event of data.events || []) {
        const gameDate = new Date(event.date);
        if (gameDate > now && gameDate < sevenDaysFromNow) {
            games.push(event);
        }
    }

    console.log(`✅ Found ${games.length} upcoming games`);
    return games;
}

function generatePrediction(game) {
    const competition = game.competitions[0];
    const homeComp = competition.competitors.find(c => c.homeAway === 'home');
    const awayComp = competition.competitors.find(c => c.homeAway === 'away');

    const homeTeam = homeComp.team.displayName;
    const awayTeam = awayComp.team.displayName;

    // Check if we have real data for both teams
    const homeStats = leagueStats.teams[homeTeam];
    const awayStats = leagueStats.teams[awayTeam];
    const homeRankings = leagueStats.rankings[homeTeam];
    const awayRankings = leagueStats.rankings[awayTeam];

    // If missing data, skip prediction instead of using fake fallbacks
    if (!homeStats || !awayStats || !homeRankings || !awayRankings) {
        const missingTeams = [];
        if (!homeStats) missingTeams.push(homeTeam);
        if (!awayStats) missingTeams.push(awayTeam);

        console.warn(`⚠️  Skipping prediction for ${awayTeam} @ ${homeTeam} - Missing data for: ${missingTeams.join(', ')}`);
        return null;  // Return null to indicate no prediction
    }

    // Efficiency rating formula
    const baseAwayScore = (awayStats.offensiveRating + homeStats.defensiveRating) / 2;
    const baseHomeScore = (homeStats.offensiveRating + awayStats.defensiveRating) / 2;

    let ourHomeScore = baseHomeScore + 2.5; // Home field advantage
    let ourAwayScore = baseAwayScore;

    // Rush/pass matchup analysis
    if (leagueStats.hasData && homeRankings.rushOffRank && awayRankings.rushDefRank) {
        const gap = awayRankings.rushDefRank - homeRankings.rushOffRank;
        if (Math.abs(gap) > 5) {
            ourHomeScore += gap * 0.15;
        }
    }

    if (leagueStats.hasData && homeRankings.passOffRank && awayRankings.passDefRank) {
        const gap = awayRankings.passDefRank - homeRankings.passOffRank;
        if (Math.abs(gap) > 5) {
            ourHomeScore += gap * 0.15;
        }
    }

    if (leagueStats.hasData && awayRankings.rushOffRank && homeRankings.rushDefRank) {
        const gap = homeRankings.rushDefRank - awayRankings.rushOffRank;
        if (Math.abs(gap) > 5) {
            ourAwayScore += gap * 0.15;
        }
    }

    if (leagueStats.hasData && awayRankings.passOffRank && homeRankings.passDefRank) {
        const gap = homeRankings.passDefRank - awayRankings.passOffRank;
        if (Math.abs(gap) > 5) {
            ourAwayScore += gap * 0.15;
        }
    }

    // Third down efficiency
    if (homeStats.thirdDownPct > 45) ourHomeScore += 1.5;
    else if (homeStats.thirdDownPct < 35) ourHomeScore -= 1.5;

    if (awayStats.thirdDownPct > 45) ourAwayScore += 1.5;
    else if (awayStats.thirdDownPct < 35) ourAwayScore -= 1.5;

    // Red zone efficiency
    if (homeStats.redZonePct > 60) ourHomeScore += 1.5;
    else if (homeStats.redZonePct < 45) ourHomeScore -= 1.5;

    if (awayStats.redZonePct > 60) ourAwayScore += 1.5;
    else if (awayStats.redZonePct < 45) ourAwayScore -= 1.5;

    // Finalize prediction
    const homeScore = Math.max(10, Math.round(ourHomeScore));
    const awayScore = Math.max(10, Math.round(ourAwayScore));

    return {
        gameId: game.id,
        date: game.date,
        homeTeam,
        awayTeam,
        homeScore: homeScore === awayScore ? homeScore + 1 : homeScore,
        awayScore,
        winner: (homeScore === awayScore ? homeScore + 1 : homeScore) > awayScore ? homeTeam : awayTeam
    };
}

async function main() {
    try {
        console.log('🏈 NFL Predictions Generator Starting...\n');

        // Fetch league stats
        await fetchLeagueStats();

        // Load existing predictions to preserve unchecked ones
        let existingPredictions = [];
        const predictionsPath = path.join(__dirname, '..', 'predictions.json');
        if (fs.existsSync(predictionsPath)) {
            try {
                const existingData = JSON.parse(fs.readFileSync(predictionsPath, 'utf8'));
                existingPredictions = existingData.predictions || [];
                console.log(`📋 Loaded ${existingPredictions.length} existing predictions`);
            } catch (error) {
                console.warn('⚠️  Could not load existing predictions:', error.message);
            }
        }

        // Load results to see what's been checked
        let checkedGameIds = new Set();
        const resultsPath = path.join(__dirname, '..', 'results.json');
        if (fs.existsSync(resultsPath)) {
            try {
                const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
                const games = resultsData.games || [];
                games.forEach(game => checkedGameIds.add(game.gameId));
                console.log(`✅ Loaded ${checkedGameIds.size} checked results`);
            } catch (error) {
                console.warn('⚠️  Could not load results:', error.message);
            }
        }

        // Fetch upcoming games
        const games = await fetchGames();

        if (games.length === 0) {
            console.log('No upcoming games found.');

            // Preserve unchecked predictions even if no new games
            const uncheckedPredictions = existingPredictions.filter(pred => {
                return !checkedGameIds.has(pred.gameId);
            });

            if (uncheckedPredictions.length > 0) {
                console.log(`📌 Preserving ${uncheckedPredictions.length} unchecked predictions`);
            } else {
                console.log('No unchecked predictions to preserve.');
            }

            // Save predictions file (either unchecked or empty)
            fs.writeFileSync(predictionsPath, JSON.stringify({
                generated: new Date().toISOString(),
                predictions: uncheckedPredictions
            }, null, 2));

            return;
        }

        // Generate predictions for upcoming games
        console.log('\n🎯 Generating predictions for upcoming games...');
        const newPredictions = [];

        for (const game of games) {
            const prediction = generatePrediction(game);
            if (prediction) {  // Only add valid predictions (skip nulls)
                newPredictions.push(prediction);
                console.log(`  ✓ ${prediction.awayTeam} @ ${prediction.homeTeam}: ${prediction.winner} (${prediction.awayScore}-${prediction.homeScore})`);
            }
        }

        // Preserve unchecked predictions from existing file
        const uncheckedPredictions = existingPredictions.filter(pred => {
            return !checkedGameIds.has(pred.gameId);
        });

        if (uncheckedPredictions.length > 0) {
            console.log(`\n📌 Preserving ${uncheckedPredictions.length} unchecked predictions from previous run`);
            uncheckedPredictions.forEach(pred => {
                console.log(`  → ${pred.awayTeam} @ ${pred.homeTeam} (${pred.gameId})`);
            });
        }

        // Combine unchecked old predictions with new predictions
        const allPredictions = [...uncheckedPredictions, ...newPredictions];

        // Save predictions to file
        const output = {
            generated: new Date().toISOString(),
            predictions: allPredictions
        };

        fs.writeFileSync(predictionsPath, JSON.stringify(output, null, 2));
        console.log(`\n✅ Saved ${allPredictions.length} predictions to predictions.json (${uncheckedPredictions.length} preserved + ${newPredictions.length} new)`);

    } catch (error) {
        console.error('❌ Error generating predictions:', error);
        process.exit(1);
    }
}

main();

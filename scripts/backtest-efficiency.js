#!/usr/bin/env node

/**
 * Backtest Efficiency Rating Model
 * Tests the efficiency rating prediction model (used in index.html) against historical data
 * Compares to Elo-based predictions in backtest.js
 *
 * Assumptions:
 * - No injury data (assume all players healthy)
 * - No weather data (no historical weather available)
 * - Quality wins bonus applied starting Week 12
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

let qualityWins = {};

// Fetch week games
async function fetchWeekGames(week) {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2&week=${week}`);
    const data = await response.json();
    return data.events || [];
}

// Process boxscore to get detailed stats
async function processBoxScore(eventId, homeTeam, awayTeam, teamStats) {
    try {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`);
        const data = await response.json();

        const boxscore = data.boxscore;
        if (boxscore && boxscore.teams) {
            const homeStats = boxscore.teams.find(t => t.homeAway === 'home');
            const awayStats = boxscore.teams.find(t => t.homeAway === 'away');

            const homeYards = { rush: 0, pass: 0 };
            const awayYards = { rush: 0, pass: 0 };

            if (homeStats && homeStats.statistics) {
                parseBoxscoreStats(homeStats.statistics, teamStats[homeTeam], homeYards);
            }
            if (awayStats && awayStats.statistics) {
                parseBoxscoreStats(awayStats.statistics, teamStats[awayTeam], awayYards);
            }

            // Update defensive stats
            if (teamStats[homeTeam]) {
                teamStats[homeTeam].rushYardsAllowed += awayYards.rush;
                teamStats[homeTeam].passYardsAllowed += awayYards.pass;
            }
            if (teamStats[awayTeam]) {
                teamStats[awayTeam].rushYardsAllowed += homeYards.rush;
                teamStats[awayTeam].passYardsAllowed += homeYards.pass;
            }
        }
    } catch (error) {
        // Silently fail on boxscore errors
    }
}

function parseBoxscoreStats(statistics, teamStats, yards) {
    for (const stat of statistics) {
        const name = stat.name.toLowerCase();
        const value = parseFloat(stat.displayValue) || 0;

        if (name === 'rushingyards') {
            teamStats.rushYards += value;
            if (yards) yards.rush = value;
        }
        else if (name === 'passingyards' || name === 'netpassingyards') {
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
    }
}

// Calculate stats up to a specific week
async function calculateStatsUpToWeek(upToWeek) {
    const teamStats = {};
    for (const teamName in TEAM_DATA) {
        teamStats[teamName] = {
            pointsScored: 0, pointsAllowed: 0,
            rushYards: 0, rushYardsAllowed: 0,
            passYards: 0, passYardsAllowed: 0,
            thirdDownConversions: 0, thirdDownAttempts: 0,
            turnovers: 0, takeaways: 0,
            gamesPlayed: 0
        };
    }

    // Process all weeks before upToWeek
    for (let week = 1; week < upToWeek; week++) {
        const games = await fetchWeekGames(week);

        for (const event of games) {
            const competition = event.competitions[0];
            if (!competition.status.type.completed) continue;

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
        }
    }

    return calculateRatingsAndRankings(teamStats);
}

// Calculate offensive/defensive ratings and rankings
function calculateRatingsAndRankings(teamStats) {
    const teams = {};
    const rankings = {};

    for (const teamName in teamStats) {
        const stats = teamStats[teamName];
        const games = stats.gamesPlayed || 1;

        teams[teamName] = {
            offensiveRating: stats.pointsScored / games,
            defensiveRating: stats.pointsAllowed / games,
            rushYardsPerGame: stats.rushYards / games,
            passYardsPerGame: stats.passYards / games,
            rushYardsAllowedPerGame: stats.rushYardsAllowed / games,
            passYardsAllowedPerGame: stats.passYardsAllowed / games,
            thirdDownPct: stats.thirdDownAttempts > 0 ? stats.thirdDownConversions / stats.thirdDownAttempts : 0,
            turnoverDiff: stats.takeaways - stats.turnovers,
            gamesPlayed: games
        };
    }

    // Calculate rankings
    const teamsArray = Object.entries(teams);

    // Rush offense rankings (higher yards = better = lower rank number)
    const rushOffRanked = teamsArray.sort((a, b) => b[1].rushYardsPerGame - a[1].rushYardsPerGame);
    rushOffRanked.forEach((team, i) => {
        if (!rankings[team[0]]) rankings[team[0]] = {};
        rankings[team[0]].rushOffRank = i + 1;
    });

    // Pass offense rankings
    const passOffRanked = teamsArray.sort((a, b) => b[1].passYardsPerGame - a[1].passYardsPerGame);
    passOffRanked.forEach((team, i) => {
        rankings[team[0]].passOffRank = i + 1;
    });

    // Rush defense rankings (lower yards allowed = better = lower rank number)
    const rushDefRanked = teamsArray.sort((a, b) => a[1].rushYardsAllowedPerGame - b[1].rushYardsAllowedPerGame);
    rushDefRanked.forEach((team, i) => {
        rankings[team[0]].rushDefRank = i + 1;
    });

    // Pass defense rankings
    const passDefRanked = teamsArray.sort((a, b) => a[1].passYardsAllowedPerGame - b[1].passYardsAllowedPerGame);
    passDefRanked.forEach((team, i) => {
        rankings[team[0]].passDefRank = i + 1;
    });

    return { teams, rankings, hasData: true };
}

// Calculate quality wins up to a specific week
function calculateQualityWinsUpToWeek(allResults, upToWeek) {
    const teamRecords = {};
    const vsWinningTeams = {};

    // Initialize
    for (const teamName in TEAM_DATA) {
        teamRecords[teamName] = { wins: 0, losses: 0 };
        vsWinningTeams[teamName] = { wins: 0, losses: 0 };
    }

    // Process games chronologically up to upToWeek
    const gamesUpToNow = allResults.filter(g => g.week < upToWeek);

    for (const game of gamesUpToNow) {
        const homeTeam = game.homeTeam;
        const awayTeam = game.awayTeam;
        const homeRecord = teamRecords[homeTeam];
        const awayRecord = teamRecords[awayTeam];

        const homeWinPct = homeRecord.wins + homeRecord.losses === 0 ? 0 : homeRecord.wins / (homeRecord.wins + homeRecord.losses);
        const awayWinPct = awayRecord.wins + awayRecord.losses === 0 ? 0 : awayRecord.wins / (awayRecord.wins + awayRecord.losses);

        const homeWon = game.actualHomeScore > game.actualAwayScore;

        // Check if opponent had .500 or better
        if (awayWinPct >= 0.500) {
            if (homeWon) vsWinningTeams[homeTeam].wins++;
            else vsWinningTeams[homeTeam].losses++;
        }

        if (homeWinPct >= 0.500) {
            if (!homeWon) vsWinningTeams[awayTeam].wins++;
            else vsWinningTeams[awayTeam].losses++;
        }

        // Update records
        if (homeWon) {
            teamRecords[homeTeam].wins++;
            teamRecords[awayTeam].losses++;
        } else {
            teamRecords[awayTeam].wins++;
            teamRecords[homeTeam].losses++;
        }
    }

    // Convert to output format
    const qw = {};
    for (const team in vsWinningTeams) {
        const record = vsWinningTeams[team];
        const total = record.wins + record.losses;
        qw[team] = {
            wins: record.wins,
            losses: record.losses,
            total: total,
            winPct: total === 0 ? 0 : record.wins / total,
            differential: record.wins - record.losses
        };
    }

    return qw;
}

// Generate prediction using efficiency rating formula (from index.html)
function generatePrediction(game, week, allResults) {
    const competition = game.competitions[0];
    const homeComp = competition.competitors.find(c => c.homeAway === 'home');
    const awayComp = competition.competitors.find(c => c.homeAway === 'away');

    const homeTeam = homeComp.team.displayName;
    const awayTeam = awayComp.team.displayName;

    const homeStats = leagueStats.teams[homeTeam];
    const awayStats = leagueStats.teams[awayTeam];
    const homeRankings = leagueStats.rankings[homeTeam];
    const awayRankings = leagueStats.rankings[awayTeam];

    if (!homeStats || !awayStats || !homeRankings || !awayRankings) {
        return null; // Missing data
    }

    // Base efficiency rating formula
    const baseAwayScore = (awayStats.offensiveRating + homeStats.defensiveRating) / 2;
    const baseHomeScore = (homeStats.offensiveRating + awayStats.defensiveRating) / 2;

    let ourHomeScore = baseHomeScore;
    let ourAwayScore = baseAwayScore;

    // Home field advantage
    const homeFieldAdv = 2.5;
    ourHomeScore += homeFieldAdv;

    // Rush/pass matchup analysis (no weather, so no weather weights)
    const rushWeight = 1.0;
    const passWeight = 1.0;

    // Home rush offense vs away rush defense
    if (leagueStats.hasData && homeRankings.rushOffRank && awayRankings.rushDefRank) {
        const gap = awayRankings.rushDefRank - homeRankings.rushOffRank;
        const advantage = gap * 0.15 * rushWeight;
        if (Math.abs(gap) > 5) {
            ourHomeScore += advantage;
        }
    }

    // Home pass offense vs away pass defense
    if (leagueStats.hasData && homeRankings.passOffRank && awayRankings.passDefRank) {
        const gap = awayRankings.passDefRank - homeRankings.passOffRank;
        const advantage = gap * 0.15 * passWeight;
        if (Math.abs(gap) > 5) {
            ourHomeScore += advantage;
        }
    }

    // Away rush offense vs home rush defense
    if (leagueStats.hasData && awayRankings.rushOffRank && homeRankings.rushDefRank) {
        const gap = homeRankings.rushDefRank - awayRankings.rushOffRank;
        const advantage = gap * 0.15 * rushWeight;
        if (Math.abs(gap) > 5) {
            ourAwayScore += advantage;
        }
    }

    // Away pass offense vs home pass defense
    if (leagueStats.hasData && awayRankings.passOffRank && homeRankings.passDefRank) {
        const gap = homeRankings.passDefRank - awayRankings.passOffRank;
        const advantage = gap * 0.15 * passWeight;
        if (Math.abs(gap) > 5) {
            ourAwayScore += advantage;
        }
    }

    // Third down efficiency
    if (homeStats.thirdDownPct > 0.45) {
        ourHomeScore += 0.5;
    } else if (homeStats.thirdDownPct < 0.35) {
        ourHomeScore -= 0.5;
    }

    if (awayStats.thirdDownPct > 0.45) {
        ourAwayScore += 0.5;
    } else if (awayStats.thirdDownPct < 0.35) {
        ourAwayScore -= 0.5;
    }

    // Turnover differential
    if (homeStats.turnoverDiff > 8) {
        ourHomeScore += 0.5;
    } else if (homeStats.turnoverDiff < -8) {
        ourHomeScore -= 0.5;
    }

    if (awayStats.turnoverDiff > 8) {
        ourAwayScore += 0.5;
    } else if (awayStats.turnoverDiff < -8) {
        ourAwayScore -= 0.5;
    }

    // Quality wins bonus (Week 12+)
    if (week >= 12 && qualityWins[homeTeam] && qualityWins[awayTeam]) {
        const homeQW = qualityWins[homeTeam];
        const awayQW = qualityWins[awayTeam];

        const minGames = 5;
        if (homeQW.total >= minGames && awayQW.total >= minGames) {
            const diffAdvantage = homeQW.differential - awayQW.differential;

            const allDiffs = Object.values(qualityWins).map(qw => qw.differential);
            const maxDiff = Math.max(...allDiffs);
            const minDiff = Math.min(...allDiffs);
            const diffRange = maxDiff - minDiff;

            if (diffRange > 0 && Math.abs(diffAdvantage) > 0) {
                const maxBonus = 3;
                const bonus = (diffAdvantage / diffRange) * maxBonus;
                ourHomeScore += bonus;
            }
        }
    }

    // Finalize prediction
    const homeScore = Math.max(10, Math.round(ourHomeScore));
    const awayScore = Math.max(10, Math.round(ourAwayScore));

    const finalHomeScore = homeScore === awayScore ? homeScore + 1 : homeScore;
    const winner = finalHomeScore > awayScore ? homeTeam : awayTeam;

    return {
        homeTeam,
        awayTeam,
        homeScore: finalHomeScore,
        awayScore,
        winner,
        method: 'efficiency'
    };
}

async function main() {
    try {
        console.log('🏈 NFL Efficiency Rating Backtest Starting...\n');

        // Get current week
        const currentWeekResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
        const currentWeekData = await currentWeekResponse.json();
        const currentWeek = currentWeekData.week?.number || 18;
        console.log(`📅 Current NFL week: ${currentWeek}\n`);

        const allPredictions = [];
        const allResults = [];
        let totalCorrect = 0;
        let totalGames = 0;

        for (let week = 1; week <= currentWeek; week++) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📅 WEEK ${week}`);
            console.log('='.repeat(60));

            // Calculate stats up to this week
            leagueStats = await calculateStatsUpToWeek(week);
            console.log(`📊 Using efficiency-based predictions`);

            // Calculate quality wins up to this week
            qualityWins = calculateQualityWinsUpToWeek(allResults, week);

            // Fetch this week's games
            const games = await fetchWeekGames(week);
            console.log(`\n🎯 Generating predictions for ${games.length} games...`);

            // Generate predictions
            for (const game of games) {
                const competition = game.competitions[0];
                if (!competition.status.type.completed) continue;

                const homeComp = competition.competitors.find(c => c.homeAway === 'home');
                const awayComp = competition.competitors.find(c => c.homeAway === 'away');
                const homeTeam = homeComp.team.displayName;
                const awayTeam = awayComp.team.displayName;
                const actualHomeScore = parseInt(homeComp.score) || 0;
                const actualAwayScore = parseInt(awayComp.score) || 0;
                const actualWinner = actualHomeScore > actualAwayScore ? homeTeam : awayTeam;

                const prediction = generatePrediction(game, week, allResults);

                if (prediction) {
                    const correct = prediction.winner === actualWinner;

                    if (correct) totalCorrect++;
                    totalGames++;

                    const symbol = correct ? '✅' : '❌';
                    console.log(`  ${symbol} ${prediction.awayTeam} @ ${prediction.homeTeam}`);
                    console.log(`     Predicted: ${prediction.winner} (${prediction.awayScore}-${prediction.homeScore})`);
                    console.log(`     Actual: ${actualWinner} (${actualAwayScore}-${actualHomeScore})`);

                    allPredictions.push(prediction);
                    allResults.push({
                        gameId: game.id,
                        week: week,
                        date: game.date,
                        homeTeam: prediction.homeTeam,
                        awayTeam: prediction.awayTeam,
                        homeScore: prediction.homeScore,
                        awayScore: prediction.awayScore,
                        winner: prediction.winner,
                        confidence: 'medium',
                        method: 'efficiency',
                        actualHomeScore,
                        actualAwayScore,
                        actualWinner,
                        correct
                    });
                }
            }

            const weekAccuracy = totalGames > 0 ? ((totalCorrect / totalGames) * 100).toFixed(1) : '0.0';
            console.log(`\n📊 Running accuracy: ${totalCorrect}/${totalGames} (${weekAccuracy}%)`);
        }

        // Save results
        const resultsPath = path.join(__dirname, '..', 'efficiency-results.json');
        const output = {
            lastUpdated: new Date().toISOString(),
            method: 'efficiency',
            weeks: currentWeek,
            correct: totalCorrect,
            total: totalGames,
            accuracy: ((totalCorrect / totalGames) * 100).toFixed(1),
            games: allResults
        };

        fs.writeFileSync(resultsPath, JSON.stringify(output, null, 2));

        console.log('\n' + '='.repeat(60));
        console.log('📊 FINAL RESULTS');
        console.log('='.repeat(60));
        console.log(`Method: Efficiency Rating`);
        console.log(`Weeks Tested: ${currentWeek}`);
        console.log(`Correct Predictions: ${totalCorrect}`);
        console.log(`Total Games: ${totalGames}`);
        console.log(`Accuracy: ${output.accuracy}%`);
        console.log(`\n✅ Results saved to efficiency-results.json`);
        console.log(`\nCompare to Elo results in results.json`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();

#!/usr/bin/env node

/**
 * Build Historical Elo Ratings Database
 *
 * Processes 2022-2024 NFL seasons to build Elo ratings with:
 * - Game-by-game updates
 * - Season-start regression to mean (1/3)
 * - End-of-season ratings stored for carryover
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const elo = require('./elo');

const TEAM_NAMES = [
    "Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills",
    "Carolina Panthers", "Chicago Bears", "Cincinnati Bengals", "Cleveland Browns",
    "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers",
    "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs",
    "Las Vegas Raiders", "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins",
    "Minnesota Vikings", "New England Patriots", "New Orleans Saints", "New York Giants",
    "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers", "San Francisco 49ers",
    "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders"
];

/**
 * Fetch all games for a season
 */
async function fetchSeasonGames(year) {
    console.log(`  📥 Fetching ${year} season data...`);

    const allGames = [];
    const totalWeeks = 18; // Regular season weeks

    for (let week = 1; week <= totalWeeks; week++) {
        try {
            const response = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=2&week=${week}`
            );
            const data = await response.json();

            for (const event of data.events || []) {
                const competition = event.competitions[0];
                if (competition.status.type.completed) {
                    const homeComp = competition.competitors.find(c => c.homeAway === 'home');
                    const awayComp = competition.competitors.find(c => c.homeAway === 'away');

                    allGames.push({
                        week,
                        homeTeam: homeComp.team.displayName,
                        awayTeam: awayComp.team.displayName,
                        homeScore: parseInt(homeComp.score) || 0,
                        awayScore: parseInt(awayComp.score) || 0
                    });
                }
            }
        } catch (error) {
            console.warn(`    ⚠️  Week ${week}: ${error.message}`);
        }
    }

    console.log(`  ✅ Fetched ${allGames.length} completed games`);
    return allGames;
}

/**
 * Process a season's games and update Elo ratings
 */
function processSeasonGames(games, currentRatings) {
    const ratings = { ...currentRatings };
    let gamesProcessed = 0;

    for (const game of games) {
        const { homeTeam, awayTeam, homeScore, awayScore } = game;

        if (!ratings[homeTeam] || !ratings[awayTeam]) {
            continue; // Skip if team not in our list
        }

        const homeElo = ratings[homeTeam];
        const awayElo = ratings[awayTeam];

        if (homeScore > awayScore) {
            // Home team won
            const updated = elo.updateElo(
                homeElo,
                awayElo,
                homeScore - awayScore,
                true
            );
            ratings[homeTeam] = updated.winnerElo;
            ratings[awayTeam] = updated.loserElo;
        } else if (awayScore > homeScore) {
            // Away team won
            const updated = elo.updateElo(
                awayElo,
                homeElo,
                awayScore - homeScore,
                false
            );
            ratings[awayTeam] = updated.winnerElo;
            ratings[homeTeam] = updated.loserElo;
        }
        // Ties are rare and ignored for Elo updates

        gamesProcessed++;
    }

    console.log(`  ✅ Processed ${gamesProcessed} games`);
    return ratings;
}

/**
 * Main function to build historical Elo database
 */
async function main() {
    console.log('🏈 Building Historical Elo Ratings Database');
    console.log('Processing 2022-2024 NFL Seasons\n');

    const history = {
        metadata: {
            generated: new Date().toISOString(),
            initialElo: elo.INITIAL_ELO,
            kFactor: elo.K_FACTOR,
            homeAdvantage: elo.HOME_ADVANTAGE,
            regressionFactor: 1/3
        },
        seasons: {}
    };

    // Initialize 2022 with all teams at 1500
    console.log('${'='.repeat(60)}');
    console.log('2022 SEASON');
    console.log('='.repeat(60));
    console.log('  🔧 Initializing all teams to Elo 1500');

    let currentRatings = elo.initializeRatings(TEAM_NAMES);

    // Process 2022 season
    const games2022 = await fetchSeasonGames(2022);
    currentRatings = processSeasonGames(games2022, currentRatings);

    // Store end-of-2022 ratings
    history.seasons['2022'] = {
        endOfSeasonRatings: { ...currentRatings },
        gamesPlayed: games2022.length
    };

    console.log('  📊 End-of-season ratings (top 5):');
    const sorted2022 = Object.entries(currentRatings).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sorted2022.forEach(([team, rating]) => console.log(`     ${team}: ${rating}`));

    // Process 2023 season
    console.log('\n${'='.repeat(60)}');
    console.log('2023 SEASON');
    console.log('='.repeat(60));
    console.log('  🔄 Applying 1/3 regression to mean...');

    // Regress all ratings
    for (const team in currentRatings) {
        currentRatings[team] = elo.regressToMean(currentRatings[team]);
    }

    console.log('  📊 Post-regression ratings (top 5):');
    const sortedRegress = Object.entries(currentRatings).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sortedRegress.forEach(([team, rating]) => console.log(`     ${team}: ${rating}`));

    const games2023 = await fetchSeasonGames(2023);
    currentRatings = processSeasonGames(games2023, currentRatings);

    history.seasons['2023'] = {
        endOfSeasonRatings: { ...currentRatings },
        gamesPlayed: games2023.length
    };

    console.log('  📊 End-of-season ratings (top 5):');
    const sorted2023 = Object.entries(currentRatings).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sorted2023.forEach(([team, rating]) => console.log(`     ${team}: ${rating}`));

    // Process 2024 season
    console.log('\n${'='.repeat(60)}');
    console.log('2024 SEASON');
    console.log('='.repeat(60));
    console.log('  🔄 Applying 1/3 regression to mean...');

    for (const team in currentRatings) {
        currentRatings[team] = elo.regressToMean(currentRatings[team]);
    }

    console.log('  📊 Post-regression ratings (top 5):');
    const sortedRegress2024 = Object.entries(currentRatings).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sortedRegress2024.forEach(([team, rating]) => console.log(`     ${team}: ${rating}`));

    const games2024 = await fetchSeasonGames(2024);
    currentRatings = processSeasonGames(games2024, currentRatings);

    history.seasons['2024'] = {
        endOfSeasonRatings: { ...currentRatings },
        gamesPlayed: games2024.length
    };

    console.log('  📊 End-of-season ratings (top 5):');
    const sorted2024 = Object.entries(currentRatings).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sorted2024.forEach(([team, rating]) => console.log(`     ${team}: ${rating}`));

    // Prepare 2025 starting ratings (with regression)
    console.log('\n${'='.repeat(60)}');
    console.log('2025 STARTING RATINGS');
    console.log('='.repeat(60));
    console.log('  🔄 Applying 1/3 regression to mean for 2025...');

    const ratings2025 = {};
    for (const team in currentRatings) {
        ratings2025[team] = elo.regressToMean(currentRatings[team]);
    }

    history.seasons['2025'] = {
        startOfSeasonRatings: ratings2025
    };

    console.log('  📊 2025 Week 1 starting ratings (top 5):');
    const sorted2025 = Object.entries(ratings2025).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sorted2025.forEach(([team, rating]) => console.log(`     ${team}: ${rating}`));

    // Save to file
    const outputPath = path.join(__dirname, '..', 'historical-elo.json');
    fs.writeFileSync(outputPath, JSON.stringify(history, null, 2));

    console.log('\n${'='.repeat(60)}');
    console.log('✅ Historical Elo database built successfully');
    console.log(`   Saved to: historical-elo.json`);
    console.log(`   Total games processed: ${games2022.length + games2023.length + games2024.length}`);
    console.log('='.repeat(60));
}

main().catch(error => {
    console.error('❌ Error building Elo database:', error);
    process.exit(1);
});

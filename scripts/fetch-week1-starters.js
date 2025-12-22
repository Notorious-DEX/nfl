#!/usr/bin/env node

/**
 * Fetch Week 1 Actual Starters from ESPN API
 * Gets actual starting lineups from Week 1 2025 games
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const TEAM_NAMES = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC",
    "Los Angeles Rams": "LAR", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
    "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
    "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
    "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA", "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN", "Washington Commanders": "WSH"
};

async function fetchWeek1Starters() {
    try {
        console.log('🏈 Fetching Week 1 2025 games from ESPN...\n');

        // Fetch Week 1 scoreboard
        const response = await fetch(
            'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2&week=1&limit=100'
        );
        const data = await response.json();

        console.log(`✅ Found ${data.events.length} games in Week 1 2025\n`);

        const baselineStarters = {};
        for (const teamName in TEAM_NAMES) {
            baselineStarters[teamName] = {
                QB1: null,
                RB1: null,
                WR1: null
            };
        }

        // Process each game to extract starters
        for (const event of data.events) {
            console.log(`\n📊 Processing: ${event.name}`);

            // Fetch detailed game summary with rosters
            const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${event.id}`;
            const summaryResponse = await fetch(summaryUrl);
            const summary = await summaryResponse.json();

            if (summary.boxscore && summary.boxscore.players) {
                // Process each team's players
                for (const teamData of summary.boxscore.players) {
                    const teamName = teamData.team.displayName;

                    if (!baselineStarters[teamName]) continue;

                    // Look through player stats to find QB/RB/WR who actually played
                    for (const positionGroup of teamData.statistics) {
                        const position = positionGroup.name; // "passing", "rushing", "receiving"

                        if (positionGroup.athletes && positionGroup.athletes.length > 0) {
                            const topPlayer = positionGroup.athletes[0]; // First player listed is usually starter
                            const playerName = topPlayer.athlete.displayName;
                            const playerPos = topPlayer.athlete.position?.abbreviation;

                            // Assign starters based on position
                            if (position === 'passing' && playerPos === 'QB' && !baselineStarters[teamName].QB1) {
                                baselineStarters[teamName].QB1 = playerName;
                                console.log(`   ${teamName} QB1: ${playerName}`);
                            } else if (position === 'rushing' && playerPos === 'RB' && !baselineStarters[teamName].RB1) {
                                baselineStarters[teamName].RB1 = playerName;
                                console.log(`   ${teamName} RB1: ${playerName}`);
                            } else if (position === 'receiving' && playerPos === 'WR' && !baselineStarters[teamName].WR1) {
                                baselineStarters[teamName].WR1 = playerName;
                                console.log(`   ${teamName} WR1: ${playerName}`);
                            }
                        }
                    }
                }
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Save baseline
        const output = {
            created: new Date().toISOString(),
            source: 'ESPN API Week 1 2025 actual game data',
            season: 2025,
            week: 1,
            starters: baselineStarters
        };

        const outputPath = path.join(__dirname, '..', 'baseline-starters.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

        // Display summary
        console.log('\n\n📊 Baseline Starters Summary:\n');
        let qbCount = 0, rbCount = 0, wrCount = 0;

        for (const [team, starters] of Object.entries(baselineStarters)) {
            if (starters.QB1) qbCount++;
            if (starters.RB1) rbCount++;
            if (starters.WR1) wrCount++;

            console.log(`${team}:`);
            console.log(`  QB1: ${starters.QB1 || 'NOT FOUND'}`);
            console.log(`  RB1: ${starters.RB1 || 'NOT FOUND'}`);
            console.log(`  WR1: ${starters.WR1 || 'NOT FOUND'}`);
        }

        console.log(`\n✅ Baseline starters saved to baseline-starters.json`);
        console.log(`   QB1s found: ${qbCount}/32`);
        console.log(`   RB1s found: ${rbCount}/32`);
        console.log(`   WR1s found: ${wrCount}/32`);

    } catch (error) {
        console.error('❌ Error fetching Week 1 starters:', error);
        process.exit(1);
    }
}

fetchWeek1Starters();

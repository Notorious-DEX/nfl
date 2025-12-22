#!/usr/bin/env node

/**
 * Build Baseline Starters from Week 1 Depth Charts
 * Fetches Sleeper API depth charts and creates baseline-starters.json
 * This establishes the "expected healthy starters" for QB1, RB1, WR1
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const TEAM_ABBREVS = {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts", "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs", "LAR": "Los Angeles Rams", "LAC": "Los Angeles Chargers",
    "LV": "Las Vegas Raiders", "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings",
    "NE": "New England Patriots", "NO": "New Orleans Saints", "NYG": "New York Giants",
    "NYJ": "New York Jets", "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers",
    "SF": "San Francisco 49ers", "SEA": "Seattle Seahawks", "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans", "WSH": "Washington Commanders"
};

async function buildBaselineStarters() {
    try {
        console.log('🏈 Building baseline starters from Sleeper API...\n');

        // Fetch all NFL players from Sleeper
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');
        if (!response.ok) {
            throw new Error('Failed to fetch Sleeper API data');
        }

        const players = await response.json();
        console.log(`✅ Fetched ${Object.keys(players).length} players from Sleeper API`);

        // Build baseline starters
        const baselineStarters = {};

        for (const [abbrev, teamName] of Object.entries(TEAM_ABBREVS)) {
            baselineStarters[teamName] = {
                QB1: null,
                RB1: null,
                WR1: null
            };
        }

        // Process all players to find depth chart position 1 for QB, RB, WR
        for (const playerId in players) {
            const player = players[playerId];

            // Only process active players with teams and depth chart data
            if (!player.team || !player.depth_chart_position || player.status === 'Retired') continue;

            const teamName = TEAM_ABBREVS[player.team];
            if (!teamName) continue;

            const position = player.position;
            const depthPosition = player.depth_chart_position;

            // Only care about starters (position 1)
            if (depthPosition !== 1) continue;

            const playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim();

            if (position === 'QB' && !baselineStarters[teamName].QB1) {
                baselineStarters[teamName].QB1 = playerName;
            } else if (position === 'RB' && !baselineStarters[teamName].RB1) {
                baselineStarters[teamName].RB1 = playerName;
            } else if (position === 'WR' && !baselineStarters[teamName].WR1) {
                baselineStarters[teamName].WR1 = playerName;
            }
        }

        // Save to file
        const output = {
            created: new Date().toISOString(),
            source: 'Sleeper API',
            season: 2025,
            week: 'Preseason/Week 1 baseline',
            starters: baselineStarters
        };

        const outputPath = path.join(__dirname, '..', 'baseline-starters.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

        // Display summary
        console.log('\n📊 Baseline Starters Summary:\n');
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
        console.error('❌ Error building baseline starters:', error);
        process.exit(1);
    }
}

buildBaselineStarters();

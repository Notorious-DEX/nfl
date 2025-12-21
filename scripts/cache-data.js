#!/usr/bin/env node

/**
 * Cache Data Script
 * Pre-fetches all heavy data (ESPN stats, odds, games, etc.) and saves to cached-data.json
 * This makes index.html load in 1-2 seconds instead of 90 seconds
 *
 * Run by GitHub Actions on schedule:
 * - Daily at 9am ET (injury reports)
 * - 4 hours before games
 * - 1 hour before games
 * - 15 minutes before games
 */

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const TEAM_DATA = {
    "Arizona Cardinals": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/ari.png", color: "#97233F", lat: 33.5276, lon: -112.2626 },
    "Atlanta Falcons": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/atl.png", color: "#A71930", lat: 33.7554, lon: -84.4008 },
    "Baltimore Ravens": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png", color: "#241773", lat: 39.2780, lon: -76.6227 },
    "Buffalo Bills": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png", color: "#00338D", lat: 42.7738, lon: -78.7870 },
    "Carolina Panthers": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/car.png", color: "#0085CA", lat: 35.2258, lon: -80.8530 },
    "Chicago Bears": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/chi.png", color: "#0B162A", lat: 41.8623, lon: -87.6167 },
    "Cincinnati Bengals": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/cin.png", color: "#FB4F14", lat: 39.0954, lon: -84.5160 },
    "Cleveland Browns": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/cle.png", color: "#311D00", lat: 41.5061, lon: -81.6995 },
    "Dallas Cowboys": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png", color: "#003594", lat: 32.7473, lon: -97.0945 },
    "Denver Broncos": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/den.png", color: "#FB4F14", lat: 39.7439, lon: -105.0201 },
    "Detroit Lions": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/det.png", color: "#0076B6", lat: 42.3400, lon: -83.0456 },
    "Green Bay Packers": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/gb.png", color: "#203731", lat: 44.5013, lon: -88.0622 },
    "Houston Texans": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/hou.png", color: "#03202F", lat: 29.6847, lon: -95.4107 },
    "Indianapolis Colts": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/ind.png", color: "#002C5F", lat: 39.7601, lon: -86.1639 },
    "Jacksonville Jaguars": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/jax.png", color: "#006778", lat: 30.3240, lon: -81.6373 },
    "Kansas City Chiefs": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png", color: "#E31837", lat: 39.0489, lon: -94.4839 },
    "Las Vegas Raiders": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/lv.png", color: "#000000", lat: 36.0908, lon: -115.1831 },
    "Los Angeles Chargers": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/lac.png", color: "#0080C6", lat: 33.9535, lon: -118.3390 },
    "Los Angeles Rams": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png", color: "#003594", lat: 33.9535, lon: -118.3390 },
    "Miami Dolphins": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/mia.png", color: "#008E97", lat: 25.9580, lon: -80.2389 },
    "Minnesota Vikings": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/min.png", color: "#4F2683", lat: 44.9738, lon: -93.2577 },
    "New England Patriots": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/ne.png", color: "#002244", lat: 42.0909, lon: -71.2643 },
    "New Orleans Saints": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/no.png", color: "#D3BC8D", lat: 29.9511, lon: -90.0812 },
    "New York Giants": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png", color: "#0B2265", lat: 40.8128, lon: -74.0742 },
    "New York Jets": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png", color: "#125740", lat: 40.8128, lon: -74.0742 },
    "Philadelphia Eagles": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png", color: "#004C54", lat: 39.9008, lon: -75.1675 },
    "Pittsburgh Steelers": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/pit.png", color: "#FFB612", lat: 40.4468, lon: -80.0158 },
    "San Francisco 49ers": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png", color: "#AA0000", lat: 37.4032, lon: -121.9697 },
    "Seattle Seahawks": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png", color: "#002244", lat: 47.5952, lon: -122.3316 },
    "Tampa Bay Buccaneers": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/tb.png", color: "#D50A0A", lat: 27.9759, lon: -82.5033 },
    "Tennessee Titans": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/ten.png", color: "#0C2340", lat: 36.1665, lon: -86.7713 },
    "Washington Commanders": { logo: "https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png", color: "#5A1414", lat: 38.9076, lon: -76.8645 }
};

async function fetchGames() {
    console.log('📅 Fetching current week games...');
    try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
        const data = await response.json();

        const games = [];
        const now = new Date();
        const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

        for (const event of data.events || []) {
            const competition = event.competitions[0];
            const status = competition.status;
            const gameDate = new Date(event.date);

            // Include if: not started, in progress, or completed less than 1 hour ago
            if (status.type.name === 'STATUS_SCHEDULED' ||
                status.type.name === 'STATUS_IN_PROGRESS' ||
                (status.type.completed && gameDate >= fiveHoursAgo)) {

                if (status.type.completed) {
                    const estimatedEnd = new Date(gameDate.getTime() + 3.5 * 60 * 60 * 1000);
                    if (now - estimatedEnd > 60 * 60 * 1000) {
                        continue;
                    }
                }
                games.push(event);
            }
        }

        let currentWeek = data.week?.number || null;

        // If no games found in current week, try next week
        if (games.length === 0 && currentWeek && currentWeek < 18) {
            console.log(`⏭️  No upcoming games in week ${currentWeek}, checking week ${currentWeek + 1}...`);
            try {
                const nextWeekResponse = await fetch(
                    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2&week=${currentWeek + 1}`
                );
                const nextWeekData = await nextWeekResponse.json();

                for (const event of nextWeekData.events || []) {
                    const competition = event.competitions[0];
                    const status = competition.status;

                    // Only include upcoming games from next week
                    if (status.type.name === 'STATUS_SCHEDULED') {
                        games.push(event);
                    }
                }

                if (games.length > 0) {
                    currentWeek = currentWeek + 1;
                    console.log(`✅ Found ${games.length} games for week ${currentWeek} (next week)`);
                }
            } catch (error) {
                console.log(`⚠️  Could not fetch next week: ${error.message}`);
            }
        }

        console.log(`✅ Found ${games.length} games for week ${currentWeek}`);
        return { games, currentWeek };
    } catch (error) {
        console.error('❌ Error fetching games:', error.message);
        return { games: [], currentWeek: null };
    }
}

async function fetchLeagueStats() {
    console.log('📊 Fetching league stats for all teams...');

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
            gamesPlayed: 0,
            wins: 0, losses: 0, ties: 0
        };
    }

    try {
        // Fetch all weeks of current season for game results
        // NFL season year is the year the season started (2025 for 2025-2026 season)
        const seasonYear = 2025;
        for (let week = 1; week <= 18; week++) {
            try {
                const response = await fetch(
                    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${seasonYear}&seasontype=2&week=${week}&limit=100`,
                    { timeout: 10000 }
                );
                const data = await response.json();

                for (const event of data.events || []) {
                    const competition = event.competitions[0];
                    if (!competition.status.type.completed) continue;

                    const homeComp = competition.competitors.find(c => c.homeAway === 'home');
                    const awayComp = competition.competitors.find(c => c.homeAway === 'away');

                    if (!homeComp || !awayComp) continue;

                    const homeTeam = homeComp.team.displayName;
                    const awayTeam = awayComp.team.displayName;
                    const homeScore = parseInt(homeComp.score) || 0;
                    const awayScore = parseInt(awayComp.score) || 0;

                    if (!teamStats[homeTeam] || !teamStats[awayTeam]) continue;

                    // Update game counts and records
                    teamStats[homeTeam].gamesPlayed++;
                    teamStats[awayTeam].gamesPlayed++;

                    if (homeScore > awayScore) {
                        teamStats[homeTeam].wins++;
                        teamStats[awayTeam].losses++;
                    } else if (awayScore > homeScore) {
                        teamStats[awayTeam].wins++;
                        teamStats[homeTeam].losses++;
                    } else {
                        teamStats[homeTeam].ties++;
                        teamStats[awayTeam].ties++;
                    }

                    // Update scoring stats
                    teamStats[homeTeam].pointsScored += homeScore;
                    teamStats[homeTeam].pointsAllowed += awayScore;
                    teamStats[awayTeam].pointsScored += awayScore;
                    teamStats[awayTeam].pointsAllowed += homeScore;

                    // Extract detailed stats if available
                    if (homeComp.statistics && awayComp.statistics) {
                        updateTeamStats(teamStats[homeTeam], homeComp.statistics, true);
                        updateTeamStats(teamStats[awayTeam], awayComp.statistics, false);
                    }
                }
            } catch (error) {
                // Continue if a week fails
                continue;
            }
        }

        // Log summary of extracted stats
        let teamsWithRushYards = 0;
        let teamsWithPassYards = 0;
        for (const teamName in teamStats) {
            if (teamStats[teamName].rushYards > 0) teamsWithRushYards++;
            if (teamStats[teamName].passYards > 0) teamsWithPassYards++;
        }
        console.log(`📊 Teams with rushing yards: ${teamsWithRushYards}/32`);
        console.log(`📊 Teams with passing yards: ${teamsWithPassYards}/32`);

        // If we didn't get statistics from scoreboard, we cannot calculate rankings
        if (teamsWithRushYards === 0 || teamsWithPassYards === 0) {
            console.error('❌ No rushing/passing statistics found in scoreboard data');
            console.log('⚠️  Cannot generate predictions without real statistics');
            return { teams: {}, rankings: {}, hasData: false };
        }

        // Calculate per-game averages
        const leagueStats = { teams: {}, rankings: {}, hasData: true };

        for (const [teamName, stats] of Object.entries(teamStats)) {
            const games = stats.gamesPlayed || 1;
            leagueStats.teams[teamName] = {
                // Ratings (used by prediction algorithm)
                offensiveRating: stats.pointsScored / games,
                defensiveRating: stats.pointsAllowed / games,

                // Rushing stats (as numbers for calculations)
                rushYPG: stats.rushYards / games,
                rushDefYPG: stats.rushYardsAllowed / games,

                // Passing stats (as numbers for calculations)
                passYPG: stats.passYards / games,
                passDefYPG: stats.passYardsAllowed / games,

                // Situational stats (as numbers for calculations)
                thirdDownPct: stats.thirdDownAttempts > 0 ?
                    (stats.thirdDownConversions / stats.thirdDownAttempts) * 100 : 40,
                redZonePct: stats.redZoneAttempts > 0 ?
                    (stats.redZoneScores / stats.redZoneAttempts) * 100 : 50,

                // Sack averages (as numbers)
                sacksAllowedPG: stats.sacksAllowed / games,
                sacksTakenPG: stats.sacksTaken / games,

                // Turnover differential
                turnoverDiff: stats.takeaways - stats.turnovers,

                // Raw totals
                gamesPlayed: stats.gamesPlayed,
                wins: stats.wins,
                losses: stats.losses,
                ties: stats.ties,
                pointsScored: stats.pointsScored,
                pointsAllowed: stats.pointsAllowed,

                // Display strings (for convenience)
                ppg: (stats.pointsScored / games).toFixed(1),
                papg: (stats.pointsAllowed / games).toFixed(1),
                record: `${stats.wins}-${stats.losses}${stats.ties > 0 ? `-${stats.ties}` : ''}`
            };
        }

        // Calculate rankings for each team
        const teams = Object.keys(leagueStats.teams);

        // Initialize rankings object
        teams.forEach(team => {
            leagueStats.rankings[team] = {
                rushOffRank: 0,
                passOffRank: 0,
                rushDefRank: 0,
                passDefRank: 0
            };
        });

        // Rush offense (higher yards = better rank)
        const rushOffRanked = [...teams].sort((a, b) =>
            leagueStats.teams[b].rushYPG - leagueStats.teams[a].rushYPG
        );
        rushOffRanked.forEach((team, idx) => leagueStats.rankings[team].rushOffRank = idx + 1);

        // Pass offense (higher yards = better rank)
        const passOffRanked = [...teams].sort((a, b) =>
            leagueStats.teams[b].passYPG - leagueStats.teams[a].passYPG
        );
        passOffRanked.forEach((team, idx) => leagueStats.rankings[team].passOffRank = idx + 1);

        // Rush defense (lower yards allowed = better rank)
        const rushDefRanked = [...teams].sort((a, b) =>
            leagueStats.teams[a].rushDefYPG - leagueStats.teams[b].rushDefYPG
        );
        rushDefRanked.forEach((team, idx) => leagueStats.rankings[team].rushDefRank = idx + 1);

        // Pass defense (lower yards allowed = better rank)
        const passDefRanked = [...teams].sort((a, b) =>
            leagueStats.teams[a].passDefYPG - leagueStats.teams[b].passDefYPG
        );
        passDefRanked.forEach((team, idx) => leagueStats.rankings[team].passDefRank = idx + 1);

        console.log(`✅ Loaded stats for ${Object.keys(leagueStats.teams).length} teams`);
        console.log(`✅ Calculated rankings for ${Object.keys(leagueStats.rankings).length} teams`);
        return leagueStats;
    } catch (error) {
        console.error('❌ Error fetching league stats:', error.message);
        return { teams: {}, rankings: {}, hasData: false };
    }
}

function updateTeamStats(teamStats, statistics, isHome) {
    for (const stat of statistics) {
        const value = parseFloat(stat.displayValue) || 0;

        switch(stat.name) {
            case 'rushingYards':
                if (isHome) teamStats.rushYards += value;
                else teamStats.rushYardsAllowed += value;
                break;
            case 'passingYards':
                if (isHome) teamStats.passYards += value;
                else teamStats.passYardsAllowed += value;
                break;
            case 'thirdDownEff':
                const parts = stat.displayValue.split('-');
                if (parts.length === 2) {
                    teamStats.thirdDownConversions += parseInt(parts[0]) || 0;
                    teamStats.thirdDownAttempts += parseInt(parts[1]) || 0;
                }
                break;
            case 'redZoneEff':
                const rzParts = stat.displayValue.split('-');
                if (rzParts.length === 2) {
                    teamStats.redZoneScores += parseInt(rzParts[0]) || 0;
                    teamStats.redZoneAttempts += parseInt(rzParts[1]) || 0;
                }
                break;
            case 'sacks':
                if (isHome) teamStats.sacksAllowed += value;
                else teamStats.sacksTaken += value;
                break;
            case 'turnovers':
                teamStats.turnovers += value;
                break;
        }
    }
}

async function fetchInjuries(games) {
    console.log('🏥 Fetching injury reports from Sleeper API...');
    const injuries = {};

    try {
        // Sleeper API provides free NFL injury data
        const response = await fetch('https://api.sleeper.app/v1/players/nfl');

        if (!response.ok) {
            console.log('⚠️  Could not fetch from Sleeper API');
            return {};
        }

        const players = await response.json();

        // Group injuries by team
        for (const playerId in players) {
            const player = players[playerId];

            // Check if player has injury status (not Healthy and has a team)
            if (player.injury_status && player.injury_status !== 'Healthy' && player.team) {
                // Map team abbreviations to full names
                const teamName = getTeamNameFromAbbrev(player.team);
                if (!teamName) continue;

                if (!injuries[teamName]) {
                    injuries[teamName] = [];
                }

                injuries[teamName].push({
                    longComment: player.injury_notes || player.injury_body_part || player.injury_status,
                    status: player.injury_status,
                    athlete: {
                        displayName: `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown',
                        position: player.position || ''
                    }
                });
            }
        }

        const totalInjuries = Object.values(injuries).reduce((sum, team) => sum + team.length, 0);
        console.log(`✅ Loaded injuries for ${Object.keys(injuries).length} teams (${totalInjuries} total injuries)`);
        return injuries;
    } catch (error) {
        console.error('❌ Error fetching injuries:', error.message);
        return {};
    }
}

function getTeamNameFromAbbrev(abbrev) {
    const abbrevToName = {
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
        "TEN": "Tennessee Titans", "WAS": "Washington Commanders"
    };
    return abbrevToName[abbrev] || null;
}

function getTeamAbbreviation(teamName) {
    const abbrevMap = {
        "Arizona Cardinals": "ari", "Atlanta Falcons": "atl", "Baltimore Ravens": "bal",
        "Buffalo Bills": "buf", "Carolina Panthers": "car", "Chicago Bears": "chi",
        "Cincinnati Bengals": "cin", "Cleveland Browns": "cle", "Dallas Cowboys": "dal",
        "Denver Broncos": "den", "Detroit Lions": "det", "Green Bay Packers": "gb",
        "Houston Texans": "hou", "Indianapolis Colts": "ind", "Jacksonville Jaguars": "jax",
        "Kansas City Chiefs": "kc", "Las Vegas Raiders": "lv", "Los Angeles Chargers": "lac",
        "Los Angeles Rams": "lar", "Miami Dolphins": "mia", "Minnesota Vikings": "min",
        "New England Patriots": "ne", "New Orleans Saints": "no", "New York Giants": "nyg",
        "New York Jets": "nyj", "Philadelphia Eagles": "phi", "Pittsburgh Steelers": "pit",
        "San Francisco 49ers": "sf", "Seattle Seahawks": "sea", "Tampa Bay Buccaneers": "tb",
        "Tennessee Titans": "ten", "Washington Commanders": "wsh"
    };
    return abbrevMap[teamName];
}

async function calculateTeamAccuracy() {
    console.log('📈 Calculating team prediction accuracy...');
    try {
        const resultsPath = path.join(__dirname, '..', 'results.json');
        if (!fs.existsSync(resultsPath)) {
            console.log('⚠️  results.json not found, skipping team accuracy');
            return {};
        }

        const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        const teamAccuracy = {};

        for (const teamName in TEAM_DATA) {
            teamAccuracy[teamName] = { correct: 0, total: 0 };
        }

        for (const game of data.games || []) {
            if (teamAccuracy[game.homeTeam]) {
                teamAccuracy[game.homeTeam].total++;
                if (game.correct) teamAccuracy[game.homeTeam].correct++;
            }
            if (teamAccuracy[game.awayTeam]) {
                teamAccuracy[game.awayTeam].total++;
                if (game.correct) teamAccuracy[game.awayTeam].correct++;
            }
        }

        console.log('✅ Team accuracy calculated');
        return teamAccuracy;
    } catch (error) {
        console.error('❌ Error calculating team accuracy:', error.message);
        return {};
    }
}

async function main() {
    console.log('🏈 NFL Data Cache Script Starting...\n');

    // Fetch all data
    const { games, currentWeek } = await fetchGames();
    const leagueStats = await fetchLeagueStats();
    const injuries = await fetchInjuries(games);  // Pass games to extract injury data
    const teamAccuracy = await calculateTeamAccuracy();

    // Combine into cached data
    const cachedData = {
        lastUpdated: new Date().toISOString(),
        currentWeek,
        games,
        leagueStats,
        injuries,
        teamAccuracy
    };

    // Save to file
    const outputPath = path.join(__dirname, '..', 'cached-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(cachedData, null, 2));

    console.log('\n✅ Cache complete!');
    console.log(`📦 Saved to: cached-data.json`);
    console.log(`📅 Current week: ${currentWeek}`);
    console.log(`🎮 Games loaded: ${games.length}`);
    console.log(`📊 Teams with stats: ${Object.keys(leagueStats.teams || {}).length}`);
    console.log(`🏥 Teams with injuries: ${Object.keys(injuries).length}`);
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

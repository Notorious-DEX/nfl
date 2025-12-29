#!/usr/bin/env node

/**
 * Generate NFL Predictions
 * Uses EXACT same algorithm as index.html for consistency
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

let injuries = {};
let qualityWins = {};
let eloRatings = {};

// Injury analysis - EXACT copy from index.html
function analyzeInjuryImpact(teamName) {
    const teamInjuries = injuries[teamName] || [];
    let impact = { points: 0, notes: [] };

    console.log(`🏥 Analyzing injuries for ${teamName}, found ${teamInjuries.length} injuries`);

    for (const injury of teamInjuries) {
        const position = (injury.athlete?.position || '').toUpperCase();
        const playerName = injury.athlete?.displayName || 'Unknown';
        const status = (injury.status || '').toLowerCase();
        const comment = (injury.longComment || '').toLowerCase();

        // QB injuries - huge impact (only for starters)
        if (position === 'QB') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;

            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 8;
                    impact.notes.push(`🏥 ${playerName} (QB) out (-8 pts)`);
                } else if (status === 'questionable' || status === 'doubtful') {
                    impact.points -= 4;
                    impact.notes.push(`🏥 ${playerName} (QB) ${status} (-4 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup QB) out`);
            }
        }

        // RB injuries
        else if (position === 'RB') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;

            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 4;
                    impact.notes.push(`🏥 ${playerName} (RB) out (-4 pts)`);
                } else if (status === 'questionable' || status === 'doubtful') {
                    impact.points -= 2;
                    impact.notes.push(`🏥 ${playerName} (RB) ${status} (-2 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup RB) out`);
            }
        }

        // WR/TE injuries
        else if (position === 'WR' || position === 'TE') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;

            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 3;
                    impact.notes.push(`🏥 ${playerName} (${position}) out (-3 pts)`);
                } else if (status === 'questionable' || status === 'doubtful') {
                    impact.points -= 1.5;
                    impact.notes.push(`🏥 ${playerName} (${position}) ${status} (-1.5 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup ${position}) out`);
            }
        }

        // Offensive line
        else if (position === 'OL' || position === 'T' || position === 'G' || position === 'C') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;

            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 2;
                    impact.notes.push(`🏥 ${playerName} (OL) out (-2 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup OL) out`);
            }
        }

        // Defensive players
        else if ((position === 'CB' || position === 'S') && (status === 'out' || comment.includes('out'))) {
            impact.notes.push(`ℹ️ ${playerName} (${position}) out`);
        }
    }

    return impact;
}

// Generate prediction - EXACT copy from index.html
function generatePrediction(game, weather) {
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

    // If missing data, skip prediction
    if (!homeStats || !awayStats || !homeRankings || !awayRankings) {
        const missingTeams = [];
        if (!homeStats) missingTeams.push(homeTeam);
        if (!awayStats) missingTeams.push(awayTeam);

        console.warn(`⚠️  Skipping prediction for ${awayTeam} @ ${homeTeam} - Missing data for: ${missingTeams.join(', ')}`);
        return null;
    }

    // Base efficiency ratings
    const baseAwayScore = (awayStats.offensiveRating + homeStats.defensiveRating) / 2;
    const baseHomeScore = (homeStats.offensiveRating + awayStats.defensiveRating) / 2;

    let ourHomeScore = baseHomeScore;
    let ourAwayScore = baseAwayScore;

    // Home field advantage
    const homeFieldAdv = 2.5;
    ourHomeScore += homeFieldAdv;

    // Weather weights for rush vs pass
    let rushWeight = 1.0;
    let passWeight = 1.0;

    if (weather) {
        if (weather.snow) {
            rushWeight = 2.0;
            passWeight = 0.4;
        } else if (weather.rain > 0.5) {
            rushWeight = 1.5;
            passWeight = 0.7;
        }

        if (weather.windSpeed > 20) {
            passWeight *= 0.5;
        }
    }

    // Rush/pass matchup analysis
    if (leagueStats.hasData && homeRankings.rushOffRank && awayRankings.rushDefRank) {
        const gap = awayRankings.rushDefRank - homeRankings.rushOffRank;
        const rawAdvantage = gap * 0.15;
        const advantage = rawAdvantage * rushWeight;

        if (Math.abs(gap) > 5) {
            ourHomeScore += advantage;
        }
    }

    if (leagueStats.hasData && homeRankings.passOffRank && awayRankings.passDefRank) {
        const gap = awayRankings.passDefRank - homeRankings.passOffRank;
        const rawAdvantage = gap * 0.15;
        const advantage = rawAdvantage * passWeight;

        if (Math.abs(gap) > 5) {
            ourHomeScore += advantage;
        }
    }

    if (leagueStats.hasData && awayRankings.rushOffRank && homeRankings.rushDefRank) {
        const gap = homeRankings.rushDefRank - awayRankings.rushOffRank;
        const rawAdvantage = gap * 0.15;
        const advantage = rawAdvantage * rushWeight;

        if (Math.abs(gap) > 5) {
            ourAwayScore += advantage;
        }
    }

    if (leagueStats.hasData && awayRankings.passOffRank && homeRankings.passDefRank) {
        const gap = homeRankings.passDefRank - awayRankings.passOffRank;
        const rawAdvantage = gap * 0.15;
        const advantage = rawAdvantage * passWeight;

        if (Math.abs(gap) > 5) {
            ourAwayScore += advantage;
        }
    }

    // Third down efficiency
    if (homeStats.thirdDownPct > 45) {
        ourHomeScore += 1.5;
    } else if (homeStats.thirdDownPct < 35) {
        ourHomeScore -= 1.5;
    }

    if (awayStats.thirdDownPct > 45) {
        ourAwayScore += 1.5;
    } else if (awayStats.thirdDownPct < 35) {
        ourAwayScore -= 1.5;
    }

    // Red zone efficiency
    if (homeStats.redZonePct > 60) {
        ourHomeScore += 1.5;
    } else if (homeStats.redZonePct < 45) {
        ourHomeScore -= 1.5;
    }

    if (awayStats.redZonePct > 60) {
        ourAwayScore += 1.5;
    } else if (awayStats.redZonePct < 45) {
        ourAwayScore -= 1.5;
    }

    // Sack differential
    const homeSackDiff = (awayStats.sacksTakenPG || 0) - (homeStats.sacksAllowedPG || 0);
    const awaySackDiff = (homeStats.sacksTakenPG || 0) - (awayStats.sacksAllowedPG || 0);

    if (homeSackDiff > 1) {
        ourHomeScore += 1;
    } else if (homeSackDiff < -1) {
        ourHomeScore -= 1;
    }

    if (awaySackDiff > 1) {
        ourAwayScore += 1;
    } else if (awaySackDiff < -1) {
        ourAwayScore -= 1;
    }

    // Weather scoring reduction
    if (weather) {
        if (weather.snow || weather.rain > 0.5 || weather.windSpeed > 20) {
            let weatherImpact = 0;

            if (weather.snow) {
                weatherImpact = -4;
            } else if (weather.rain > 0.5) {
                weatherImpact = -2;
            }

            if (weather.windSpeed > 20) {
                weatherImpact -= 2;
            }

            ourHomeScore += weatherImpact / 2;
            ourAwayScore += weatherImpact / 2;
        }
    }

    // Injury impact
    const homeInjuryImpact = analyzeInjuryImpact(homeTeam);
    const awayInjuryImpact = analyzeInjuryImpact(awayTeam);

    if (homeInjuryImpact.points !== 0) {
        ourHomeScore += homeInjuryImpact.points;
    }

    if (awayInjuryImpact.points !== 0) {
        ourAwayScore += awayInjuryImpact.points;
    }

    // Quality wins bonus (Week 12+)
    const currentWeek = game.week?.number || 0;
    if (currentWeek >= 12 && qualityWins && qualityWins[homeTeam] && qualityWins[awayTeam]) {
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

async function fetchWeather(homeTeam, gameDate) {
    const teamInfo = TEAM_DATA[homeTeam];
    if (!teamInfo) return null;

    try {
        const date = new Date(gameDate);
        const dateStr = date.toISOString().split('T')[0];

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${teamInfo.lat}&longitude=${teamInfo.lon}&hourly=temperature_2m,precipitation_probability,windspeed_10m,weathercode&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America/New_York&start_date=${dateStr}&end_date=${dateStr}`;

        const response = await fetch(url);
        const data = await response.json();

        const hour = date.getHours();
        const temp = data.hourly.temperature_2m[hour] || 70;
        const precip = data.hourly.precipitation_probability[hour] || 0;
        const wind = data.hourly.windspeed_10m[hour] || 0;
        const code = data.hourly.weathercode[hour] || 0;

        let condition = 'Clear';
        let rain = 0;
        let snow = 0;

        if (code >= 71 && code <= 77) { condition = 'Snow'; snow = 1; }
        else if (code >= 61 && code <= 67) { condition = 'Rain'; rain = 0.5; }
        else if (code >= 80 && code <= 99) { condition = 'Heavy Rain'; rain = 1; }
        else if (code >= 45 && code <= 48) condition = 'Fog';

        return {
            temp: Math.round(temp),
            precipitation: precip,
            windSpeed: Math.round(wind),
            condition,
            rain,
            snow
        };
    } catch (error) {
        console.warn('Weather fetch failed:', error.message);
        return null;
    }
}

async function loadTeamStats() {
    try {
        const cachedDataPath = path.join(__dirname, '..', 'cached-data.json');
        if (fs.existsSync(cachedDataPath)) {
            const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));

            leagueStats = cachedData.leagueStats || { teams: {}, rankings: {}, hasData: false };
            injuries = cachedData.injuries || {};
            qualityWins = cachedData.qualityWins || {};

            console.log(`✅ Loaded team stats for ${Object.keys(leagueStats.teams).length} teams`);
            console.log(`✅ Loaded injuries for ${Object.keys(injuries).length} teams`);
            console.log(`✅ Loaded quality wins for ${Object.keys(qualityWins).length} teams`);
        } else {
            console.warn('⚠️ cached-data.json not found');
        }

        // Load and merge manual injury overrides (CRITICAL - same as index.html)
        const manualInjuriesPath = path.join(__dirname, '..', 'manual-injuries.json');
        if (fs.existsSync(manualInjuriesPath)) {
            const manualInjuries = JSON.parse(fs.readFileSync(manualInjuriesPath, 'utf8'));

            // Merge manual injuries with cached injuries
            for (const team in manualInjuries) {
                if (!injuries[team]) {
                    injuries[team] = [];
                }
                injuries[team] = [...injuries[team], ...manualInjuries[team]];
            }

            console.log(`✅ Merged manual injury overrides`);
        } else {
            console.log('⚠️  No manual injury overrides found');
        }
    } catch (error) {
        console.error('Error loading team stats:', error);
    }
}

async function loadEloRatings() {
    try {
        const eloPath = path.join(__dirname, '..', 'historical-elo.json');
        if (fs.existsSync(eloPath)) {
            const eloData = JSON.parse(fs.readFileSync(eloPath, 'utf8'));
            eloRatings = eloData.seasons?.['2025']?.startOfSeasonRatings || {};
            console.log(`✅ Loaded Elo ratings for ${Object.keys(eloRatings).length} teams`);
        } else {
            console.warn('⚠️ historical-elo.json not found');
        }
    } catch (error) {
        console.error('Error loading Elo ratings:', error);
    }
}

async function loadInjuries() {
    // Injuries are already loaded from cached-data.json
    // This function is no longer needed but kept for compatibility
}

function getTeamNameFromAbbrev(abbrev) {
    const teamMap = {
        'ARI': 'Arizona Cardinals', 'ATL': 'Atlanta Falcons', 'BAL': 'Baltimore Ravens',
        'BUF': 'Buffalo Bills', 'CAR': 'Carolina Panthers', 'CHI': 'Chicago Bears',
        'CIN': 'Cincinnati Bengals', 'CLE': 'Cleveland Browns', 'DAL': 'Dallas Cowboys',
        'DEN': 'Denver Broncos', 'DET': 'Detroit Lions', 'GB': 'Green Bay Packers',
        'HOU': 'Houston Texans', 'IND': 'Indianapolis Colts', 'JAX': 'Jacksonville Jaguars',
        'KC': 'Kansas City Chiefs', 'LV': 'Las Vegas Raiders', 'LAC': 'Los Angeles Chargers',
        'LAR': 'Los Angeles Rams', 'MIA': 'Miami Dolphins', 'MIN': 'Minnesota Vikings',
        'NE': 'New England Patriots', 'NO': 'New Orleans Saints', 'NYG': 'New York Giants',
        'NYJ': 'New York Jets', 'PHI': 'Philadelphia Eagles', 'PIT': 'Pittsburgh Steelers',
        'SF': 'San Francisco 49ers', 'SEA': 'Seattle Seahawks', 'TB': 'Tampa Bay Buccaneers',
        'TEN': 'Tennessee Titans', 'WAS': 'Washington Commanders'
    };
    return teamMap[abbrev];
}

async function main() {
    try {
        console.log('🏈 Generating NFL predictions using index.html algorithm...\n');

        // Load supporting data
        await Promise.all([
            loadTeamStats(),
            loadEloRatings()
        ]);

        // Fetch upcoming games
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
        const data = await response.json();

        const now = new Date();
        const games = (data.events || []).filter(event => {
            const gameDate = new Date(event.date);
            const status = event.competitions[0].status;
            return gameDate >= now && status.type.name === 'STATUS_SCHEDULED';
        });

        console.log(`\n🎯 Generating predictions for ${games.length} upcoming games...`);

        const predictions = [];

        for (const game of games) {
            const homeTeam = game.competitions[0].competitors.find(c => c.homeAway === 'home').team.displayName;
            const weather = await fetchWeather(homeTeam, game.date);

            const prediction = generatePrediction(game, weather);
            if (prediction) {
                predictions.push(prediction);
                console.log(`  ✓ ${prediction.awayTeam} @ ${prediction.homeTeam}: ${prediction.winner} (${prediction.awayScore}-${prediction.homeScore})`);
            }
        }

        // Save predictions
        const predictionsPath = path.join(__dirname, '..', 'predictions.json');
        fs.writeFileSync(predictionsPath, JSON.stringify({
            generated: new Date().toISOString(),
            predictions
        }, null, 2));

        console.log(`\n✅ Saved ${predictions.length} predictions to predictions.json`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();

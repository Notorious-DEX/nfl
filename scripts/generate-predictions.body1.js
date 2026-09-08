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

function analyzeInjuryImpact(teamName) {
    const teamInjuries = injuries[teamName] || [];
    let impact = { points: 0, notes: [] };

    console.log(`🏥 Analyzing injuries for ${teamName}, found ${teamInjuries.length} injuries`);

    for (const injury of teamInjuries) {
        const position = (injury.athlete?.position || '').toUpperCase();
        const playerName = injury.athlete?.displayName || 'Unknown';
        const status = (injury.status || '').toLowerCase();
        const comment = (injury.longComment || '').toLowerCase();

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
        } else if (position === 'RB') {
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
        } else if (position === 'WR' || position === 'TE') {
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
        } else if (position === 'OL' || position === 'T' || position === 'G' || position === 'C') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;
            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 2;
                    impact.notes.push(`🏥 ${playerName} (OL) out (-2 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup OL) out`);
            }
        } else if ((position === 'CB' || position === 'S') && (status === 'out' || comment.includes('out'))) {
            impact.notes.push(`ℹ️ ${playerName} (${position}) out`);
        }
    }

    return impact;
}

function generatePrediction(game, weather) {
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
        const missingTeams = [];
        if (!homeStats) missingTeams.push(homeTeam);
        if (!awayStats) missingTeams.push(awayTeam);
        console.warn(`⚠️  Skipping prediction for ${awayTeam} @ ${homeTeam} - Missing data for: ${missingTeams.join(', ')}`);
        return null;
    }

    const baseAwayScore = (awayStats.offensiveRating + homeStats.defensiveRating) / 2;
    const baseHomeScore = (homeStats.offensiveRating + awayStats.defensiveRating) / 2;

    let ourHomeScore = baseHomeScore;
    let ourAwayScore = baseAwayScore;

    const homeFieldAdv = 2.5;
    ourHomeScore += homeFieldAdv;

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

    if (leagueStats.hasData && homeRankings.rushOffRank && awayRankings.rushDefRank) {
        const gap = awayRankings.rushDefRank - homeRankings.rushOffRank;
        const advantage = gap * 0.15 * rushWeight;
        if (Math.abs(gap) > 5) ourHomeScore += advantage;
    }
    if (leagueStats.hasData && homeRankings.passOffRank && awayRankings.passDefRank) {
        const gap = awayRankings.passDefRank - homeRankings.passOffRank;
        const advantage = gap * 0.15 * passWeight;
        if (Math.abs(gap) > 5) ourHomeScore += advantage;
    }
    if (leagueStats.hasData && awayRankings.rushOffRank && homeRankings.rushDefRank) {
        const gap = homeRankings.rushDefRank - awayRankings.rushOffRank;
        const advantage = gap * 0.15 * rushWeight;
        if (Math.abs(gap) > 5) ourAwayScore += advantage;
    }
    if (leagueStats.hasData && awayRankings.passOffRank && homeRankings.passDefRank) {
        const gap = homeRankings.passDefRank - awayRankings.passOffRank;
        const advantage = gap * 0.15 * passWeight;
        if (Math.abs(gap) > 5) ourAwayScore += advantage;
    }

    if (homeStats.thirdDownPct > 45) ourHomeScore += 1.5;
    else if (homeStats.thirdDownPct < 35) ourHomeScore -= 1.5;
    if (awayStats.thirdDownPct > 45) ourAwayScore += 1.5;
    else if (awayStats.thirdDownPct < 35) ourAwayScore -= 1.5;

    if (homeStats.redZonePct > 60) ourHomeScore += 1.5;
    else if (homeStats.redZonePct < 45) ourHomeScore -= 1.5;
    if (awayStats.redZonePct > 60) ourAwayScore += 1.5;
    else if (awayStats.redZonePct < 45) ourAwayScore -= 1.5;

    const homeSackDiff = (awayStats.sacksTakenPG || 0) - (homeStats.sacksAllowedPG || 0);
    const awaySackDiff = (homeStats.sacksTakenPG || 0) - (awayStats.sacksAllowedPG || 0);
    if (homeSackDiff > 1) ourHomeScore += 1;
    else if (homeSackDiff < -1) ourHomeScore -= 1;
    if (awaySackDiff > 1) ourAwayScore += 1;
    else if (awaySackDiff < -1) ourAwayScore -= 1;

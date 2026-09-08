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

        const manualInjuriesPath = path.join(__dirname, '..', 'manual-injuries.json');
        if (fs.existsSync(manualInjuriesPath)) {
            const manualInjuries = JSON.parse(fs.readFileSync(manualInjuriesPath, 'utf8'));

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
            const seasonYear = String(currentNflSeasonYear());
            const previousYear = String(Number(seasonYear) - 1);
            eloRatings = eloData.seasons?.[seasonYear]?.startOfSeasonRatings
                || eloData.seasons?.[previousYear]?.startOfSeasonRatings
                || {};
            console.log(`✅ Loaded Elo ratings for ${Object.keys(eloRatings).length} teams (${eloData.seasons?.[seasonYear] ? seasonYear : previousYear})`);
        } else {
            console.warn('⚠️ historical-elo.json not found');
        }
    } catch (error) {
        console.error('Error loading Elo ratings:', error);
    }
}

async function loadInjuries() {
    // Injuries are already loaded from cached-data.json
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

        await Promise.all([
            loadTeamStats(),
            loadEloRatings()
        ]);

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

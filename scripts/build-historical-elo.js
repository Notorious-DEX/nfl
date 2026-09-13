#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { fetch, currentNflSeasonYear } = require('./espn-fetch');
const elo = require('./elo');
const TEAM_NAMES = ["Arizona Cardinals","Atlanta Falcons","Baltimore Ravens","Buffalo Bills","Carolina Panthers","Chicago Bears","Cincinnati Bengals","Cleveland Browns","Dallas Cowboys","Denver Broncos","Detroit Lions","Green Bay Packers","Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Kansas City Chiefs","Las Vegas Raiders","Los Angeles Chargers","Los Angeles Rams","Miami Dolphins","Minnesota Vikings","New England Patriots","New Orleans Saints","New York Giants","New York Jets","Philadelphia Eagles","Pittsburgh Steelers","San Francisco 49ers","Seattle Seahawks","Tampa Bay Buccaneers","Tennessee Titans","Washington Commanders"];

async function fetchSeasonGames(year) {
    console.log('  Fetching ' + year + ' season data...');
    const allGames = [];
    for (let week = 1; week <= 18; week++) {
        try {
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=' + year + '&seasontype=2&week=' + week);
            const data = await response.json();
            for (const event of data.events || []) {
                const competition = event.competitions[0];
                if (!competition.status.type.completed) continue;
                const homeComp = competition.competitors.find((c) => c.homeAway === 'home');
                const awayComp = competition.competitors.find((c) => c.homeAway === 'away');
                allGames.push({ week, homeTeam: homeComp.team.displayName, awayTeam: awayComp.team.displayName, homeScore: parseInt(homeComp.score) || 0, awayScore: parseInt(awayComp.score) || 0 });
            }
        } catch (error) {
            console.warn('    Week ' + week + ': ' + error.message);
        }
    }
    console.log('  Fetched ' + allGames.length + ' completed games');
    return allGames;
}

function processSeasonGames(games, currentRatings) {
    const ratings = { ...currentRatings };
    for (const game of games) {
        const { homeTeam, awayTeam, homeScore, awayScore } = game;
        if (!ratings[homeTeam] || !ratings[awayTeam]) continue;
        if (homeScore > awayScore) {
            const updated = elo.updateElo(ratings[homeTeam], ratings[awayTeam], homeScore - awayScore, true);
            ratings[homeTeam] = updated.winnerElo;
            ratings[awayTeam] = updated.loserElo;
        } else if (awayScore > homeScore) {
            const updated = elo.updateElo(ratings[awayTeam], ratings[homeTeam], awayScore - homeScore, false);
            ratings[awayTeam] = updated.winnerElo;
            ratings[homeTeam] = updated.loserElo;
        }
    }
    return ratings;
}

async function main() {
    const now = new Date();
    const currentSeason = currentNflSeasonYear(now);
    const lastCompleted = now.getMonth() >= 8 ? currentSeason - 1 : currentSeason;
    const upcoming = lastCompleted + 1;
    const startYear = 2022;
    console.log('Building Elo ' + startYear + '-' + lastCompleted + ', start ratings for ' + upcoming);
    const history = { metadata: { generated: now.toISOString(), initialElo: elo.INITIAL_ELO, kFactor: elo.K_FACTOR, homeAdvantage: elo.HOME_ADVANTAGE, regressionFactor: 1 / 3, lastCompletedSeason: lastCompleted, upcomingSeason: upcoming }, seasons: {} };
    let currentRatings = elo.initializeRatings(TEAM_NAMES);
    let totalGames = 0;
    for (let year = startYear; year <= lastCompleted; year++) {
        if (year !== startYear) {
            for (const team in currentRatings) currentRatings[team] = elo.regressToMean(currentRatings[team]);
        }
        const games = await fetchSeasonGames(year);
        currentRatings = processSeasonGames(games, currentRatings);
        totalGames += games.length;
        history.seasons[String(year)] = { endOfSeasonRatings: { ...currentRatings }, gamesPlayed: games.length };
    }
    const startRatings = {};
    for (const team in currentRatings) startRatings[team] = elo.regressToMean(currentRatings[team]);
    history.seasons[String(upcoming)] = { startOfSeasonRatings: startRatings };
    fs.writeFileSync(path.join(__dirname, '..', 'historical-elo.json'), JSON.stringify(history, null, 2));
    console.log('Saved historical-elo.json, games processed: ' + totalGames);
}

main().catch((error) => { console.error(error); process.exit(1); });

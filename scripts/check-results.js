#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { fetch } = require('./espn-fetch');
function nflSeasonYear(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    return month >= 7 ? year : year - 1;
}
function recount(results) {
    const games = results.games || [];
    results.total = games.length;
    results.correct = games.filter((g) => g.correct).length;
    results.accuracy = results.total > 0 ? ((results.correct / results.total) * 100).toFixed(1) : '0.0';
    const weeks = games.map((g) => g.week).filter((w) => w != null);
    if (weeks.length) results.weeks = Math.max(...weeks);
}
function loadPredictions() {
    const files = [path.join(__dirname, '..', 'predictions.json'), path.join(__dirname, '..', 'prediction-archive.json')];
    const byId = new Map();
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const list = Array.isArray(data) ? data : (data.predictions || []);
        for (const prediction of list) {
            if (prediction && prediction.gameId && !byId.has(String(prediction.gameId))) byId.set(String(prediction.gameId), prediction);
        }
    }
    return [...byId.values()];
}
function saveArchive(predictions) {
    const archivePath = path.join(__dirname, '..', 'prediction-archive.json');
    let existing = [];
    if (fs.existsSync(archivePath)) existing = JSON.parse(fs.readFileSync(archivePath, 'utf8')).predictions || [];
    const byId = new Map(existing.map((p) => [String(p.gameId), p]));
    for (const prediction of predictions) {
        if (prediction && prediction.gameId && !byId.has(String(prediction.gameId))) byId.set(String(prediction.gameId), prediction);
    }
    fs.writeFileSync(archivePath, JSON.stringify({ lastUpdated: new Date().toISOString(), predictions: [...byId.values()] }, null, 2));
}
async function checkResults() {
    try {
        console.log('Checking prediction results...\n');
        const resultsPath = path.join(__dirname, '..', 'results.json');
        if (!fs.existsSync(resultsPath)) {
            fs.writeFileSync(resultsPath, JSON.stringify({ lastUpdated: new Date().toISOString(), version: 'v0.06', method: 'index.html-algorithm', kFactor: 20, weeks: 0, correct: 0, total: 0, accuracy: '0.0', games: [] }, null, 2));
        }
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        if (!Array.isArray(results.games)) results.games = [];
        const archivedCount = results.games.length;
        const predictions = loadPredictions();
        saveArchive(predictions);
        if (!predictions.length) {
            console.log('No predictions to grade. Leaving archived results untouched.');
            recount(results);
            results.lastUpdated = new Date().toISOString();
            fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
            return;
        }
        let newChecks = 0;
        for (const prediction of predictions) {
            if (results.games.some((g) => String(g.gameId) === String(prediction.gameId))) continue;
            try {
                const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=' + prediction.gameId);
                const data = await response.json();
                const weekNumber = data.header && data.header.week || prediction.week || null;
                const seasonType = Number(data.header && data.header.season && data.header.season.type || 0);
                const slug = String(data.header && data.header.season && data.header.season.slug || '');
                if (seasonType === 1 || slug.includes('preseason')) {
                    console.log('  Skipping preseason game ' + prediction.gameId);
                    continue;
                }
                const gameData = data.header && data.header.competitions && data.header.competitions[0];
                if (!gameData) { console.warn('  No game data for ' + prediction.gameId); continue; }
                if (!gameData.status || !gameData.status.type || !gameData.status.type.completed) continue;
                const homeComp = (gameData.competitors || []).find((c) => c.homeAway === 'home');
                const awayComp = (gameData.competitors || []).find((c) => c.homeAway === 'away');
                if (!homeComp || !awayComp) continue;
                const homeScore = parseInt(homeComp.score) || 0;
                const awayScore = parseInt(awayComp.score) || 0;
                const actualHomeTeam = homeComp.team && homeComp.team.displayName;
                const actualAwayTeam = awayComp.team && awayComp.team.displayName;
                const actualWinner = homeScore > awayScore ? actualHomeTeam : actualAwayTeam;
                const correct = actualWinner === prediction.winner;
                const scoreDiff = Math.abs(prediction.homeScore - prediction.awayScore);
                let confidence = 'medium';
                if (scoreDiff >= 7) confidence = 'high';
                else if (scoreDiff <= 3) confidence = 'low';
                results.games.push({ gameId: prediction.gameId, seasonYear: nflSeasonYear(prediction.date), week: weekNumber, date: prediction.date, homeTeam: prediction.homeTeam, awayTeam: prediction.awayTeam, homeScore: prediction.homeScore, awayScore: prediction.awayScore, winner: prediction.winner, confidence, method: 'index.html-algorithm', actualHomeScore: homeScore, actualAwayScore: awayScore, actualWinner, correct });
                newChecks++;
                console.log('  [' + (correct ? 'YES' : 'NO') + '] ' + prediction.awayTeam + ' @ ' + prediction.homeTeam + ' (Week ' + (weekNumber || '?') + ')');
            } catch (error) {
                console.warn('  Could not check ' + prediction.gameId + ': ' + error.message);
            }
        }
        if (results.games.length < archivedCount) throw new Error('Refusing to save: games shrank from ' + archivedCount + ' to ' + results.games.length);
        recount(results);
        results.lastUpdated = new Date().toISOString();
        results.method = 'index.html-algorithm';
        if (!results.kFactor) results.kFactor = 20;
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        console.log('Archived games kept: ' + archivedCount);
        console.log('New checks: ' + newChecks);
        console.log('Accuracy: ' + results.accuracy + '%');
    } catch (error) {
        console.error('Error checking results:', error);
        process.exit(1);
    }
}
checkResults();

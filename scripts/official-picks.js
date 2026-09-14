#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OFFICIAL_PATH = path.join(ROOT, 'official-picks.json');
const PREDICTIONS_PATH = path.join(ROOT, 'predictions.json');
const ARCHIVE_PATH = path.join(ROOT, 'prediction-archive.json');
const RESULTS_PATH = path.join(ROOT, 'results.json');
const CACHE_PATH = path.join(ROOT, 'cached-data.json');
const LOCK_MS = 5 * 60 * 1000;

function readJson(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) {
        return fallback;
    }
}

function listFrom(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return data.predictions || data.picks || [];
}

function loadOfficial() {
    const byId = new Map();
    const sources = [
        listFrom(readJson(OFFICIAL_PATH, {})),
        listFrom(readJson(ARCHIVE_PATH, {})),
        listFrom(readJson(PREDICTIONS_PATH, {}))
    ];
    for (const list of sources) {
        for (const pick of list) {
            if (!pick || !pick.gameId) continue;
            const id = String(pick.gameId);
            if (!byId.has(id)) byId.set(id, { ...pick, gameId: id, locked: true });
        }
    }
    const results = readJson(RESULTS_PATH, {});
    for (const game of results.games || []) {
        if (!game || !game.gameId) continue;
        const id = String(game.gameId);
        if (!byId.has(id) && game.winner) {
            byId.set(id, {
                gameId: id,
                date: game.date,
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                homeScore: game.homeScore,
                awayScore: game.awayScore,
                winner: game.winner,
                locked: true
            });
        } else if (byId.has(id)) {
            byId.get(id).locked = true;
        }
    }
    return byId;
}

function isKickoffLocked(pick, now = Date.now()) {
    if (!pick || !pick.date) return Boolean(pick && pick.locked);
    const start = new Date(pick.date).getTime();
    if (Number.isNaN(start)) return Boolean(pick.locked);
    return start - now <= LOCK_MS;
}

function saveOfficial(byId) {
    const picks = [...byId.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const payload = {
        lastUpdated: new Date().toISOString(),
        rule: 'First official card wins. Locked at write and again 5 minutes before kickoff.',
        picks
    };
    fs.writeFileSync(OFFICIAL_PATH, JSON.stringify(payload, null, 2));
    return payload;
}

function attachToCache(byId) {
    if (!fs.existsSync(CACHE_PATH)) return;
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    cache.officialPicks = Object.fromEntries([...byId.entries()].map(([id, pick]) => [id, pick]));
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function mergeGenerated() {
    const official = loadOfficial();
    const generated = listFrom(readJson(PREDICTIONS_PATH, {}));
    let kept = 0;
    let added = 0;
    const open = [];
    for (const pick of generated) {
        if (!pick || !pick.gameId) continue;
        const id = String(pick.gameId);
        const existing = official.get(id);
        if (existing) {
            kept += 1;
            open.push(existing);
            continue;
        }
        if (isKickoffLocked(pick)) {
            official.set(id, { ...pick, gameId: id, locked: true });
            open.push(official.get(id));
            added += 1;
            continue;
        }
        official.set(id, { ...pick, gameId: id, locked: true });
        open.push(official.get(id));
        added += 1;
    }
    const payload = saveOfficial(official);
    attachToCache(official);
    fs.writeFileSync(PREDICTIONS_PATH, JSON.stringify({
        generated: new Date().toISOString(),
        source: 'official-picks',
        predictions: open
    }, null, 2));
    const archive = { lastUpdated: payload.lastUpdated, predictions: payload.picks };
    fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
    console.log('Official picks: ' + official.size + ' locked, ' + added + ' new, ' + kept + ' unchanged');
    return payload;
}

if (require.main === module) {
    mergeGenerated();
}

module.exports = { loadOfficial, mergeGenerated, isKickoffLocked };

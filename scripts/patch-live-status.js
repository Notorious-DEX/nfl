#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
text = text.replace(/>v\d+\.\d+</, '>v0.12<');

const helper = `function isLiveGameStatus(status) {
            const type = (status && status.type) || {};
            const name = String(type.name || '');
            const state = String(type.state || '');
            if (type.completed) return false;
            if (state === 'in') return true;
            return name === 'STATUS_IN_PROGRESS' || name === 'STATUS_HALFTIME' || name === 'STATUS_END_PERIOD' || name === 'STATUS_END_OF_PERIOD' || name === 'STATUS_DELAYED' || name === 'STATUS_RAIN_DELAY';
        }
        `;
if (!text.includes('function isLiveGameStatus')) {
    text = text.replace('function createGameCard(game, prediction, gameId) {', helper + 'function createGameCard(game, prediction, gameId) {');
}
text = text.replace(
    "const isLive = status.type.name === 'STATUS_IN_PROGRESS';",
    'const isLive = isLiveGameStatus(status);'
);
text = text.replace(
    "if (status.type.name === 'STATUS_IN_PROGRESS') {",
    'if (isLiveGameStatus(status)) {'
);

// first refresh immediately if not already
const start = text.indexOf('function startAutoRefresh');
const marker = 'const refreshLiveScores = async () => {';
if (start >= 0 && text.indexOf('refreshLiveScores();', start) < 0) {
    const insertAt = text.indexOf('refreshInterval = setInterval(refreshLiveScores', start);
    if (insertAt > 0) {
        text = text.slice(0, insertAt) + 'refreshLiveScores();\n            ' + text.slice(insertAt);
    }
}

fs.writeFileSync(file, text);
console.log('Live scores treat in-game statuses as live');

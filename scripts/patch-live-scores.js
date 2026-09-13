#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function mustReplace(label, oldStr, newStr) {
    if (!html.includes(oldStr)) {
        console.error('Could not find: ' + label);
        console.error(oldStr.slice(0, 180));
        process.exit(1);
    }
    html = html.replace(oldStr, newStr);
    console.log('Replaced ' + label);
}

mustReplace(
    'first-load live wrapper open',
    '                liveScoresHTML = `\n                    <div class="live-scores">',
    '                liveScoresHTML = `\n                    <div class="prediction-section live-score-section">\n                        <div class="prediction-title">${isLive ? "\ud83d\udd34 Live Score" : "\ud83d\udccb Final Score"}</div>\n                        <div class="live-scores">'
);

mustReplace(
    'drop extra live status lines',
    '                        ${isLive ? `<div class="game-status">${status.type.shortDetail || \'In Progress\'}</div>` : \'\'
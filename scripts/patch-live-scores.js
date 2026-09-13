#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function mustReplace(label, oldStr, newStr) {
    if (!html.includes(oldStr)) {
        console.error('Could not find: ' + label);
        process.exit(1);
    }
    html = html.replace(oldStr, newStr);
    console.log('Replaced ' + label);
}

const oldLive = [
    'liveScoresHTML = `',
    '                    <div class="live-scores">',
    '                        <div class="live-score-row ${awayWinning ? \'winning\' : \''}">',
    '                            <span>${prediction.awayTeam}</span>',
    '                            <span>${actualAwayScore}</span>',
    '                        </div>',
    '                        <div class="live-score-row ${homeWinning ? \'winning\' : \''}">',
    '                            <span>${prediction.homeTeam}</span>',
    '                            <span>${actualHomeScore}</span>',
    '                        </div>',
    '                        ${isLive ? `<div class="game-status">${status.type.shortDetail || \'In Progress\'}</div>` : \''}',
    '                        ${isCompleted ? `<div class="game-status">Final</div>` : \''}',
    '                    </div>',
    '                `;',
].join('\n');

const newLive = [
    'liveScoresHTML = `',
    '                    <div class="prediction-section live-score-section">',
    '                        <div class="prediction-title">${isLive ? \'\ud83d\udd34 Live Score\' : \'\ud83d\udccb Final Score\''}</div>',
    '                        <div class="live-scores">',
    '                            <div class="live-score-row ${awayWinning ? \'winning\' : \''}">',
    '                                <span>${prediction.awayTeam}</span>',
    '                                <span>${actualAwayScore}</span>',
    '                            </div>',
    '                            <div class="live-score-row ${homeWinning ? \'winning\' : \''}">',
    '                                <span>${prediction.homeTeam}</span>',
    '                                <span>${actualHomeScore}</span>',
    '                            </div>',
    '                        </div>',
    '                    </div>',
    '                `;',
].join('\n');

mustReplace('first-load live markup', oldLive, newLive);

const oldRefresh = [
    'liveScoresDiv.innerHTML = `',
    '                                <div class="live-score-title">\ud83d\udd34 LIVE SCORE</div>',
    '                                <div class="live-score-grid">',
    '                                    <div class="live-score-team ${awayScore > homeScore ? \'winning\' : \''}">',
    '                                        <span class="live-score-name">${awayTeam.team.displayName}</span>',
    '                                        <span class="live-score-value">${awayScore}</span>',
    '                                    </div>',
    '                                    <div class="live-score-team ${homeScore > awayScore ? \'winning\' : \''}">',
    '                                        <span class="live-score-name">${homeTeam.team.displayName}</span>',
    '                                        <span class="live-score-value">${homeScore}</span>',
    '                                    </div>',
    '                                </div>',
    '                            `;',
].join('\n');

const newRefresh = [
    'liveScoresDiv.innerHTML = `',
    '                                <div class="live-score-row ${awayScore > homeScore ? \'winning\' : \''}">',
    '                                    <span>${awayTeam.team.displayName}</span>',
    '                                    <span>${awayScore}</span>',
    '                                </div>',
    '                                <div class="live-score-row ${homeScore > awayScore ? \'winning\' : \''}">',
    '                                    <span>${homeTeam.team.displayName}</span>',
    '                                    <span>${homeScore}</span>',
    '                                </div>',
    '                            `;',
    "                            const titleEl = gameCard.querySelector('.live-score-section .prediction-title');",
    "                            if (titleEl) titleEl.textContent = '\ud83d\udd34 Live Score';",
].join('\n');

mustReplace('auto-refresh live markup', oldRefresh, newRefresh);

const oldCreate = [
    'if (!liveScoresDiv) {',
    '                                // Create live scores div if it doesn\'t exist',
    '                                liveScoresDiv = document.createElement(\'div\');',
    "                                liveScoresDiv.className = 'live-scores';",
].join('\n');

const newCreate = [
    'if (!liveScoresDiv) {',
    '                                const section = document.createElement(\'div\');',
    "                                section.className = 'prediction-section live-score-section';",
    '                                section.innerHTML = \'<div class="prediction-title">\ud83d\udd34 Live Score</div>\';',
    '                                liveScoresDiv = document.createElement(\'div\');',
    "                                liveScoresDiv.className = 'live-scores';",
    '                                section.appendChild(liveScoresDiv);',
].join('\n');

mustReplace('create live scores block', oldCreate, newCreate);

mustReplace(
    'insert live scores',
    "gameBody.insertBefore(liveScoresDiv, gameBody.firstChild);",
    "gameBody.insertBefore((liveScoresDiv.parentElement && liveScoresDiv.parentElement.classList.contains('live-score-section')) ? liveScoresDiv.parentElement : liveScoresDiv, gameBody.firstChild);"
);

mustReplace(
    'startAutoRefresh open',
    [
        '        function startAutoRefresh() {',
        '            // Refresh every 2.5 minutes (150 seconds)',
        '            refreshInterval = setInterval(async () => {',
    ].join('\n'),
    [
        '        function startAutoRefresh() {',
        '            if (refreshInterval) {',
        '                clearInterval(refreshInterval);',
        '                refreshInterval = null;',
        '            }',
        '',
        '            const refreshLiveScores = async () => {',
    ].join('\n')
);

mustReplace(
    'startAutoRefresh close',
    [
        '            }, 150000); // 150 seconds = 2.5 minutes',
        '',
        "            console.log('\u2705 Auto-refresh enabled (every 2.5 minutes)');",
        '        }',
    ].join('\n'),
    [
        '            };',
        '',
        '            refreshLiveScores();',
        '            refreshInterval = setInterval(refreshLiveScores, 150000);',
        "            console.log('\u2705 Auto-refresh enabled (immediate, then every 2.5 minutes)');",
        '        }',
    ].join('\n')
);

fs.writeFileSync(file, html);
console.log('Patched live score load + layout');

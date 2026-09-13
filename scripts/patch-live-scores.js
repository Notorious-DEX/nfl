#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const oldLive = `liveScoresHTML = \`
                    <div class="live-scores">
                        <div class="live-score-row ${awayWinning ? 'winning' : ''}">
                            <span>${prediction.awayTeam}</span>
                            <span>${actualAwayScore}</span>
                        </div>
                        <div class="live-score-row ${homeWinning ? 'winning' : ''}">
                            <span>${prediction.homeTeam}</span>
                            <span>${actualHomeScore}</span>
                        </div>
                        ${isLive ? \`<div class="game-status">${status.type.shortDetail || 'In Progress'}</div>\` : ''}
                        ${isCompleted ? \`<div class="game-status">Final</div>\` : ''}
                    </div>
                \`;`;

const newLive = `liveScoresHTML = \`
                    <div class="prediction-section live-score-section">
                        <div class="prediction-title">${isLive ? '🔴 Live Score' : '📋 Final Score'}</div>
                        <div class="live-scores">
                            <div class="live-score-row ${awayWinning ? 'winning' : ''}">
                                <span>${prediction.awayTeam}</span>
                                <span>${actualAwayScore}</span>
                            </div>
                            <div class="live-score-row ${homeWinning ? 'winning' : ''}">
                                <span>${prediction.homeTeam}</span>
                                <span>${actualHomeScore}</span>
                            </div>
                        </div>
                    </div>
                \`;`;

if (!html.includes(oldLive)) {
    console.error('Could not find first-load live score markup');
    process.exit(1);
}
html = html.replace(oldLive, newLive);

const oldRefresh = `liveScoresDiv.innerHTML = \`
                                <div class="live-score-title">🔴 LIVE SCORE</div>
                                <div class="live-score-grid">
                                    <div class="live-score-team ${awayScore > homeScore ? 'winning' : ''}">
                                        <span class="live-score-name">${awayTeam.team.displayName}</span>
                                        <span class="live-score-value">${awayScore}</span>
                                    </div>
                                    <div class="live-score-team ${homeScore > awayScore ? 'winning' : ''}">
                                        <span class="live-score-name">${homeTeam.team.displayName}</span>
                                        <span class="live-score-value">${homeScore}</span>
                                    </div>
                                </div>
                            \`;`;

const newRefresh = `liveScoresDiv.innerHTML = \`
                                <div class="live-score-row ${awayScore > homeScore ? 'winning' : ''}">
                                    <span>${awayTeam.team.displayName}</span>
                                    <span>${awayScore}</span>
                                </div>
                                <div class="live-score-row ${homeScore > awayScore ? 'winning' : ''}">
                                    <span>${homeTeam.team.displayName}</span>
                                    <span>${homeScore}</span>
                                </div>
                            \`;
                            const titleEl = gameCard.querySelector('.live-score-section .prediction-title');
                            if (titleEl) titleEl.textContent = '🔴 Live Score';`;

if (!html.includes(oldRefresh)) {
    console.error('Could not find auto-refresh live score markup');
    process.exit(1);
}
html = html.replace(oldRefresh, newRefresh);

const oldCreate = `if (!liveScoresDiv) {
                                // Create live scores div if it doesn't exist
                                liveScoresDiv = document.createElement('div');
                                liveScoresDiv.className = 'live-scores';`;

const newCreate = `if (!liveScoresDiv) {
                                const section = document.createElement('div');
                                section.className = 'prediction-section live-score-section';
                                section.innerHTML = '<div class="prediction-title">🔴 Live Score</div>';
                                liveScoresDiv = document.createElement('div');
                                liveScoresDiv.className = 'live-scores';
                                section.appendChild(liveScoresDiv);`;

if (!html.includes(oldCreate)) {
    console.error('Could not find live scores create block');
    process.exit(1);
}
html = html.replace(oldCreate, newCreate);

const oldInsert = `gameBody.insertBefore(liveScoresDiv, gameBody.firstChild);`;
const newInsert = `if (!liveScoresDiv.parentElement || !liveScoresDiv.parentElement.classList.contains('live-score-section')) {
                                    const section = document.createElement('div');
                                    section.className = 'prediction-section live-score-section';
                                    section.innerHTML = '<div class="prediction-title">🔴 Live Score</div>';
                                    liveScoresDiv.className = 'live-scores';
                                    section.appendChild(liveScoresDiv);
                                    gameBody.insertBefore(section, gameBody.firstChild);
                                } else {
                                    gameBody.insertBefore(liveScoresDiv.parentElement, gameBody.firstChild);
                                }`;

// The create block already insertBefore liveScoresDiv. After newCreate, liveScoresDiv is inside section
// but insert still uses liveScoresDiv. Fix the existing insertBefore that follows create.
if (!html.includes(oldInsert)) {
    console.error('Could not find insertBefore live scores');
    process.exit(1);
}
html = html.replace(oldInsert, 'gameBody.insertBefore(liveScoresDiv.parentElement && liveScoresDiv.parentElement.classList.contains(\'live-score-section\') ? liveScoresDiv.parentElement : liveScoresDiv, gameBody.firstChild);');

const oldStart = `        function startAutoRefresh() {
            // Refresh every 2.5 minutes (150 seconds)
            refreshInterval = setInterval(async () => {`;
const newStart = `        function startAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }

            const refreshLiveScores = async () => {`;

if (!html.includes(oldStart)) {
    console.error('Could not find startAutoRefresh opening');
    process.exit(1);
}
html = html.replace(oldStart, newStart);

const oldEnd = `            }, 150000); // 150 seconds = 2.5 minutes

            console.log('\u2705 Auto-refresh enabled (every 2.5 minutes)');
        }`;
const newEnd = `            };

            refreshLiveScores();
            refreshInterval = setInterval(refreshLiveScores, 150000);
            console.log('\u2705 Auto-refresh enabled (immediate, then every 2.5 minutes)');
        }`;

if (!html.includes(oldEnd)) {
    // try without unicode escape
    const oldEnd2 = `            }, 150000); // 150 seconds = 2.5 minutes

            console.log('✅ Auto-refresh enabled (every 2.5 minutes)');
        }`;
    if (!html.includes(oldEnd2)) {
        console.error('Could not find startAutoRefresh ending');
        process.exit(1);
    }
    html = html.replace(oldEnd2, `            };

            refreshLiveScores();
            refreshInterval = setInterval(refreshLiveScores, 150000);
            console.log('✅ Auto-refresh enabled (immediate, then every 2.5 minutes)');
        }`);
} else {
    html = html.replace(oldEnd, newEnd);
}

fs.writeFileSync(file, html);
console.log('Patched live score load + layout');

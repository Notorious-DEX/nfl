#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function mustReplace(label, oldStr, newStr) {
    if (!html.includes(oldStr)) {
        console.error('Could not find: ' + label);
        console.error(JSON.stringify(oldStr).slice(0, 240));
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
    "                        ${isLive ? `<div class=\"game-status\">${status.type.shortDetail || 'In Progress'}</div>` : ''}\n                        ${isCompleted ? `<div class=\"game-status\">Final</div>` : ''}\n                    </div>",
    '                    </div>\n                    </div>'
);

mustReplace(
    'auto-refresh live markup',
    '                            liveScoresDiv.innerHTML = `\n                                <div class="live-score-title">\ud83d\udd34 LIVE SCORE</div>\n                                <div class="live-score-grid">\n                                    <div class="live-score-team ${awayScore > homeScore ? \'winning\' : \''}">\n                                        <span class="live-score-name">${awayTeam.team.displayName}</span>\n                                        <span class="live-score-value">${awayScore}</span>\n                                    </div>\n                                    <div class="live-score-team ${homeScore > awayScore ? \'winning\' : \''}">\n                                        <span class="live-score-name">${homeTeam.team.displayName}</span>\n                                        <span class="live-score-value">${homeScore}</span>\n                                    </div>\n                                </div>\n                            `;',
    '                            liveScoresDiv.innerHTML = `\n                                <div class="live-score-row ${awayScore > homeScore ? \'winning\' : \''}">\n                                    <span>${awayTeam.team.displayName}</span>\n                                    <span>${awayScore}</span>\n                                </div>\n                                <div class="live-score-row ${homeScore > awayScore ? \'winning\' : \''}">\n                                    <span>${homeTeam.team.displayName}</span>\n                                    <span>${homeScore}</span>\n                                </div>\n                            `;\n                            const titleEl = gameCard.querySelector(\'.live-score-section .prediction-title\');\n                            if (titleEl) titleEl.textContent = \'\ud83d\udd34 Live Score\';'
);

mustReplace(
    'create live scores block',
    "                            if (!liveScoresDiv) {\n                                // Create live scores div if it doesn't exist\n                                liveScoresDiv = document.createElement('div');\n                                liveScoresDiv.className = 'live-scores';",
    "                            if (!liveScoresDiv) {\n                                const section = document.createElement('div');\n                                section.className = 'prediction-section live-score-section';\n                                section.innerHTML = '<div class=\"prediction-title\">\ud83d\udd34 Live Score</div>';\n                                liveScoresDiv = document.createElement('div');\n                                liveScoresDiv.className = 'live-scores';\n                                section.appendChild(liveScoresDiv);"
);

mustReplace(
    'insert live scores',
    'gameBody.insertBefore(liveScoresDiv, gameBody.firstChild);',
    "gameBody.insertBefore((liveScoresDiv.parentElement && liveScoresDiv.parentElement.classList.contains('live-score-section')) ? liveScoresDiv.parentElement : liveScoresDiv, gameBody.firstChild);"
);

mustReplace(
    'startAutoRefresh open',
    '        function startAutoRefresh() {\n            // Refresh every 2.5 minutes (150 seconds)\n            refreshInterval = setInterval(async () => {',
    '        function startAutoRefresh() {\n            if (refreshInterval) {\n                clearInterval(refreshInterval);\n                refreshInterval = null;\n            }\n\n            const refreshLiveScores = async () => {'
);

mustReplace(
    'startAutoRefresh close',
    "            }, 150000); // 150 seconds = 2.5 minutes\n\n            console.log('\u2705 Auto-refresh enabled (every 2.5 minutes)');\n        }",
    "            };\n\n            refreshLiveScores();\n            refreshInterval = setInterval(refreshLiveScores, 150000);\n            console.log('\u2705 Auto-refresh enabled (immediate, then every 2.5 minutes)');\n        }"
);

fs.writeFileSync(file, html);
console.log('Patched live score load + layout');

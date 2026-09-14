#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');

const oldBox = `        <div id="picksummary" class="scoreboard" style="display: none;">
            <h2 style="margin-bottom: 1rem;">🎯 Top Picks</h2>
            <div id="picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem;"></div>
        </div>`;
const newBox = `        <div id="picksummary" class="scoreboard" style="display: none;">
            <h2 id="picks-title" style="margin-bottom: 1rem;">🎯 Top Picks</h2>
            <div id="picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem;"></div>
            <div id="also-week-wrap" style="display: none; margin-top: 1.1rem;">
                <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(148,163,184,0.45), transparent); margin: 0 0 0.9rem;"></div>
                <h3 id="also-week-title" style="margin: 0 0 0.75rem; font-size: 1.05rem; color: #cbd5e1; font-weight: 600;">📋 Also this week</h3>
                <div id="also-picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem; opacity: 0.92;"></div>
            </div>
        </div>`;
if (text.includes(oldBox)) text = text.replace(oldBox, newBox);

const oldLoop = `            gamesWithPredictions.forEach(({ prediction, gameId }) => {
                // Skip error predictions in picks summary
                if (prediction.error) return;
                const teamColor = TEAM_DATA[prediction.winner]?.color || '#3498db';
                const loser = prediction.winner === prediction.homeTeam ? prediction.awayTeam : prediction.homeTeam;

                picksList.innerHTML += `
                    <div onclick="document.getElementById('${gameId}').scrollIntoView({behavior: 'smooth', block: 'center'})"
                         style="background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; border-left: 4px solid ${teamColor}; transition: all 0.2s;"
                         onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                         onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        <div style="font-weight: bold; font-size: 1.1rem;">${prediction.winner}</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">over ${loser}</div>
                        <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">
                            ${prediction.homeScore}-${prediction.awayScore} • ${prediction.confidence}
                        </div>
                    </div>
                `;
            });
            picksSummary.style.display = 'block';`;

const newLoop = `            const pickTile = (prediction, gameId) => {
                const teamColor = TEAM_DATA[prediction.winner]?.color || '#3498db';
                const loser = prediction.winner === prediction.homeTeam ? prediction.awayTeam : prediction.homeTeam;
                return `<div onclick="document.getElementById('${gameId}').scrollIntoView({behavior: 'smooth', block: 'center'})" style="background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; border-left: 4px solid ${teamColor}; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"><div style="font-weight: bold; font-size: 1.1rem;">${prediction.winner}</div><div style="font-size: 0.85rem; opacity: 0.9;">over ${loser}</div><div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">${prediction.homeScore}-${prediction.awayScore} • ${prediction.confidence}</div></div>`;
            };
            const validPicks = gamesWithPredictions.filter(({ prediction }) => prediction && !prediction.error);
            const highPicks = validPicks.filter(({ prediction }) => String(prediction.confidence || '').toLowerCase() === 'high');
            const otherPicks = validPicks.filter(({ prediction }) => String(prediction.confidence || '').toLowerCase() !== 'high');
            const picksTitle = document.getElementById('picks-title');
            const alsoWrap = document.getElementById('also-week-wrap');
            const alsoList = document.getElementById('also-picks-list');
            if (alsoList) alsoList.innerHTML = '';
            if (highPicks.length) {
                if (picksTitle) picksTitle.textContent = '🎯 Top Picks';
                highPicks.forEach(({ prediction, gameId }) => { picksList.innerHTML += pickTile(prediction, gameId); });
                if (alsoWrap) alsoWrap.style.display = otherPicks.length ? 'block' : 'none';
                otherPicks.forEach(({ prediction, gameId }) => { if (alsoList) alsoList.innerHTML += pickTile(prediction, gameId); });
            } else {
                if (picksTitle) picksTitle.textContent = '📋 This week\'s games';
                if (alsoWrap) alsoWrap.style.display = 'none';
                otherPicks.forEach(({ prediction, gameId }) => { picksList.innerHTML += pickTile(prediction, gameId); });
            }
            picksSummary.style.display = validPicks.length ? 'block' : 'none';`;

if (text.includes(oldLoop)) {
    text = text.replace(oldLoop, newLoop);
} else if (text.includes('Also this week')) {
    console.log('Top picks split already applied');
} else {
    console.error('Could not find Top Picks loop');
    process.exit(1);
}

fs.writeFileSync(file, text);
console.log('Split Top Picks layout');

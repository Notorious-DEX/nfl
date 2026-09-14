#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');

const oldBoxStart = '<div id="picksummary" class="scoreboard" style="display: none;">';
const oldBoxEnd = '</div>\n\n        <div id="weekresults"';
const boxAt = text.indexOf(oldBoxStart);
const boxEndAt = text.indexOf(oldBoxEnd, boxAt);
if (boxAt < 0 || boxEndAt < 0) {
    console.error('Could not find picksummary box');
    process.exit(1);
}
const newBox = [
    '<div id="picksummary" class="scoreboard" style="display: none;">',
    '            <h2 id="picks-title" style="margin-bottom: 1rem;">\ud83c\udfaf Top Picks</h2>',
    '            <div id="picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem;"></div>',
    '            <div id="also-week-wrap" style="display: none; margin-top: 1.1rem;">',
    '                <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(148,163,184,0.45), transparent); margin: 0 0 0.9rem;"></div>',
    '                <h3 id="also-week-title" style="margin: 0 0 0.75rem; font-size: 1.05rem; color: #cbd5e1; font-weight: 600;">\ud83d\udccb Also this week</h3>',
    '                <div id="also-picks-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.75rem; opacity: 0.92;"></div>',
    '            </div>',
    '        </div>'
].join('\n');
text = text.slice(0, boxAt) + newBox + text.slice(boxEndAt);

const loopStart = text.indexOf('gamesWithPredictions.forEach(({ prediction, gameId }) => {');
const loopEnd = text.indexOf('picksSummary.style.display = \'block\';', loopStart);
if (loopStart < 0 || loopEnd < 0) {
    console.error('Could not find Top Picks loop');
    process.exit(1);
}
const afterLoop = loopEnd + "picksSummary.style.display = 'block';".length;
const newLoop = [
    'const pickTile = (prediction, gameId) => {',
    '                const teamColor = (TEAM_DATA[prediction.winner] && TEAM_DATA[prediction.winner].color) || "#3498db";',
    '                const loser = prediction.winner === prediction.homeTeam ? prediction.awayTeam : prediction.homeTeam;',
    '                return "<div onclick=\\"document.getElementById(\u0027" + gameId + "\u0027).scrollIntoView({behavior: \u0027smooth\u0027, block: \u0027center\u0027})\\" style=\\"background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 0.5rem; cursor: pointer; border-left: 4px solid " + teamColor + "; transition: all 0.2s;\\" onmouseover=\\"this.style.background=\u0027rgba(255,255,255,0.1)\u0027\\" onmouseout=\\"this.style.background=\u0027rgba(255,255,255,0.05)\u0027\\"><div style=\\"font-weight: bold; font-size: 1.1rem;\\"" + ">" + prediction.winner + "</div><div style=\\"font-size: 0.85rem; opacity: 0.9;\\">over " + loser + "</div><div style=\\"font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;\\"" + ">" + prediction.homeScore + "-" + prediction.awayScore + " \u2022 " + prediction.confidence + "</div></div>";',
    '            };',
    '            const validPicks = gamesWithPredictions.filter(function (row) { return row.prediction && !row.prediction.error; });',
    '            const highPicks = validPicks.filter(function (row) { return String(row.prediction.confidence || "").toLowerCase() === "high"; });',
    '            const otherPicks = validPicks.filter(function (row) { return String(row.prediction.confidence || "").toLowerCase() !== "high"; });',
    '            const picksTitle = document.getElementById("picks-title");',
    '            const alsoWrap = document.getElementById("also-week-wrap");',
    '            const alsoList = document.getElementById("also-picks-list");',
    '            if (alsoList) alsoList.innerHTML = "";',
    '            if (highPicks.length) {',
    '                if (picksTitle) picksTitle.textContent = "\ud83c\udfaf Top Picks";',
    '                highPicks.forEach(function (row) { picksList.innerHTML += pickTile(row.prediction, row.gameId); });',
    '                if (alsoWrap) alsoWrap.style.display = otherPicks.length ? "block" : "none";',
    '                otherPicks.forEach(function (row) { if (alsoList) alsoList.innerHTML += pickTile(row.prediction, row.gameId); });',
    '            } else {',
    '                if (picksTitle) picksTitle.textContent = "\ud83d\udccb This week\u2019s games";',
    '                if (alsoWrap) alsoWrap.style.display = "none";',
    '                otherPicks.forEach(function (row) { picksList.innerHTML += pickTile(row.prediction, row.gameId); });',
    '            }',
    '            picksSummary.style.display = validPicks.length ? "block" : "none";'
].join('\n            ');
text = text.slice(0, loopStart) + newLoop + text.slice(afterLoop);
fs.writeFileSync(file, text);
console.log('Split Top Picks layout');

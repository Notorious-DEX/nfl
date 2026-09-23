#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
text = text.replace(/>v\d+\.\d+</, '>v0.16<');
text = text.replace(
    "document.getElementById('loading').textContent = (cachedData.weekLabel || 'This week') + ' games have concluded. Next week's picks load when the new slate is cached.';",
    'document.getElementById("loading").textContent = (cachedData.weekLabel || "This week") + " games have concluded. Next week picks load when the new slate is cached.";'
);
text = text.replace(
    "document.getElementById('loading').textContent = (cachedData.weekLabel || 'This week') + ' games have concluded. Next week's picks load when the new slate is cached.';",
    'document.getElementById("loading").textContent = (cachedData.weekLabel || "This week") + " games have concluded. Next week picks load when the new slate is cached.";'
);
// generic broken apostrophe line
if (text.includes("Next week's picks")) {
    text = text.replace("Next week's picks", 'Next week picks');
}
text = text.replace('            games = openGames;\n', '            games = openGames.slice();\n');
// displayGames param reassignment: change signature to let-like by copying
text = text.replace(
    'async function displayGames(games, oddsData) {',
    'async function displayGames(gameList, oddsData) {\n            let games = gameList;'
);
fs.writeFileSync(file, text);
console.log('Homepage syntax patched');

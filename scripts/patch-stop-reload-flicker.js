#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');
text = text.replace(/>v\d+\.\d+</, '>v0.13<');

text = text.replace(
    "console.log('📅 All games completed, checking for next week...');\n                            // Trigger a re-fetch of games\n                            setTimeout(() => location.reload(), 2000);",
    "console.log('📅 All listed games are complete. Stopping live refresh.');\n                            if (typeof stopAutoRefresh === 'function') stopAutoRefresh();\n                            const picksSummary = document.getElementById('picksummary');\n                            if (picksSummary) picksSummary.style.display = 'none';"
);

const filter = `            const openGames = games.filter((game) => {
                const status = game.competitions && game.competitions[0] && game.competitions[0].status;
                return !(status && status.type && status.type.completed);
            });
            if (openGames.length === 0) {
                gamesContainer.innerHTML = '<div style="text-align: center; padding: 3rem;">No upcoming games</div>';
                const picksSummary = document.getElementById('picksummary');
                if (picksSummary) picksSummary.style.display = 'none';
                return;
            }
            games = openGames;
`;
if (!text.includes('const openGames = games.filter')) {
    text = text.replace(
        "if (games.length === 0) {\n                gamesContainer.innerHTML = '<div style=\"text-align: center; padding: 3rem;\">No upcoming games</div>';\n                return;\n            }",
        "if (games.length === 0) {\n                gamesContainer.innerHTML = '<div style=\"text-align: center; padding: 3rem;\">No upcoming games</div>';\n                return;\n            }\n" + filter
    );
}

fs.writeFileSync(file, text);
console.log('Stopped completed-game reload flicker');

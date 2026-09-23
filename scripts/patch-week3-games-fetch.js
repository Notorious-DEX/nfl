#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const cacheFile = path.join(__dirname, 'cache-data.js');
let cache = fs.readFileSync(cacheFile, 'utf8');

cache = cache.replace(
    "fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${new Date().getFullYear()}')",
    'fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${new Date().getFullYear()}`)'
);
cache = cache.replace(
    "fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${new Date().getFullYear()}&seasontype=3&week=${playoffWeek}`)",
    'fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${new Date().getFullYear()}&seasontype=3&week=${playoffWeek}`)'
);
cache = cache.replace(
    "fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${new Date().getFullYear()}&seasontype=3&week=${playoffWeek}')",
    'fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${new Date().getFullYear()}&seasontype=3&week=${playoffWeek}`)'
);

const hook = `        if (games.length === 0) {
            const year = new Date().getFullYear();
            for (let week = 1; week <= 18 && games.length === 0; week++) {
                try {
                    const probe = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=' + year + '&seasontype=2&week=' + week);
                    const probeData = await probe.json();
                    const upcoming = (probeData.events || []).filter((event) => event.competitions && event.competitions[0] && event.competitions[0].status && event.competitions[0].status.type && event.competitions[0].status.type.name === 'STATUS_SCHEDULED');
                    if (upcoming.length) {
                        upcoming.forEach((event) => games.push(event));
                        currentWeek = week;
                        console.log('Loaded ' + upcoming.length + ' scheduled games for week ' + week);
                    }
                } catch (e) {}
            }
        }
`;
if (!cache.includes('Loaded ') && cache.includes("console.log(`\u2705 Found ${games.length} games for week ${currentWeek}`);")) {
    cache = cache.replace(
        "console.log(`\u2705 Found ${games.length} games for week ${currentWeek}`);",
        hook + "        console.log(`\u2705 Found ${games.length} games for week ${currentWeek}`);"
    );
} else if (!cache.includes('probe scheduled games') && cache.includes('Found ${games.length} games for week')) {
    cache = cache.replace(
        'console.log(`\u2705 Found ${games.length} games for week ${currentWeek}`);',
        hook + '        console.log(`\u2705 Found ${games.length} games for week ${currentWeek}`);'
    );
}

fs.writeFileSync(cacheFile, cache);

const indexFile = path.join(__dirname, '..', 'index.html');
let index = fs.readFileSync(indexFile, 'utf8');
index = index.replace(/>v\d+\.\d+</, '>v0.15<');
index = index.replace(
    "Week 3 picks load when the new slate is cached.",
    'Next week\'s picks load when the new slate is cached.'
);
index = index.replace(
    '${weekDisplay} games have concluded',
    '${weekDisplay} wrap-up'
);
fs.writeFileSync(indexFile, index);
console.log('Patched week-3 game fetch');

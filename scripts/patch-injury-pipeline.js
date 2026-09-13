#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function mustReplace(file, oldText, next, label) {
    let text = fs.readFileSync(file, 'utf8');
    if (text.includes(next.trim().slice(0, 60)) && !text.includes(oldText.slice(0, 40))) {
        console.log(label + ': already patched');
        return;
    }
    if (!text.includes(oldText)) {
        console.error(label + ': pattern not found in ' + file);
        process.exit(1);
    }
    fs.writeFileSync(file, text.replace(oldText, next));
    console.log(label + ': patched');
}

const cacheFile = path.join(__dirname, '..', 'scripts/cache-data.js');
const cacheOld = `    const injuries = await fetchInjuries(games);`;
const cacheNext = `    const injuryPack = await require('./fetch-injuries').fetchInjuriesWithFallback();
    const injuries = injuryPack.injuries;
    const injuryStatus = injuryPack.status;`;
mustReplace(cacheFile, cacheOld, cacheNext, 'cache fetchInjuries call');

const cacheSaveOld = `        qualityWins
    };`;
const cacheSaveNext = `        qualityWins,
        injuryStatus
    };`;
mustReplace(cacheFile, cacheSaveOld, cacheSaveNext, 'cache injuryStatus field');

const predFile = path.join(__dirname, '..', 'scripts/generate-predictions.body2.js');
const predOld = `                if (prediction && !prediction.error) {
                predictions.push(prediction);`;
const predNext = `                const resultsPath = path.join(__dirname, '..', 'results.json');
                let gradedIds = new Set();
                try {
                    if (require('fs').existsSync(resultsPath)) {
                        const graded = JSON.parse(require('fs').readFileSync(resultsPath, 'utf8'));
                        gradedIds = new Set((graded.games || []).map((g) => String(g.gameId)));
                    }
                } catch (e) {}
                if (gradedIds.has(String(game.id))) {
                    console.log('  Skipping already-graded Week pick ' + game.id);
                    continue;
                }
                if (prediction && !prediction.error) {
                predictions.push(prediction);`;
// The skip should wrap before generate - find a better hook
const predLoopOld = `            for (const game of games) {`;
let predText = fs.readFileSync(predFile, 'utf8');
if (!predText.includes('already-graded Week pick')) {
    const hook = predText.indexOf('for (const game of games)');
    if (hook < 0) {
        console.error('generate-predictions loop not found');
        process.exit(1);
    }
    const inject = `        const resultsPathFreeze = path.join(__dirname, '..', 'results.json');
        let gradedIds = new Set();
        try {
            if (fs.existsSync(resultsPathFreeze)) {
                const graded = JSON.parse(fs.readFileSync(resultsPathFreeze, 'utf8'));
                gradedIds = new Set((graded.games || []).map((g) => String(g.gameId)));
            }
        } catch (e) {}

`;
    predText = predText.slice(0, hook) + inject + predText.slice(hook);
    predText = predText.replace(
        'for (const game of games) {',
        'for (const game of games) {\n            if (gradedIds.has(String(game.id))) {\n                console.log(\'  Keeping stored Week 1+ pick \' + game.id);\n                continue;\n            }'
    );
    fs.writeFileSync(predFile, predText);
    console.log('generate-predictions: freeze graded games');
} else {
    console.log('generate-predictions: already frozen');
}

const indexFile = path.join(__dirname, '..', 'index.html');
let index = fs.readFileSync(indexFile, 'utf8');

if (!index.includes('id="dataSourceNotice"')) {
    index = index.replace(
        '<div class="week-indicator" id="weekIndicator">Loading...</div>',
        '<div class="week-indicator" id="weekIndicator">Loading...</div>\n            <div id="dataSourceNotice" class="data-source-notice" style="display:none;"></div>'
    );
}

if (!index.includes('.data-source-notice')) {
    index = index.replace('</style>', `.data-source-notice{margin:12px 0 0;padding:10px 14px;border-radius:10px;background:rgba(241,196,15,0.12);border:1px solid rgba(241,196,15,0.35);color:#f6e27a;font-size:0.92rem;line-height:1.4;text-align:left;}.data-source-notice.critical{background:rgba(231,76,60,0.12);border-color:rgba(231,76,60,0.4);color:#f5b7b1;}</style>`);
}

const confOld = `            if (confidenceScore >= 14) prediction.confidence = 'High';
            else if (confidenceScore >= 8) prediction.confidence = 'Medium';
            else prediction.confidence = 'Low';

            return prediction;`;
const confNext = `            if (confidenceScore >= 14) prediction.confidence = 'High';
            else if (confidenceScore >= 8) prediction.confidence = 'Medium';
            else prediction.confidence = 'Low';
            if (typeof cachedData !== 'undefined' && cachedData && cachedData.injuryStatus && cachedData.injuryStatus.predictionBreaking) {
                prediction.confidence = 'Low';
                prediction.calculations.push('Injury feed is not the preferred ESPN report; confidence capped at Low');
            }

            return prediction;`;
if (index.includes(confOld)) index = index.replace(confOld, confNext);

if (!index.includes('function renderDataSourceNotice')) {
    const noticeFn = `
        function renderDataSourceNotice() {
            const el = document.getElementById('dataSourceNotice');
            if (!el) return;
            const status = (typeof cachedData !== 'undefined' && cachedData && cachedData.injuryStatus) || null;
            if (!status || !status.degraded) {
                el.style.display = 'none';
                return;
            }
            const missing = (status.missing || []).join(', ') || 'preferred ESPN injury report';
            let text = 'Injury data: ' + missing + ' not found. Using ' + (status.usedLabel || status.used) + '.';
            if (status.predictionBreaking) text += ' Upcoming pick confidence is capped at Low until ESPN is back.';
            el.textContent = text;
            el.className = 'data-source-notice' + (status.predictionBreaking ? ' critical' : '');
            el.style.display = 'block';
        }
`;
    index = index.replace('function generatePrediction', noticeFn + '        function generatePrediction');
}

if (!index.includes('renderDataSourceNotice()')) {
    // call after cache load - hook common cachedData assignment
    if (index.includes('cachedData = data')) {
        index = index.replace('cachedData = data;', 'cachedData = data; renderDataSourceNotice();');
    } else if (index.includes('cachedData = cache')) {
        index = index.replace('cachedData = cache;', 'cachedData = cache; renderDataSourceNotice();');
    }
}

fs.writeFileSync(indexFile, index);
console.log('index injury banner patched');

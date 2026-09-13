#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FN = `function analyzeInjuryImpact(teamName) {
            const teamInjuries = injuries[teamName] || [];
            const seen = new Set();
            const rows = [];
            for (const injury of teamInjuries) {
                const playerName = injury.athlete?.displayName || 'Unknown';
                const key = playerName.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                rows.push(injury);
            }

            let impact = { points: 0, notes: [] };
            let olStartersOut = 0;
            let starterQbOut = false;

            const depth = (injury) => Number(injury.depthChartOrder || injury.depthChartPosition || 99) || 99;
            const statusOf = (injury) => String(injury.status || '').toLowerCase();
            const commentOf = (injury) => String(injury.longComment || '').toLowerCase();
            const isOut = (injury) => statusOf(injury) === 'out' || commentOf(injury).includes('ruled out') || /\\bout\\b/.test(statusOf(injury));
            const isDoubtful = (injury) => statusOf(injury) === 'doubtful' || commentOf(injury).includes('doubtful');
            const isQuestionable = (injury) => statusOf(injury) === 'questionable' || commentOf(injury).includes('questionable');

            for (const injury of rows) {
                const position = (injury.athlete?.position || '').toUpperCase();
                const playerName = injury.athlete?.displayName || 'Unknown';
                const slot = depth(injury);
                const starter = slot === 1;

                if (position === 'QB') {
                    if (starter) {
                        if (isOut(injury)) {
                            impact.points -= 8;
                            starterQbOut = true;
                            impact.notes.push('🏥 ' + playerName + ' (QB1) out (-8 pts)');
                        } else if (isDoubtful(injury)) {
                            impact.points -= 6;
                            impact.notes.push('🏥 ' + playerName + ' (QB1) doubtful (-6 pts)');
                        } else if (isQuestionable(injury)) {
                            impact.points -= 2;
                            impact.notes.push('🏥 ' + playerName + ' (QB1) questionable (-2 pts)');
                        }
                    } else if (starterQbOut) {
                        impact.notes.push('🏥 ' + playerName + ' (QB2) listed; QB1 already applied');
                    } else if (isOut(injury)) {
                        impact.notes.push('🏥 ' + playerName + ' (backup QB) out');
                    }
                    continue;
                }

                if (position === 'RB') {
                    if (starter) {
                        if (isOut(injury)) { impact.points -= 4; impact.notes.push('🏥 ' + playerName + ' (RB1) out (-4 pts)'); }
                        else if (isDoubtful(injury)) { impact.points -= 3; impact.notes.push('🏥 ' + playerName + ' (RB1) doubtful (-3 pts)'); }
                        else if (isQuestionable(injury)) { impact.points -= 1; impact.notes.push('🏥 ' + playerName + ' (RB1) questionable (-1 pt)'); }
                    } else if (isOut(injury)) {
                        impact.notes.push('🏥 ' + playerName + ' (backup RB) out');
                    }
                    continue;
                }

                if (position === 'WR' || position === 'TE') {
                    if (slot === 1) {
                        if (isOut(injury)) { impact.points -= 3; impact.notes.push('🏥 ' + playerName + ' (' + position + '1) out (-3 pts)'); }
                        else if (isDoubtful(injury)) { impact.points -= 2; impact.notes.push('🏥 ' + playerName + ' (' + position + '1) doubtful (-2 pts)'); }
                        else if (isQuestionable(injury)) { impact.points -= 1; impact.notes.push('🏥 ' + playerName + ' (' + position + '1) questionable (-1 pt)'); }
                    } else if (slot === 2) {
                        if (isOut(injury)) { impact.points -= 1.5; impact.notes.push('🏥 ' + playerName + ' (' + position + '2) out (-1.5 pts)'); }
                        else if (isDoubtful(injury)) { impact.points -= 1; impact.notes.push('🏥 ' + playerName + ' (' + position + '2) doubtful (-1 pt)'); }
                    } else if (isOut(injury)) {
                        impact.notes.push('🏥 ' + playerName + ' (depth ' + position + ') out');
                    }
                    continue;
                }

                if (position === 'OL' || position === 'T' || position === 'G' || position === 'C' || position === 'OT' || position === 'OG') {
                    if (starter && (isOut(injury) || isDoubtful(injury))) {
                        olStartersOut += isOut(injury) ? 1 : 0.5;
                        impact.notes.push('🏥 ' + playerName + ' (OL starter) ' + (isOut(injury) ? 'out' : 'doubtful'));
                    } else if (isOut(injury)) {
                        impact.notes.push('🏥 ' + playerName + ' (backup OL) out');
                    }
                    continue;
                }

                if ((position === 'CB' || position === 'S') && isOut(injury)) {
                    impact.notes.push('ℹ️ ' + playerName + ' (' + position + ') out');
                }
            }

            if (olStartersOut >= 3) impact.points -= 5;
            else if (olStartersOut >= 2) impact.points -= 3;
            else if (olStartersOut >= 1) impact.points -= 1.5;

            if (impact.points < -11) {
                impact.notes.push('Injury cap applied (max -11 pts)');
                impact.points = -11;
            }
            return impact;
        }`;

function replaceFn(file, indent) {
    let text = fs.readFileSync(file, 'utf8');
    const re = /function analyzeInjuryImpact\([\s\S]*?return impact;\n\s*\}/;
    if (!re.test(text)) {
        console.error('Could not find analyzeInjuryImpact in ' + file);
        process.exit(1);
    }
    let next = FN;
    if (indent === 0) next = FN.replace(/^            /gm, '    ').replace(/^        \}/, '}');
    text = text.replace(re, next);
    fs.writeFileSync(file, text);
    console.log('Patched injury weights in ' + path.basename(file));
}

replaceFn(path.join(__dirname, '..', 'index.html'), 8);
replaceFn(path.join(__dirname, '..', 'scripts/generate-predictions.body1.js'), 0);

const body2 = path.join(__dirname, '..', 'scripts/generate-predictions.body2.js');
let pred = fs.readFileSync(body2, 'utf8');
if (!pred.includes('Skipping live/finished game')) {
    pred = pred.replace(
        'if (gradedIds.has(String(game.id))) {',
        `const gameState = game.competitions && game.competitions[0] && game.competitions[0].status && game.competitions[0].status.type && game.competitions[0].status.type.state;
            if (gameState === 'in' || gameState === 'post') {
                console.log('  Skipping live/finished game ' + game.id);
                continue;
            }
            if (gradedIds.has(String(game.id))) {`
    );
    fs.writeFileSync(body2, pred);
    console.log('Patched live/finished skip in generator');
} else {
    console.log('Live/finished skip already present');
}

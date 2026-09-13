#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { fetch } = require('./espn-fetch');

const CACHE_PATH = path.join(__dirname, '..', 'cached-data.json');
const ESPN_INJURIES = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries';
const ESPN_TEAM_INJURIES = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/TEAM/injuries';
const ESPN_DEPTH = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/TEAM/depthcharts';
const SLEEPER_PLAYERS = 'https://api.sleeper.app/v1/players/nfl';

const TEAM_ABBREV = {
    ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
    CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
    DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
    HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
    LV: 'Las Vegas Raiders', LAC: 'Los Angeles Chargers', LAR: 'Los Angeles Rams', MIA: 'Miami Dolphins',
    MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
    NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SF: 'San Francisco 49ers',
    SEA: 'Seattle Seahawks', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
    WSH: 'Washington Commanders'
};

const ACTIONABLE = new Set(['out', 'doubtful', 'questionable', 'injured reserve', 'ir', 'pup']);

function teamNameFromAbbrev(abbrev) {
    return TEAM_ABBREV[String(abbrev || '').toUpperCase()] || null;
}

function isActionableStatus(status) {
    const s = String(status || '').toLowerCase();
    return ACTIONABLE.has(s) || s.includes('out') || s.includes('doubt') || s.includes('question');
}

function isCoachDecision(injury) {
    const blob = JSON.stringify(injury.details || {}) + ' ' + (injury.longComment || '') + ' ' + (injury.shortComment || '');
    return /coach'?s decision|emergency third|third quarterback|inactive as the emergency/i.test(blob);
}

function normalizeRow(teamName, raw) {
    const athlete = raw.athlete || {};
    const position = (athlete.position && (athlete.position.abbreviation || athlete.position.displayName)) || athlete.position || '';
    return {
        longComment: raw.longComment || raw.shortComment || raw.status || '',
        status: raw.status || '',
        athlete: {
            displayName: athlete.displayName || [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || 'Unknown',
            position: String(position || '').toUpperCase()
        },
        depthChartPosition: raw.depthChartPosition || null,
        depthChartOrder: raw.depthChartOrder || null,
        source: raw.sourceName || raw.source || null
    };
}

function countTeams(injuries) {
    return Object.keys(injuries || {}).length;
}

function hasStarterQbIssue(injuries) {
    for (const rows of Object.values(injuries || {})) {
        for (const row of rows || []) {
            const pos = String(row.athlete && row.athlete.position || '').toUpperCase();
            if (pos !== 'QB') continue;
            const starter = row.depthChartOrder === 1 || row.depthChartPosition === 1;
            const status = String(row.status || '').toLowerCase();
            if (starter && (status === 'out' || status === 'doubtful' || status.includes('out'))) return true;
        }
    }
    return false;
}

async function fetchTextJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json();
    return data;
}

async function loadDepthStarters() {
    const starters = new Map();
    const ids = [];
    try {
        const teams = await fetchTextJson('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=50');
        const list = (((teams.sports || [])[0] || {}).leagues || [])[0] || {};
        for (const team of list.teams || []) {
            const id = team.team && team.team.id;
            if (id) ids.push(id);
        }
    } catch (_) {}
    const fallbackIds = Array.from({ length: 34 }, (_, i) => String(i + 1));
    const useIds = ids.length ? ids : fallbackIds;
    for (const id of useIds) {
        try {
            const chart = await fetchTextJson(ESPN_DEPTH.replace('TEAM', id));
            const teamName = chart.team && chart.team.displayName;
            const groups = chart.depthchart || [];
            for (const group of groups) {
                const qb = group.positions && (group.positions.qb || group.positions.QB);
                const first = qb && qb.athletes && qb.athletes[0];
                if (teamName && first && first.displayName) {
                    starters.set(teamName + '|' + first.displayName, 1);
                }
            }
        } catch (_) {}
    }
    return starters;
}

function applyStarters(injuries, starters) {
    for (const [team, rows] of Object.entries(injuries)) {
        for (const row of rows) {
            const name = row.athlete && row.athlete.displayName;
            if (name && starters.get(team + '|' + name)) {
                row.depthChartPosition = 1;
                row.depthChartOrder = 1;
            }
        }
    }
}

function parseEspnPayload(data) {
    const injuries = {};
    const groups = data.injuries || data.teams || [];
    for (const group of groups) {
        const teamName = group.displayName || (group.team && (group.team.displayName || group.team.name));
        if (!teamName) continue;
        injuries[teamName] = [];
        for (const raw of group.injuries || []) {
            if (!isActionableStatus(raw.status)) continue;
            if (isCoachDecision(raw)) continue;
            injuries[teamName].push(normalizeRow(teamName, raw));
        }
    }
    return injuries;
}

async function fetchEspnLeague() {
    const data = await fetchTextJson(ESPN_INJURIES);
    const injuries = parseEspnPayload(data);
    if (countTeams(injuries) < 20) throw new Error('ESPN league injuries only covered ' + countTeams(injuries) + ' teams');
    return injuries;
}

async function fetchEspnByTeam() {
    const injuries = {};
    for (let id = 1; id <= 34; id++) {
        try {
            const data = await fetchTextJson(ESPN_TEAM_INJURIES.replace('TEAM', String(id)));
            const parsed = parseEspnPayload(data.injuries ? data : { injuries: data.teams || [data] });
            Object.assign(injuries, parsed);
        } catch (_) {}
    }
    if (countTeams(injuries) < 16) throw new Error('ESPN team-by-team injuries only covered ' + countTeams(injuries) + ' teams');
    return injuries;
}

async function fetchSleeper() {
    const response = await fetch(SLEEPER_PLAYERS, { headers: { Accept: 'application/json' } });
    const players = await response.json();
    if (!players || typeof players !== 'object') throw new Error('Sleeper returned no player map');
    const injuries = {};
    for (const player of Object.values(players)) {
        if (!player || !player.injury_status || player.injury_status === 'Healthy' || !player.team) continue;
        if (!isActionableStatus(player.injury_status)) continue;
        const teamName = teamNameFromAbbrev(player.team);
        if (!teamName) continue;
        if (!injuries[teamName]) injuries[teamName] = [];
        injuries[teamName].push({
            longComment: player.injury_notes || player.injury_body_part || player.injury_status,
            status: player.injury_status,
            athlete: {
                displayName: `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown',
                position: player.position || ''
            },
            depthChartPosition: player.depth_chart_position || null,
            depthChartOrder: player.depth_chart_order || null,
            source: 'sleeper'
        });
    }
    if (countTeams(injuries) < 16) throw new Error('Sleeper only covered ' + countTeams(injuries) + ' teams');
    return injuries;
}

function loadSnapshot() {
    if (!fs.existsSync(CACHE_PATH)) throw new Error('No cached-data.json snapshot');
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const injuries = cache.injuries || {};
    if (countTeams(injuries) < 8) throw new Error('Snapshot injuries too thin');
    return { injuries, snapshotAt: cache.lastUpdated || cache.injuryStatus && cache.injuryStatus.checkedAt || null };
}

function writeStatus(status) {
    const dest = path.join(__dirname, '..', 'data', 'injury-status.json');
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(status, null, 2));
}

async function fetchInjuriesWithFallback() {
    const attempts = [];
    let chosen = null;
    let starters = new Map();
    try {
        starters = await loadDepthStarters();
        attempts.push({ source: 'ESPN depth charts', ok: starters.size > 0, detail: starters.size + ' starter QB rows' });
    } catch (error) {
        attempts.push({ source: 'ESPN depth charts', ok: false, detail: error.message });
    }

    const sources = [
        { name: 'espn', label: 'ESPN league injuries', run: fetchEspnLeague },
        { name: 'espn-teams', label: 'ESPN team injury pages', run: fetchEspnByTeam },
        { name: 'sleeper', label: 'Sleeper player feed', run: fetchSleeper }
    ];

    for (const source of sources) {
        try {
            const injuries = await source.run();
            applyStarters(injuries, starters);
            attempts.push({ source: source.label, ok: true, detail: countTeams(injuries) + ' teams' });
            chosen = { used: source.name, label: source.label, injuries };
            break;
        } catch (error) {
            attempts.push({ source: source.label, ok: false, detail: error.message });
        }
    }

    if (!chosen) {
        try {
            const snap = loadSnapshot();
            attempts.push({ source: 'Last cache snapshot', ok: true, detail: countTeams(snap.injuries) + ' teams from ' + (snap.snapshotAt || 'unknown') });
            chosen = { used: 'cache-snapshot', label: 'Last saved injury snapshot', injuries: snap.injuries, snapshotAt: snap.snapshotAt };
        } catch (error) {
            attempts.push({ source: 'Last cache snapshot', ok: false, detail: error.message });
        }
    }

    const usedPreferred = chosen && (chosen.used === 'espn' || chosen.used === 'espn-teams');
    const missing = attempts.filter((a) => !a.ok).map((a) => a.source);
    const predictionBreaking = !chosen || chosen.used === 'cache-snapshot' || chosen.used === 'none' || (chosen.used === 'sleeper' && hasStarterQbIssue(chosen.injuries));
    const status = {
        preferred: 'ESPN injury report',
        used: chosen ? chosen.used : 'none',
        usedLabel: chosen ? chosen.label : 'none',
        ok: Boolean(chosen),
        degraded: !usedPreferred,
        predictionBreaking: Boolean(predictionBreaking),
        missing,
        attempts,
        teams: chosen ? countTeams(chosen.injuries) : 0,
        snapshotAt: chosen && chosen.snapshotAt || null,
        checkedAt: new Date().toISOString(),
        detail: !chosen
            ? 'ESPN and Sleeper failed; no snapshot available. Injury adjustments are off.'
            : usedPreferred
                ? 'Using ESPN injury report.'
                : 'Preferred ESPN feed unavailable. Using ' + chosen.label + (chosen.snapshotAt ? ' (' + chosen.snapshotAt + ')' : '') + '.'
    };
    writeStatus(status);
    console.log(status.detail);
    status.attempts.forEach((attempt) => {
        console.log((attempt.ok ? '  ok ' : '  miss ') + attempt.source + ': ' + attempt.detail);
    });
    return { injuries: chosen ? chosen.injuries : {}, status };
}

module.exports = { fetchInjuriesWithFallback };

if (require.main === module) {
    fetchInjuriesWithFallback().then((result) => {
        console.log('Teams with injuries:', Object.keys(result.injuries).length);
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

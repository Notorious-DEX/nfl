#!/usr/bin/env node

/**
 * Preseason-only lookup of Vegas regular-season win totals.
 * Does not run during the regular season unless --force is passed.
 */

const fs = require('fs');
const path = require('path');
const { fetch } = require('./espn-fetch');
const { loadCalendar } = require('./season-calendar');

const TEAM_NAMES = [
    'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
    'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
    'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
    'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
    'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
    'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
    'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
    'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders'
];

const ALIASES = {
    'LA Rams': 'Los Angeles Rams',
    'L.A. Rams': 'Los Angeles Rams',
    'LAR': 'Los Angeles Rams',
    'LA Chargers': 'Los Angeles Chargers',
    'L.A. Chargers': 'Los Angeles Chargers',
    'LAC': 'Los Angeles Chargers',
    'NY Giants': 'New York Giants',
    'N.Y. Giants': 'New York Giants',
    'NYG': 'New York Giants',
    'NY Jets': 'New York Jets',
    'N.Y. Jets': 'New York Jets',
    'NYJ': 'New York Jets',
    'Washington': 'Washington Commanders',
    'Washington Football Team': 'Washington Commanders',
    'WFT': 'Washington Commanders',
    'Jax Jaguars': 'Jacksonville Jaguars',
    'JAC Jaguars': 'Jacksonville Jaguars'
};

function normalizeTeam(name) {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (TEAM_NAMES.includes(clean)) return clean;
    if (ALIASES[clean]) return ALIASES[clean];
    const nick = TEAM_NAMES.find((full) => full.endsWith(' ' + clean) || full === clean);
    return nick || clean;
}

function decode(html) {
    return String(html || '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
}

function stripTags(html) {
    return decode(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function extractTotals(html) {
    const totals = {};
    const boyd = /<td class="bbw-wt-team"><b>([^<]+)<\/b><\/td>\s*<td class="bbw-r bbw-wt-total">([0-9.]+)<\/td>/g;
    let match;
    while ((match = boyd.exec(html))) {
        totals[normalizeTeam(match[1])] = Number(match[2]);
    }

    const text = stripTags(html);
    TEAM_NAMES.forEach((team) => {
        if (totals[team]) return;
        const re = new RegExp(team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(?:O\/?U\\s+)?([0-9]+\\.5)\\b');
        const hit = text.match(re);
        if (hit) totals[team] = Number(hit[1]);
    });

    const listItem = /<(?:li|td|th)[^>]*>\s*(?:<[^>]+>)*\s*([A-Z][A-Za-z .']+?)\s*(?:<\/[^>]+>)*\s*([0-9]+\.5)/g;
    while ((match = listItem.exec(html))) {
        const team = normalizeTeam(match[1]);
        if (TEAM_NAMES.includes(team) && totals[team] == null) totals[team] = Number(match[2]);
    }
    return totals;
}

function isComplete(totals) {
    return TEAM_NAMES.filter((team) => Number.isFinite(totals[team])).length >= 28;
}

async function fetchText(url) {
    const response = await fetch(url, { headers: { Accept: 'text/html,application/json' } });
    const text = await response.text();
    if (!text || text.length < 400) throw new Error('empty body from ' + url);
    return text;
}

async function searchCandidateUrls(year) {
    const query = encodeURIComponent(year + ' NFL season win totals BetMGM DraftKings');
    const html = await fetchText('https://html.duckduckgo.com/html/?q=' + query);
    const urls = [];
    const re = /uddg=([^&"']+)/g;
    let match;
    while ((match = re.exec(html))) {
        try {
            const url = decodeURIComponent(match[1]);
            if (/^https?:\/\//.test(url) && !/duckduckgo|youtube|twitter|x\.com/.test(url)) urls.push(url);
        } catch (_) {}
    }
    const href = /class="result__a"[^>]*href="(https?:\/\/[^\"]+)"/g;
    while ((match = href.exec(html))) urls.push(match[1]);
    return [...new Set(urls)].slice(0, 6);
}

function writeStatus(status) {
    const dest = path.join(__dirname, '..', 'data', 'win-totals-status.json');
    fs.writeFileSync(dest, JSON.stringify(status, null, 2));
    status.attempts.forEach((attempt) => {
        const level = attempt.ok ? 'notice' : 'warning';
        console.log(`::${level} title=Win totals ${attempt.source}::${attempt.detail}`);
    });
    if (status.ok) console.log('::notice title=Win totals ready::' + status.source);
    else console.log('::error title=Win totals lookup failed::' + status.detail);
}

async function openNoticeIssue(year, status) {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    if (!token || !repo) return;
    const title = 'Win totals lookup failed for ' + year;
    const body = [
        'Preseason prep could not find Vegas season win totals.',
        '',
        '- Season: ' + year,
        '- Detail: ' + status.detail,
        '- Attempts:',
        ...status.attempts.map((attempt) => `  - ${attempt.source}: ${attempt.detail}`),
        '',
        'Jobs kept last year\'s file. Drop a new `data/' + year + '-win-totals.json` or rerun cache-data after kickoff week if a board is posted.'
    ].join('\n');
    try {
        await fetch('https://api.github.com/repos/' + repo + '/issues', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, body, labels: ['win-totals'] })
        });
        console.log('Opened GitHub issue for failed win-total lookup');
    } catch (error) {
        console.log('Could not open GitHub issue:', error.message);
    }
}

async function main() {
    const calendar = loadCalendar() || {};
    const force = process.argv.includes('--force');
    const allowed = ['prep', 'preseason'].includes(calendar.phase);
    if (!force && !allowed) {
        console.log('Skipping win-total fetch until preseason prep (phase=' + (calendar.phase || 'unknown') + ')');
        return;
    }

    const year = calendar.upcomingSeason || calendar.seasonYear;
    const sources = [
        { name: 'Boyd\'s Bets consensus', url: 'https://www.boydsbets.com/nfl-season-win-totals/' },
        { name: 'Vegas Insider', url: 'https://www.vegasinsider.com/nfl/odds/win-totals/' },
        { name: 'OddsShark', url: 'https://www.oddsshark.com/nfl/win-totals' }
    ];

    const attempts = [];
    let chosen = null;

    for (const source of sources) {
        try {
            const html = await fetchText(source.url);
            const winTotals = extractTotals(html);
            const count = Object.keys(winTotals).length;
            const ok = isComplete(winTotals);
            attempts.push({ source: source.name, url: source.url, ok, detail: ok ? ('parsed ' + count + ' teams') : ('only parsed ' + count + ' teams') });
            if (ok && !chosen) chosen = { source: source.name, url: source.url, winTotals };
        } catch (error) {
            attempts.push({ source: source.name, url: source.url, ok: false, detail: error.message });
        }
    }

    if (!chosen) {
        try {
            const found = await searchCandidateUrls(year);
            for (const url of found) {
                try {
                    const html = await fetchText(url);
                    const winTotals = extractTotals(html);
                    const count = Object.keys(winTotals).length;
                    const ok = isComplete(winTotals);
                    attempts.push({ source: 'Search: ' + url, url, ok, detail: ok ? ('parsed ' + count + ' teams') : ('only parsed ' + count + ' teams') });
                    if (ok) {
                        chosen = { source: 'Web search ' + url, url, winTotals };
                        break;
                    }
                } catch (error) {
                    attempts.push({ source: 'Search: ' + url, url, ok: false, detail: error.message });
                }
            }
            if (!found.length) attempts.push({ source: 'Web search', url: null, ok: false, detail: 'no candidate pages returned' });
        } catch (error) {
            attempts.push({ source: 'Web search', url: null, ok: false, detail: error.message });
        }
    }

    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    if (!chosen) {
        const status = {
            ok: false,
            season: year,
            source: null,
            detail: 'All win-total sources failed; keeping the last saved file',
            attempts,
            checkedAt: new Date().toISOString()
        };
        writeStatus(status);
        await openNoticeIssue(year, status);
        return;
    }

    const payload = {
        season: year,
        source: chosen.source + ' as of ' + new Date().toISOString().slice(0, 10),
        notes: 'Auto-fetched during preseason prep. Used only as an early-season prior.',
        games: 17,
        fetchedAt: new Date().toISOString(),
        winTotals: chosen.winTotals
    };
    fs.writeFileSync(path.join(dataDir, year + '-win-totals.json'), JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(dataDir, 'win-totals.json'), JSON.stringify(payload, null, 2));
    writeStatus({
        ok: true,
        season: year,
        source: chosen.source,
        url: chosen.url,
        teams: Object.keys(chosen.winTotals).length,
        detail: 'Saved data/' + year + '-win-totals.json',
        attempts,
        checkedAt: new Date().toISOString()
    });
    console.log('Saved win totals for ' + year + ' from ' + chosen.source);
}

main().catch((error) => {
    console.error('Win-total fetch crashed:', error.message);
    process.exit(0);
});

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { fetchJson, currentNflSeasonYear } = require('./espn-fetch');

const CALENDAR_PATH = path.join(__dirname, '..', 'data', 'season-calendar.json');
const PREP_DAYS = 7;
const SUPER_BOWL_GRACE_MS = 4 * 60 * 60 * 1000;
const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

function iso(date) {
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function addDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function weekLabel(phase, weekNumber, seasonType) {
    if (phase === 'offseason') return 'Offseason';
    if (phase === 'prep') return 'Preseason Prep';
    if (phase === 'preseason' || seasonType === 1) return 'Preseason';
    if (seasonType === 3 || (weekNumber && weekNumber > 18)) {
        const playoff = weekNumber > 18 ? weekNumber : weekNumber + 18;
        return { 19: 'Wild Card Round', 20: 'Divisional Round', 21: 'Conference Championships', 22: 'Super Bowl' }[playoff] || 'Playoffs';
    }
    if (weekNumber) return 'Week ' + weekNumber;
    return 'Regular Season';
}

async function firstGameDate(year, seasonType, week) {
    const data = await fetchJson(SCOREBOARD + '?dates=' + year + '&seasontype=' + seasonType + '&week=' + week);
    const dates = (data.events || []).map((e) => new Date(e.date)).filter((d) => !Number.isNaN(d.getTime()));
    if (!dates.length) return { date: null, events: data.events || [], raw: data };
    dates.sort((a, b) => a - b);
    return { date: dates[0], last: dates[dates.length - 1], events: data.events || [], raw: data };
}

async function lastPostseasonGame(year) {
    let last = null;
    let lastWeek = null;
    for (let week = 1; week <= 5; week++) {
        try {
            const result = await firstGameDate(year, 3, week);
            if (!result.events.length) continue;
            lastWeek = week;
            const end = result.last || result.date;
            if (end && (!last || end > last)) last = end;
        } catch (error) {
            break;
        }
    }
    return { last, lastWeek };
}

function fallbackCalendar(now = new Date()) {
    const seasonYear = currentNflSeasonYear(now);
    const month = now.getMonth();
    let phase = 'regular';
    if (month >= 2 && month <= 6) phase = 'offseason';
    else if (month === 7) phase = 'prep';
    else if (month === 1) phase = 'playoffs';
    return {
        updated: now.toISOString(), source: 'month-fallback', seasonYear,
        upcomingSeason: month >= 2 && month <= 7 ? seasonYear + 1 : seasonYear,
        espnSeasonType: null, espnWeek: null, superBowlEnd: null, kickoff: null, resumeAt: null,
        phase, active: phase !== 'offseason', rebuild: phase === 'prep', freeze: false,
        weekLabel: weekLabel(phase, null, null)
    };
}

function decide(now, draft) {
    const kickoff = draft.kickoff ? new Date(draft.kickoff) : null;
    const superBowlEnd = draft.superBowlEnd ? new Date(draft.superBowlEnd) : null;
    const resumeAt = kickoff ? addDays(kickoff, -PREP_DAYS) : null;
    const seasonType = draft.espnSeasonType;
    let phase = draft.phase || 'regular';
    if (seasonType === 3) {
        phase = (superBowlEnd && now.getTime() >= superBowlEnd.getTime() + SUPER_BOWL_GRACE_MS) ? 'offseason' : 'playoffs';
    } else if (seasonType === 2) {
        phase = 'regular';
    } else if (seasonType === 1) {
        phase = (resumeAt && now < resumeAt) ? 'offseason' : ((kickoff && now < kickoff) ? 'preseason' : 'regular');
    } else if (superBowlEnd && now.getTime() >= superBowlEnd.getTime() + SUPER_BOWL_GRACE_MS && (!kickoff || now < resumeAt)) {
        phase = 'offseason';
    } else if (resumeAt && kickoff && now >= resumeAt && now < kickoff) {
        phase = 'prep';
    }
    draft.resumeAt = iso(resumeAt);
    draft.phase = phase;
    draft.active = phase !== 'offseason';
    draft.rebuild = phase === 'prep' || phase === 'preseason';
    draft.freeze = phase === 'offseason' && !!superBowlEnd;
    draft.weekLabel = weekLabel(phase, draft.espnWeek, seasonType);
    draft.upcomingSeason = (phase === 'offseason' || phase === 'prep' || phase === 'preseason')
        ? (kickoff ? kickoff.getUTCFullYear() : draft.seasonYear + 1)
        : draft.seasonYear;
    return draft;
}

async function buildCalendar(now = new Date()) {
    const draft = fallbackCalendar(now);
    try {
        const live = await fetchJson(SCOREBOARD);
        draft.source = 'espn-scoreboard';
        draft.espnSeasonType = live.season && live.season.type || live.week && live.week.type || null;
        draft.espnWeek = live.week && live.week.number || null;
        if (live.season && live.season.year) draft.seasonYear = Number(live.season.year);
        const seasonYear = draft.seasonYear;
        const nextYear = draft.espnSeasonType === 3 && now.getMonth() <= 6 ? seasonYear + 1 : seasonYear;
        try {
            const kick = await firstGameDate(nextYear, 2, 1);
            if (kick.date) draft.kickoff = iso(kick.date);
        } catch (error) {
            try {
                const kick = await firstGameDate(seasonYear + 1, 2, 1);
                if (kick.date) draft.kickoff = iso(kick.date);
            } catch (_) {}
        }
        const postYear = draft.espnSeasonType === 3 ? seasonYear : seasonYear - 1;
        try {
            const post = await lastPostseasonGame(postYear);
            if (post.last) {
                draft.superBowlEnd = iso(new Date(post.last.getTime() + 3.5 * 60 * 60 * 1000));
                draft.superBowlWeek = post.lastWeek;
            }
        } catch (_) {}
        return decide(now, draft);
    } catch (error) {
        draft.source = 'fallback-after-error';
        draft.error = error.message;
        return decide(now, draft);
    }
}

function loadCalendar() {
    if (!fs.existsSync(CALENDAR_PATH)) return null;
    return JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf8'));
}

function saveCalendar(calendar) {
    const dir = path.dirname(CALENDAR_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CALENDAR_PATH, JSON.stringify(calendar, null, 2));
    return CALENDAR_PATH;
}

async function updateCalendar() {
    const calendar = await buildCalendar();
    saveCalendar(calendar);
    return calendar;
}

module.exports = { CALENDAR_PATH, PREP_DAYS, buildCalendar, updateCalendar, loadCalendar, saveCalendar, weekLabel, currentNflSeasonYear };

if (require.main === module) {
    updateCalendar().then((calendar) => console.log(JSON.stringify(calendar, null, 2))).catch((error) => { console.error(error); process.exit(1); });
}

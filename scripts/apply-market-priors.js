#!/usr/bin/env node

/**
 * Early-season prior: keep last season's stat *shape*, move each team's
 * scoring level toward Vegas win totals (roster/market expectation).
 *
 * Fade by current NFL week, not last season's gamesPlayed.
 * Week 1 → full market weight. After ~6 weeks → current box scores only.
 */

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '..', 'cached-data.json');
const TOTALS_PATH = path.join(__dirname, '..', 'data', '2026-win-totals.json');

const LEAGUE_AVERAGE_WINS = 8.5;
const POINTS_PER_WIN = 1.5;
const FADE_WEEKS = 6;

function marketWeight(currentWeek) {
    const week = Number(currentWeek) || 1;
    if (week <= 1) return 1;
    return Math.max(0, 1 - (week - 1) / FADE_WEEKS);
}

function applyPriors(leagueStats, winTotals, weight) {
    const teams = leagueStats.teams || {};
    const adjustments = {};

    if (weight === 0) {
        return { leagueStats, weight, adjustments };
    }

    for (const [team, stats] of Object.entries(teams)) {
        const marketWins = winTotals[team];
        if (marketWins == null || stats.offensiveRating == null || stats.defensiveRating == null) {
            continue;
        }

        const lastYearMargin = stats.offensiveRating - stats.defensiveRating;
        const marketMargin = (marketWins - LEAGUE_AVERAGE_WINS) * POINTS_PER_WIN;
        const delta = (marketMargin - lastYearMargin) * weight;

        stats.offensiveRating = Number((stats.offensiveRating + delta / 2).toFixed(2));
        stats.defensiveRating = Number((stats.defensiveRating - delta / 2).toFixed(2));
        if (stats.ppg) stats.ppg = stats.offensiveRating.toFixed(1);
        if (stats.papg) stats.papg = stats.defensiveRating.toFixed(1);

        adjustments[team] = {
            marketWins,
            lastYearMargin: Number(lastYearMargin.toFixed(2)),
            marketMargin: Number(marketMargin.toFixed(2)),
            appliedDelta: Number(delta.toFixed(2))
        };
    }

    leagueStats.hasData = Object.keys(teams).length > 0;
    return { leagueStats, weight, adjustments };
}

function main() {
    if (!fs.existsSync(CACHE_PATH)) {
        console.error('cached-data.json not found');
        process.exit(1);
    }
    if (!fs.existsSync(TOTALS_PATH)) {
        console.error('data/2026-win-totals.json not found');
        process.exit(1);
    }

    const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const totalsFile = JSON.parse(fs.readFileSync(TOTALS_PATH, 'utf8'));
    const weight = marketWeight(cached.currentWeek);
    const result = applyPriors(
        cached.leagueStats || { teams: {}, rankings: {}, hasData: false },
        totalsFile.winTotals || {},
        weight
    );

    cached.leagueStats = result.leagueStats;
    cached.marketPriors = {
        source: totalsFile.source,
        currentWeek: cached.currentWeek,
        weight: Number(result.weight.toFixed(3)),
        pointsPerWin: POINTS_PER_WIN,
        adjustments: result.adjustments
    };

    fs.writeFileSync(CACHE_PATH, JSON.stringify(cached, null, 2));

    const shifted = Object.values(result.adjustments).filter((a) => Math.abs(a.appliedDelta) >= 0.5).length;
    console.log(`✅ Market priors applied (week ${cached.currentWeek || '?'}, weight ${result.weight.toFixed(2)})`);
    console.log(`   ${shifted} teams moved by at least 0.5 PPG of margin`);
    const rams = result.adjustments['Los Angeles Rams'];
    if (rams) {
        console.log(`   Rams example: last-year margin ${rams.lastYearMargin} → market ${rams.marketMargin} (delta ${rams.appliedDelta})`);
    }
}

main();

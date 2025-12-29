/**
 * Shared Prediction Engine
 * EXACT same algorithm as index.html - used by both generate-predictions.js and backtest.js
 */

// Analyze injury impact - EXACT copy from index.html
function analyzeInjuryImpact(teamName, injuries) {
    const teamInjuries = injuries[teamName] || [];
    let impact = { points: 0, notes: [] };

    for (const injury of teamInjuries) {
        const position = (injury.athlete?.position || '').toUpperCase();
        const playerName = injury.athlete?.displayName || 'Unknown';
        const status = (injury.status || '').toLowerCase();
        const comment = (injury.longComment || '').toLowerCase();

        // QB injuries - huge impact (only for starters)
        if (position === 'QB') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;

            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 8;
                    impact.notes.push(`🏥 ${playerName} (QB) out (-8 pts)`);
                } else if (status === 'questionable' || status === 'doubtful') {
                    impact.points -= 4;
                    impact.notes.push(`🏥 ${playerName} (QB) ${status} (-4 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup QB) out`);
            }
        }

        // RB injuries
        else if (position === 'RB') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;

            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 4;
                    impact.notes.push(`🏥 ${playerName} (RB) out (-4 pts)`);
                } else if (status === 'questionable' || status === 'doubtful') {
                    impact.points -= 2;
                    impact.notes.push(`🏥 ${playerName} (RB) ${status} (-2 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup RB) out`);
            }
        }

        // WR/TE injuries
        else if (position === 'WR' || position === 'TE') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;

            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 3;
                    impact.notes.push(`🏥 ${playerName} (${position}) out (-3 pts)`);
                } else if (status === 'questionable' || status === 'doubtful') {
                    impact.points -= 1.5;
                    impact.notes.push(`🏥 ${playerName} (${position}) ${status} (-1.5 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup ${position}) out`);
            }
        }

        // Offensive line
        else if (position === 'OL' || position === 'T' || position === 'G' || position === 'C') {
            const isStarter = injury.depthChartPosition === 1 || injury.depthChartOrder === 1;

            if (isStarter) {
                if (status === 'out' || comment.includes('out')) {
                    impact.points -= 2;
                    impact.notes.push(`🏥 ${playerName} (OL) out (-2 pts)`);
                }
            } else if (status === 'out' || comment.includes('out')) {
                impact.notes.push(`🏥 ${playerName} (Backup OL) out`);
            }
        }

        // Defensive players
        else if ((position === 'CB' || position === 'S') && (status === 'out' || comment.includes('out'))) {
            impact.notes.push(`ℹ️ ${playerName} (${position}) out`);
        }
    }

    return impact;
}

// Generate prediction - EXACT copy from index.html
function generatePrediction(game, weather, leagueStats, injuries, qualityWins, eloRatings) {
    const competition = game.competitions[0];
    const homeComp = competition.competitors.find(c => c.homeAway === 'home');
    const awayComp = competition.competitors.find(c => c.homeAway === 'away');

    const homeTeam = homeComp.team.displayName;
    const awayTeam = awayComp.team.displayName;

    // Check if we have real data for both teams
    const homeStats = leagueStats.teams[homeTeam];
    const awayStats = leagueStats.teams[awayTeam];
    const homeRankings = leagueStats.rankings[homeTeam];
    const awayRankings = leagueStats.rankings[awayTeam];

    // If missing data, skip prediction
    if (!homeStats || !awayStats || !homeRankings || !awayRankings) {
        return null;
    }

    // Base efficiency ratings
    const baseAwayScore = (awayStats.offensiveRating + homeStats.defensiveRating) / 2;
    const baseHomeScore = (homeStats.offensiveRating + awayStats.defensiveRating) / 2;

    let ourHomeScore = baseHomeScore;
    let ourAwayScore = baseAwayScore;

    // Home field advantage
    const homeFieldAdv = 2.5;
    ourHomeScore += homeFieldAdv;

    // Weather weights for rush vs pass
    let rushWeight = 1.0;
    let passWeight = 1.0;

    if (weather) {
        if (weather.snow) {
            rushWeight = 2.0;
            passWeight = 0.4;
        } else if (weather.rain > 0.5) {
            rushWeight = 1.5;
            passWeight = 0.7;
        }

        if (weather.windSpeed > 20) {
            passWeight *= 0.5;
        }
    }

    // Rush/pass matchup analysis
    if (leagueStats.hasData && homeRankings.rushOffRank && awayRankings.rushDefRank) {
        const gap = awayRankings.rushDefRank - homeRankings.rushOffRank;
        const rawAdvantage = gap * 0.15;
        const advantage = rawAdvantage * rushWeight;

        if (Math.abs(gap) > 5) {
            ourHomeScore += advantage;
        }
    }

    if (leagueStats.hasData && homeRankings.passOffRank && awayRankings.passDefRank) {
        const gap = awayRankings.passDefRank - homeRankings.passOffRank;
        const rawAdvantage = gap * 0.15;
        const advantage = rawAdvantage * passWeight;

        if (Math.abs(gap) > 5) {
            ourHomeScore += advantage;
        }
    }

    if (leagueStats.hasData && awayRankings.rushOffRank && homeRankings.rushDefRank) {
        const gap = homeRankings.rushDefRank - awayRankings.rushOffRank;
        const rawAdvantage = gap * 0.15;
        const advantage = rawAdvantage * rushWeight;

        if (Math.abs(gap) > 5) {
            ourAwayScore += advantage;
        }
    }

    if (leagueStats.hasData && awayRankings.passOffRank && homeRankings.passDefRank) {
        const gap = homeRankings.passDefRank - awayRankings.passOffRank;
        const rawAdvantage = gap * 0.15;
        const advantage = rawAdvantage * passWeight;

        if (Math.abs(gap) > 5) {
            ourAwayScore += advantage;
        }
    }

    // Third down efficiency
    if (homeStats.thirdDownPct > 45) {
        ourHomeScore += 1.5;
    } else if (homeStats.thirdDownPct < 35) {
        ourHomeScore -= 1.5;
    }

    if (awayStats.thirdDownPct > 45) {
        ourAwayScore += 1.5;
    } else if (awayStats.thirdDownPct < 35) {
        ourAwayScore -= 1.5;
    }

    // Red zone efficiency
    if (homeStats.redZonePct > 60) {
        ourHomeScore += 1.5;
    } else if (homeStats.redZonePct < 45) {
        ourHomeScore -= 1.5;
    }

    if (awayStats.redZonePct > 60) {
        ourAwayScore += 1.5;
    } else if (awayStats.redZonePct < 45) {
        ourAwayScore -= 1.5;
    }

    // Sack differential
    const homeSackDiff = (awayStats.sacksTakenPG || 0) - (homeStats.sacksAllowedPG || 0);
    const awaySackDiff = (homeStats.sacksTakenPG || 0) - (awayStats.sacksAllowedPG || 0);

    if (homeSackDiff > 1) {
        ourHomeScore += 1;
    } else if (homeSackDiff < -1) {
        ourHomeScore -= 1;
    }

    if (awaySackDiff > 1) {
        ourAwayScore += 1;
    } else if (awaySackDiff < -1) {
        ourAwayScore -= 1;
    }

    // Weather scoring reduction
    if (weather) {
        if (weather.snow || weather.rain > 0.5 || weather.windSpeed > 20) {
            let weatherImpact = 0;

            if (weather.snow) {
                weatherImpact = -4;
            } else if (weather.rain > 0.5) {
                weatherImpact = -2;
            }

            if (weather.windSpeed > 20) {
                weatherImpact -= 2;
            }

            ourHomeScore += weatherImpact / 2;
            ourAwayScore += weatherImpact / 2;
        }
    }

    // Injury impact
    const homeInjuryImpact = analyzeInjuryImpact(homeTeam, injuries);
    const awayInjuryImpact = analyzeInjuryImpact(awayTeam, injuries);

    if (homeInjuryImpact.points !== 0) {
        ourHomeScore += homeInjuryImpact.points;
    }

    if (awayInjuryImpact.points !== 0) {
        ourAwayScore += awayInjuryImpact.points;
    }

    // Quality wins bonus (Week 12+)
    const currentWeek = game.week?.number || competition.week?.number || 0;
    if (currentWeek >= 12 && qualityWins && qualityWins[homeTeam] && qualityWins[awayTeam]) {
        const homeQW = qualityWins[homeTeam];
        const awayQW = qualityWins[awayTeam];

        const minGames = 5;
        if (homeQW.total >= minGames && awayQW.total >= minGames) {
            const diffAdvantage = homeQW.differential - awayQW.differential;

            const allDiffs = Object.values(qualityWins).map(qw => qw.differential);
            const maxDiff = Math.max(...allDiffs);
            const minDiff = Math.min(...allDiffs);
            const diffRange = maxDiff - minDiff;

            if (diffRange > 0 && Math.abs(diffAdvantage) > 0) {
                const maxBonus = 3;
                const bonus = (diffAdvantage / diffRange) * maxBonus;
                ourHomeScore += bonus;
            }
        }
    }

    // Finalize prediction
    const homeScore = Math.max(10, Math.round(ourHomeScore));
    const awayScore = Math.max(10, Math.round(ourAwayScore));

    return {
        gameId: game.id,
        week: currentWeek,
        date: game.date,
        homeTeam,
        awayTeam,
        homeScore: homeScore === awayScore ? homeScore + 1 : homeScore,
        awayScore,
        winner: (homeScore === awayScore ? homeScore + 1 : homeScore) > awayScore ? homeTeam : awayTeam,
        confidence: calculateConfidence(homeScore, awayScore),
        method: 'elo'
    };
}

function calculateConfidence(homeScore, awayScore) {
    const margin = Math.abs(homeScore - awayScore);
    if (margin >= 7) return 'high';
    if (margin <= 3) return 'low';
    return 'medium';
}

module.exports = {
    generatePrediction,
    analyzeInjuryImpact
};

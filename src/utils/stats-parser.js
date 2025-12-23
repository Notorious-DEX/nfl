/**
 * NFLv2 - Statistics Parser
 * Normalizes and parses ESPN boxscore statistics
 */

import { STAT_NAMES, NFL_TEAMS, ABBREV_TO_NAME, ABBREV_ALTERNATES } from '../core/constants.js';
import { logger } from './logger.js';

/**
 * Normalize stat name to standard format
 */
export function normalizeStatName(rawName) {
  const normalized = rawName
    .replace(/\s+/g, '')  // Remove spaces
    .replace(/-/g, '')    // Remove dashes
    .toLowerCase();

  return STAT_NAMES[normalized] || rawName;
}

/**
 * Parse a single stat value (handles "X-Y" format for attempts)
 */
export function parseStatValue(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    // Handle "completions-attempts" format (e.g., "25-35")
    if (value.includes('-')) {
      const parts = value.split('-');
      return {
        made: parseInt(parts[0]) || 0,
        attempts: parseInt(parts[1]) || 0,
        percentage: parts[1] !== '0' ? (parseInt(parts[0]) / parseInt(parts[1])) * 100 : 0
      };
    }

    // Handle percentage format (e.g., "40%")
    if (value.includes('%')) {
      return parseFloat(value.replace('%', '')) || 0;
    }

    // Handle time format (e.g., "30:15")
    if (value.includes(':')) {
      const [mins, secs] = value.split(':').map(Number);
      return (mins * 60) + secs; // Return total seconds
    }

    // Try to parse as number
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }

  return value;
}

/**
 * Parse boxscore statistics from ESPN API response
 */
export function parseBoxscoreStats(boxscore) {
  if (!boxscore || !boxscore.statistics) {
    return null;
  }

  const stats = {};

  // ESPN returns stats as array of team stats
  boxscore.statistics.forEach((teamStats, index) => {
    const teamName = boxscore.boxscore?.teams?.[index]?.team?.displayName;
    if (!teamName) return;

    const teamData = {};

    // Parse all stats
    teamStats.stats?.forEach(stat => {
      const normalizedName = normalizeStatName(stat.name || stat.label || '');
      const value = parseStatValue(stat.displayValue || stat.value);

      teamData[normalizedName] = value;
    });

    stats[teamName] = teamData;
  });

  return stats;
}

/**
 * Extract team statistics from game summary
 */
export function extractTeamStats(gameSummary) {
  if (!gameSummary) return null;

  try {
    const boxscore = gameSummary.boxscore;
    const stats = parseBoxscoreStats(gameSummary);

    if (!stats) {
      return null;
    }

    // Get team names
    const teams = Object.keys(stats);
    if (teams.length !== 2) {
      logger.warn('Expected 2 teams in boxscore', { teams: teams.length });
      return null;
    }

    const [team1, team2] = teams;

    return {
      [team1]: {
        passingYards: stats[team1].passingYards || 0,
        rushingYards: stats[team1].rushingYards || 0,
        totalYards: stats[team1].totalYards || 0,
        turnovers: stats[team1].turnovers || 0,
        thirdDownEff: stats[team1].thirdDownEff || null,
        redZoneEff: stats[team1].redZoneEff || null,
        possessionTime: stats[team1].possessionTime || 0,
        sacks: stats[team1].sacks || 0
      },
      [team2]: {
        passingYards: stats[team2].passingYards || 0,
        rushingYards: stats[team2].rushingYards || 0,
        totalYards: stats[team2].totalYards || 0,
        turnovers: stats[team2].turnovers || 0,
        thirdDownEff: stats[team2].thirdDownEff || null,
        redZoneEff: stats[team2].redZoneEff || null,
        possessionTime: stats[team2].possessionTime || 0,
        sacks: stats[team2].sacks || 0
      }
    };
  } catch (error) {
    logger.error('Failed to extract team stats', { error: error.message });
    return null;
  }
}

/**
 * Aggregate statistics across multiple games
 */
export function aggregateStats(gameStats) {
  const teamAggregates = {};

  // Initialize all teams
  Object.keys(NFL_TEAMS).forEach(teamName => {
    teamAggregates[teamName] = {
      games: 0,
      passingYards: 0,
      rushingYards: 0,
      totalYards: 0,
      turnovers: 0,
      thirdDownAttempts: 0,
      thirdDownConversions: 0,
      redZoneAttempts: 0,
      redZoneScores: 0,
      possessionTime: 0,
      sacks: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      wins: 0,
      losses: 0
    };
  });

  // Aggregate each game
  gameStats.forEach(game => {
    const teams = Object.keys(game.stats || {});

    teams.forEach(teamName => {
      if (!teamAggregates[teamName]) {
        logger.warn('Unknown team in game stats', { teamName });
        return;
      }

      const stats = game.stats[teamName];
      const agg = teamAggregates[teamName];

      agg.games++;
      agg.passingYards += stats.passingYards || 0;
      agg.rushingYards += stats.rushingYards || 0;
      agg.totalYards += stats.totalYards || 0;
      agg.turnovers += stats.turnovers || 0;
      agg.sacks += stats.sacks || 0;
      agg.possessionTime += stats.possessionTime || 0;

      // Handle third down efficiency
      if (stats.thirdDownEff && typeof stats.thirdDownEff === 'object') {
        agg.thirdDownConversions += stats.thirdDownEff.made || 0;
        agg.thirdDownAttempts += stats.thirdDownEff.attempts || 0;
      }

      // Handle red zone efficiency
      if (stats.redZoneEff && typeof stats.redZoneEff === 'object') {
        agg.redZoneScores += stats.redZoneEff.made || 0;
        agg.redZoneAttempts += stats.redZoneEff.attempts || 0;
      }

      // Add points and record
      if (game.scores) {
        agg.pointsFor += game.scores[teamName] || 0;

        const opponent = teams.find(t => t !== teamName);
        if (opponent) {
          agg.pointsAgainst += game.scores[opponent] || 0;

          // Determine win/loss
          if (game.scores[teamName] > game.scores[opponent]) {
            agg.wins++;
          } else if (game.scores[teamName] < game.scores[opponent]) {
            agg.losses++;
          }
        }
      }
    });
  });

  // Calculate averages and percentages
  Object.keys(teamAggregates).forEach(teamName => {
    const agg = teamAggregates[teamName];

    if (agg.games > 0) {
      agg.avgPassingYards = agg.passingYards / agg.games;
      agg.avgRushingYards = agg.rushingYards / agg.games;
      agg.avgTotalYards = agg.totalYards / agg.games;
      agg.avgPointsFor = agg.pointsFor / agg.games;
      agg.avgPointsAgainst = agg.pointsAgainst / agg.games;
      agg.thirdDownPct = agg.thirdDownAttempts > 0
        ? (agg.thirdDownConversions / agg.thirdDownAttempts) * 100
        : 0;
      agg.redZonePct = agg.redZoneAttempts > 0
        ? (agg.redZoneScores / agg.redZoneAttempts) * 100
        : 0;
    }

    agg.record = `${agg.wins}-${agg.losses}`;
  });

  return teamAggregates;
}

/**
 * Calculate team rankings based on aggregated stats
 */
export function calculateRankings(teamAggregates) {
  const teams = Object.keys(teamAggregates);

  // Offensive rankings
  const offensiveRank = teams
    .filter(team => teamAggregates[team].games > 0)
    .sort((a, b) => teamAggregates[b].avgTotalYards - teamAggregates[a].avgTotalYards)
    .reduce((acc, team, index) => {
      acc[team] = index + 1;
      return acc;
    }, {});

  // Defensive rankings (lower points against = better)
  const defensiveRank = teams
    .filter(team => teamAggregates[team].games > 0)
    .sort((a, b) => teamAggregates[a].avgPointsAgainst - teamAggregates[b].avgPointsAgainst)
    .reduce((acc, team, index) => {
      acc[team] = index + 1;
      return acc;
    }, {});

  // Rush offense rankings
  const rushOffenseRank = teams
    .filter(team => teamAggregates[team].games > 0)
    .sort((a, b) => teamAggregates[b].avgRushingYards - teamAggregates[a].avgRushingYards)
    .reduce((acc, team, index) => {
      acc[team] = index + 1;
      return acc;
    }, {});

  // Pass defense rankings
  const passDefenseRank = teams
    .filter(team => teamAggregates[team].games > 0)
    .sort((a, b) => teamAggregates[a].avgPassingYards - teamAggregates[b].avgPassingYards)
    .reduce((acc, team, index) => {
      acc[team] = index + 1;
      return acc;
    }, {});

  return {
    offensive: offensiveRank,
    defensive: defensiveRank,
    rushOffense: rushOffenseRank,
    passDefense: passDefenseRank
  };
}

/**
 * Normalize team name (handle abbreviations and variations)
 */
export function normalizeTeamName(name) {
  // Check if it's already a full name
  if (NFL_TEAMS[name]) {
    return name;
  }

  // Check abbreviation
  if (ABBREV_TO_NAME[name]) {
    return ABBREV_TO_NAME[name];
  }

  // Check alternate abbreviations
  if (ABBREV_ALTERNATES[name]) {
    return ABBREV_TO_NAME[ABBREV_ALTERNATES[name]];
  }

  // Try case-insensitive match
  const lowerName = name.toLowerCase();
  for (const [fullName, data] of Object.entries(NFL_TEAMS)) {
    if (fullName.toLowerCase() === lowerName ||
        data.abbrev.toLowerCase() === lowerName ||
        data.name.toLowerCase() === lowerName) {
      return fullName;
    }
  }

  logger.warn('Unknown team name', { name });
  return name;
}

export default {
  normalizeStatName,
  parseStatValue,
  parseBoxscoreStats,
  extractTeamStats,
  aggregateStats,
  calculateRankings,
  normalizeTeamName
};

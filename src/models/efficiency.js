/**
 * NFLv2 - Efficiency Rating Model
 * Predicts games based on offensive/defensive efficiency metrics
 */

import { MODEL_CONSTANTS } from '../core/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Calculate base efficiency rating for a team
 */
export function calculateEfficiencyRating(teamStats, leagueAverage) {
  if (!teamStats || teamStats.games === 0) {
    return MODEL_CONSTANTS.ELO_BASE_RATING;
  }

  // Offensive efficiency (yards per game relative to league average)
  const offensiveEfficiency = teamStats.avgTotalYards / leagueAverage.avgTotalYards;

  // Defensive efficiency (points allowed relative to league average - lower is better)
  const defensiveEfficiency = leagueAverage.avgPointsAgainst / teamStats.avgPointsAgainst;

  // Scoring efficiency
  const scoringEfficiency = teamStats.avgPointsFor / leagueAverage.avgPointsFor;

  // Combined rating (weighted average)
  const rating = (offensiveEfficiency * 0.35 + defensiveEfficiency * 0.35 + scoringEfficiency * 0.30) * 1000;

  return rating;
}

/**
 * Calculate matchup advantage
 */
export function calculateMatchupAdvantage(teamStats, opponentStats, rankings) {
  let advantage = 0;

  // Rush offense vs rush defense
  const rushOffenseRank = rankings.rushOffense[teamStats.teamName] || 16;
  const oppPassDefenseRank = rankings.passDefense[opponentStats.teamName] || 16;

  // If good rushing team vs bad pass defense, advantage
  const rushAdvantage = (oppPassDefenseRank - rushOffenseRank) * MODEL_CONSTANTS.MATCHUP_WEIGHT;
  advantage += rushAdvantage;

  return advantage;
}

/**
 * Calculate situational adjustments (3rd down, red zone)
 */
export function calculateSituationalAdjustment(teamStats, opponentStats) {
  let adjustment = 0;

  // Third down efficiency advantage
  const teamThirdDown = teamStats.thirdDownPct || MODEL_CONSTANTS.DEFAULT_THIRD_DOWN_PCT;
  const oppThirdDown = opponentStats.thirdDownPct || MODEL_CONSTANTS.DEFAULT_THIRD_DOWN_PCT;
  const thirdDownDiff = teamThirdDown - oppThirdDown;
  adjustment += thirdDownDiff * 0.05; // 10% difference ≈ 0.5 points

  // Red zone efficiency advantage
  const teamRedZone = teamStats.redZonePct || MODEL_CONSTANTS.DEFAULT_RED_ZONE_PCT;
  const oppRedZone = opponentStats.redZonePct || MODEL_CONSTANTS.DEFAULT_RED_ZONE_PCT;
  const redZoneDiff = teamRedZone - oppRedZone;
  adjustment += redZoneDiff * 0.03; // 10% difference ≈ 0.3 points

  return adjustment;
}

/**
 * Predict game using efficiency model
 */
export function predictGame(homeTeamStats, awayTeamStats, leagueAverage, rankings) {
  if (!homeTeamStats || !awayTeamStats || !leagueAverage) {
    logger.error('Missing required stats for efficiency prediction');
    return null;
  }

  // Calculate base efficiency ratings
  const homeEfficiency = calculateEfficiencyRating(homeTeamStats, leagueAverage);
  const awayEfficiency = calculateEfficiencyRating(awayTeamStats, leagueAverage);

  // Calculate matchup advantages
  const homeMatchup = calculateMatchupAdvantage(homeTeamStats, awayTeamStats, rankings);
  const awayMatchup = calculateMatchupAdvantage(awayTeamStats, homeTeamStats, rankings);

  // Calculate situational adjustments
  const homeSituational = calculateSituationalAdjustment(homeTeamStats, awayTeamStats);
  const awaySituational = calculateSituationalAdjustment(awayTeamStats, homeTeamStats);

  // Base score prediction (league average)
  let homeScore = leagueAverage.avgPointsFor || 23;
  let awayScore = leagueAverage.avgPointsFor || 23;

  // Adjust for team offensive strength
  homeScore += (homeTeamStats.avgPointsFor - leagueAverage.avgPointsFor) * 0.5;
  awayScore += (awayTeamStats.avgPointsFor - leagueAverage.avgPointsFor) * 0.5;

  // Adjust for opponent defensive strength
  homeScore -= (awayTeamStats.avgPointsAgainst - leagueAverage.avgPointsAgainst) * 0.3;
  awayScore -= (homeTeamStats.avgPointsAgainst - leagueAverage.avgPointsAgainst) * 0.3;

  // Add home field advantage
  homeScore += MODEL_CONSTANTS.HOME_FIELD_ADVANTAGE;

  // Add matchup advantages
  homeScore += homeMatchup;
  awayScore += awayMatchup;

  // Add situational adjustments
  homeScore += homeSituational;
  awayScore += awaySituational;

  // Round scores
  homeScore = Math.round(Math.max(0, homeScore));
  awayScore = Math.round(Math.max(0, awayScore));

  // Determine winner and confidence
  const scoreDiff = Math.abs(homeScore - awayScore);
  const predictedWinner = homeScore > awayScore ? homeTeamStats.teamName : awayTeamStats.teamName;

  let confidence = 'low';
  if (scoreDiff >= 10) {
    confidence = 'high';
  } else if (scoreDiff >= 6) {
    confidence = 'medium';
  }

  return {
    homeTeam: homeTeamStats.teamName,
    awayTeam: awayTeamStats.teamName,
    predictedWinner,
    predictedScore: `${homeScore}-${awayScore}`,
    confidence,
    scoreDifference: scoreDiff,
    homeEfficiency: homeEfficiency.toFixed(0),
    awayEfficiency: awayEfficiency.toFixed(0),
    details: {
      homeMatchupAdv: homeMatchup.toFixed(1),
      awayMatchupAdv: awayMatchup.toFixed(1),
      homeSituationalAdj: homeSituational.toFixed(1),
      awaySituationalAdj: awaySituational.toFixed(1)
    }
  };
}

/**
 * Calculate league averages from team aggregates
 */
export function calculateLeagueAverages(teamAggregates) {
  const teams = Object.keys(teamAggregates);
  const teamsWithGames = teams.filter(team => teamAggregates[team].games > 0);

  if (teamsWithGames.length === 0) {
    logger.warn('No teams with games played for league averages');
    return {
      avgTotalYards: 350,
      avgPointsFor: 23,
      avgPointsAgainst: 23,
      avgPassingYards: 230,
      avgRushingYards: 120
    };
  }

  const totals = teamsWithGames.reduce((acc, team) => {
    const stats = teamAggregates[team];
    acc.totalYards += stats.avgTotalYards;
    acc.pointsFor += stats.avgPointsFor;
    acc.pointsAgainst += stats.avgPointsAgainst;
    acc.passingYards += stats.avgPassingYards;
    acc.rushingYards += stats.avgRushingYards;
    return acc;
  }, {
    totalYards: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    passingYards: 0,
    rushingYards: 0
  });

  const count = teamsWithGames.length;

  return {
    avgTotalYards: totals.totalYards / count,
    avgPointsFor: totals.pointsFor / count,
    avgPointsAgainst: totals.pointsAgainst / count,
    avgPassingYards: totals.passingYards / count,
    avgRushingYards: totals.rushingYards / count
  };
}

export default {
  calculateEfficiencyRating,
  calculateMatchupAdvantage,
  calculateSituationalAdjustment,
  predictGame,
  calculateLeagueAverages
};

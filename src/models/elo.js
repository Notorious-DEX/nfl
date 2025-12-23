/**
 * NFLv2 - Elo Rating System
 * Implements Elo ratings with margin-of-victory adjustments
 */

import { MODEL_CONSTANTS, NFL_TEAMS } from '../core/constants.js';
import { logger } from '../utils/logger.js';

/**
 * Initialize Elo ratings for all teams
 */
export function initializeRatings(previousSeasonRatings = null) {
  const ratings = {};

  Object.keys(NFL_TEAMS).forEach(team => {
    if (previousSeasonRatings && previousSeasonRatings[team]) {
      // Regress toward mean at start of season
      const prevRating = previousSeasonRatings[team];
      const regression = (prevRating - MODEL_CONSTANTS.ELO_BASE_RATING) * MODEL_CONSTANTS.ELO_REGRESSION;
      ratings[team] = MODEL_CONSTANTS.ELO_BASE_RATING + regression;
    } else {
      // Default to base rating
      ratings[team] = MODEL_CONSTANTS.ELO_BASE_RATING;
    }
  });

  return ratings;
}

/**
 * Calculate expected win probability based on Elo difference
 */
export function calculateWinProbability(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate margin of victory multiplier
 */
export function calculateMOVMultiplier(marginOfVictory, eloWinner, eloLoser) {
  const eloDiff = eloWinner - eloLoser;

  // Base multiplier on margin
  let multiplier = Math.log(Math.abs(marginOfVictory) + 1) * MODEL_CONSTANTS.ELO_MOV_MULTIPLIER;

  // Adjust for expected outcome
  if (eloDiff > 0) {
    // Favorite won - reduce impact
    multiplier *= 2.2 / ((eloDiff * 0.001) + 2.2);
  }

  return multiplier;
}

/**
 * Update Elo ratings after a game
 */
export function updateRatings(ratings, winner, loser, winnerScore, loserScore, isNeutralSite = false) {
  const ratingWinner = ratings[winner];
  const ratingLoser = ratings[loser];

  if (!ratingWinner || !ratingLoser) {
    logger.error('Cannot update ratings: team not found', { winner, loser });
    return ratings;
  }

  // Calculate expected win probability
  const expectedWin = calculateWinProbability(ratingWinner, ratingLoser);

  // Margin of victory
  const mov = Math.abs(winnerScore - loserScore);
  const movMultiplier = calculateMOVMultiplier(mov, ratingWinner, ratingLoser);

  // Calculate rating change
  const kFactor = MODEL_CONSTANTS.ELO_K_FACTOR;
  const change = kFactor * movMultiplier * (1 - expectedWin);

  // Update ratings
  const newRatings = { ...ratings };
  newRatings[winner] = ratingWinner + change;
  newRatings[loser] = ratingLoser - change;

  logger.debug('Elo update', {
    winner,
    loser,
    score: `${winnerScore}-${loserScore}`,
    oldRatings: `${ratingWinner.toFixed(0)}-${ratingLoser.toFixed(0)}`,
    newRatings: `${newRatings[winner].toFixed(0)}-${newRatings[loser].toFixed(0)}`,
    change: change.toFixed(1)
  });

  return newRatings;
}

/**
 * Predict game outcome based on Elo ratings
 */
export function predictGame(ratings, homeTeam, awayTeam) {
  const homeRating = ratings[homeTeam];
  const awayRating = ratings[awayTeam];

  if (!homeRating || !awayRating) {
    logger.error('Cannot predict: team ratings not found', { homeTeam, awayTeam });
    return null;
  }

  // Add home field advantage to home team rating
  const adjustedHomeRating = homeRating + (MODEL_CONSTANTS.HOME_FIELD_ADVANTAGE * 25); // ~25 Elo points = 2.5 score points

  // Calculate win probabilities
  const homeWinProb = calculateWinProbability(adjustedHomeRating, awayRating);
  const awayWinProb = 1 - homeWinProb;

  // Determine winner
  const predictedWinner = homeWinProb > 0.5 ? homeTeam : awayTeam;

  // Calculate confidence level based on Elo difference
  const eloDiff = Math.abs(adjustedHomeRating - awayRating);
  let confidence = 'low';
  if (eloDiff >= MODEL_CONSTANTS.CONFIDENCE_HIGH_THRESHOLD) {
    confidence = 'high';
  } else if (eloDiff >= MODEL_CONSTANTS.CONFIDENCE_MEDIUM_THRESHOLD) {
    confidence = 'medium';
  }

  // Estimate scores based on ratings
  const avgScore = 23; // NFL average score
  const ratingDiff = adjustedHomeRating - awayRating;
  const scoreDiff = (ratingDiff / 25); // 25 Elo ≈ 1 point

  const homeScore = Math.round(avgScore + (scoreDiff / 2));
  const awayScore = Math.round(avgScore - (scoreDiff / 2));

  return {
    homeTeam,
    awayTeam,
    predictedWinner,
    homeWinProbability: homeWinProb * 100,
    awayWinProbability: awayWinProb * 100,
    confidence,
    eloDifference: eloDiff,
    predictedScore: `${Math.max(0, homeScore)}-${Math.max(0, awayScore)}`,
    homeRating: homeRating.toFixed(0),
    awayRating: awayRating.toFixed(0)
  };
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(eloDiff) {
  if (eloDiff >= MODEL_CONSTANTS.CONFIDENCE_HIGH_THRESHOLD) {
    return 'high';
  } else if (eloDiff >= MODEL_CONSTANTS.CONFIDENCE_MEDIUM_THRESHOLD) {
    return 'medium';
  }
  return 'low';
}

/**
 * Calculate team power rankings based on Elo
 */
export function getPowerRankings(ratings) {
  const teams = Object.entries(ratings)
    .sort(([, ratingA], [, ratingB]) => ratingB - ratingA)
    .map(([team, rating], index) => ({
      rank: index + 1,
      team,
      rating: rating.toFixed(0)
    }));

  return teams;
}

export default {
  initializeRatings,
  calculateWinProbability,
  calculateMOVMultiplier,
  updateRatings,
  predictGame,
  getConfidenceLevel,
  getPowerRankings
};

/**
 * NFLv2 - Input Validator
 * Validates data structures and inputs
 */

import { NFL_TEAMS } from '../core/constants.js';
import { logger } from './logger.js';

/**
 * Validate team name
 */
export function isValidTeam(teamName) {
  return NFL_TEAMS.hasOwnProperty(teamName);
}

/**
 * Validate game data structure
 */
export function validateGame(game) {
  const errors = [];

  if (!game) {
    return { valid: false, errors: ['Game is null or undefined'] };
  }

  if (!game.id) {
    errors.push('Missing game ID');
  }

  if (!game.homeTeam || !isValidTeam(game.homeTeam)) {
    errors.push(`Invalid home team: ${game.homeTeam}`);
  }

  if (!game.awayTeam || !isValidTeam(game.awayTeam)) {
    errors.push(`Invalid away team: ${game.awayTeam}`);
  }

  if (game.homeScore !== undefined && typeof game.homeScore !== 'number') {
    errors.push(`Invalid home score type: ${typeof game.homeScore}`);
  }

  if (game.awayScore !== undefined && typeof game.awayScore !== 'number') {
    errors.push(`Invalid away score type: ${typeof game.awayScore}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate prediction data structure
 */
export function validatePrediction(prediction) {
  const errors = [];

  if (!prediction) {
    return { valid: false, errors: ['Prediction is null or undefined'] };
  }

  if (!prediction.id) {
    errors.push('Missing prediction ID');
  }

  if (!prediction.homeTeam || !isValidTeam(prediction.homeTeam)) {
    errors.push(`Invalid home team: ${prediction.homeTeam}`);
  }

  if (!prediction.awayTeam || !isValidTeam(prediction.awayTeam)) {
    errors.push(`Invalid away team: ${prediction.awayTeam}`);
  }

  if (!prediction.predictedWinner || !isValidTeam(prediction.predictedWinner)) {
    errors.push(`Invalid predicted winner: ${prediction.predictedWinner}`);
  }

  if (typeof prediction.confidence !== 'string' ||
      !['high', 'medium', 'low'].includes(prediction.confidence)) {
    errors.push(`Invalid confidence level: ${prediction.confidence}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate team statistics
 */
export function validateTeamStats(stats) {
  const errors = [];

  if (!stats) {
    return { valid: false, errors: ['Stats is null or undefined'] };
  }

  const requiredFields = ['passingYards', 'rushingYards', 'totalYards'];
  requiredFields.forEach(field => {
    if (stats[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof stats[field] !== 'number') {
      errors.push(`Invalid type for ${field}: expected number, got ${typeof stats[field]}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate Elo rating
 */
export function validateEloRating(rating) {
  if (typeof rating !== 'number') {
    return { valid: false, errors: [`Invalid Elo rating type: ${typeof rating}`] };
  }

  if (rating < 0 || rating > 3000) {
    return { valid: false, errors: [`Elo rating out of range: ${rating}`] };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate week number
 */
export function validateWeek(week) {
  if (typeof week !== 'number') {
    return { valid: false, errors: [`Invalid week type: ${typeof week}`] };
  }

  if (week < 1 || week > 18) {
    return { valid: false, errors: [`Week out of range: ${week} (must be 1-18)`] };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate season year
 */
export function validateSeason(year) {
  if (typeof year !== 'number') {
    return { valid: false, errors: [`Invalid season type: ${typeof year}`] };
  }

  const currentYear = new Date().getFullYear();
  if (year < 2020 || year > currentYear + 1) {
    return { valid: false, errors: [`Season year out of range: ${year}`] };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate and sanitize input with logging
 */
export function validate(data, validatorFn, context = {}) {
  const result = validatorFn(data);

  if (!result.valid) {
    logger.warn('Validation failed', { ...context, errors: result.errors });
  }

  return result;
}

/**
 * Validate array of items
 */
export function validateArray(items, validatorFn, context = {}) {
  const results = items.map((item, index) =>
    validate(item, validatorFn, { ...context, index })
  );

  const allValid = results.every(r => r.valid);
  const allErrors = results.flatMap(r => r.errors);

  return {
    valid: allValid,
    errors: allErrors,
    results
  };
}

export default {
  isValidTeam,
  validateGame,
  validatePrediction,
  validateTeamStats,
  validateEloRating,
  validateWeek,
  validateSeason,
  validate,
  validateArray
};

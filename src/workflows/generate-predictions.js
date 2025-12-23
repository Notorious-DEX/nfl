#!/usr/bin/env node
/**
 * NFLv2 - Generate Predictions Workflow
 * Generates predictions for upcoming games using combined models
 */

import { dataManager } from '../core/data-manager.js';
import { DATA_PATHS } from '../core/constants.js';
import { predictGames } from '../models/predictor.js';
import { initializeRatings } from '../models/elo.js';
import { calculateLeagueAverages } from '../models/efficiency.js';
import { logger } from '../utils/logger.js';

async function generatePredictions() {
  const startTime = logger.start('Generate predictions');

  try {
    // Step 1: Load cached data
    logger.info('Loading cached data...');
    const cachedData = await dataManager.readJSON(DATA_PATHS.CACHED_DATA);

    if (!cachedData) {
      throw new Error('No cached data found. Run update-data.js first.');
    }

    // Step 2: Load or initialize Elo ratings
    logger.info('Loading Elo ratings...');
    let historicalElo = await dataManager.readJSON(DATA_PATHS.HISTORICAL_ELO);

    if (!historicalElo || !historicalElo.ratings) {
      logger.warn('No historical Elo found, initializing fresh ratings');
      historicalElo = {
        season: cachedData.season,
        ratings: initializeRatings(),
        lastUpdated: new Date().toISOString()
      };
    }

    const eloRatings = historicalElo.ratings;

    // Step 3: Calculate league averages
    logger.info('Calculating league averages...');
    const leagueAverage = calculateLeagueAverages(cachedData.teamStats);

    // Step 4: Get upcoming games
    const upcomingGames = cachedData.upcomingGames || [];

    if (upcomingGames.length === 0) {
      logger.info('No upcoming games to predict');
      return [];
    }

    logger.info(`Generating predictions for ${upcomingGames.length} games`);

    // Step 5: Generate predictions
    const context = {
      eloRatings,
      teamStats: cachedData.teamStats,
      leagueAverage,
      rankings: cachedData.rankings
    };

    const newPredictions = predictGames(upcomingGames, context);

    // Step 6: Load existing predictions
    let existingPredictions = await dataManager.readJSON(DATA_PATHS.PREDICTIONS) || { predictions: [] };
    if (!existingPredictions.predictions) {
      existingPredictions = { predictions: [] };
    }

    // Step 7: Merge predictions (keep unchecked old predictions)
    const uncheckedOld = existingPredictions.predictions.filter(p => !p.checked);
    const newGameIds = new Set(newPredictions.map(p => p.id));

    // Remove old predictions for games we're re-predicting
    const keptOld = uncheckedOld.filter(p => !newGameIds.has(p.id));

    const allPredictions = [...keptOld, ...newPredictions];

    // Step 8: Save predictions
    const predictionsData = {
      lastUpdated: new Date().toISOString(),
      season: cachedData.season,
      predictions: allPredictions,
      summary: {
        total: allPredictions.length,
        new: newPredictions.length,
        carried: keptOld.length,
        byConfidence: {
          high: allPredictions.filter(p => p.confidence === 'high').length,
          medium: allPredictions.filter(p => p.confidence === 'medium').length,
          low: allPredictions.filter(p => p.confidence === 'low').length
        }
      }
    };

    logger.info('Saving predictions...');
    await dataManager.writeJSON(DATA_PATHS.PREDICTIONS, predictionsData);

    logger.end('Generate predictions', startTime);

    logger.info('✅ Predictions generated', {
      total: allPredictions.length,
      new: newPredictions.length,
      high: predictionsData.summary.byConfidence.high,
      medium: predictionsData.summary.byConfidence.medium,
      low: predictionsData.summary.byConfidence.low
    });

    return predictionsData;
  } catch (error) {
    logger.error('Prediction generation failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePredictions()
    .then(() => {
      logger.info('Prediction generation workflow completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Prediction generation workflow failed', { error: error.message });
      process.exit(1);
    });
}

export default generatePredictions;

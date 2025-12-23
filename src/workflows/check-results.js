#!/usr/bin/env node
/**
 * NFLv2 - Check Results Workflow
 * Checks predictions against actual results and updates accuracy
 */

import { apiClient } from '../core/api-client.js';
import { dataManager } from '../core/data-manager.js';
import { DATA_PATHS, UPDATE_CONFIG } from '../core/constants.js';
import { checkPrediction, calculateAccuracy } from '../models/predictor.js';
import { updateRatings } from '../models/elo.js';
import { logger } from '../utils/logger.js';

async function checkResults() {
  const startTime = logger.start('Check results');

  try {
    // Step 1: Load predictions
    logger.info('Loading predictions...');
    const predictionsData = await dataManager.readJSON(DATA_PATHS.PREDICTIONS);

    if (!predictionsData || !predictionsData.predictions) {
      logger.warn('No predictions found');
      return { checked: 0, updated: 0 };
    }

    // Step 2: Filter unchecked predictions that are old enough
    const now = new Date();
    const checkThreshold = UPDATE_CONFIG.RESULT_CHECK_HOURS * 60 * 60 * 1000;

    const toCheck = predictionsData.predictions.filter(p => {
      if (p.checked) return false;

      const gameDate = new Date(p.gameDate);
      const timeSinceGame = now - gameDate;

      // Only check games that ended at least RESULT_CHECK_HOURS ago
      return timeSinceGame >= checkThreshold;
    });

    if (toCheck.length === 0) {
      logger.info('No predictions ready to check');
      return { checked: 0, updated: 0 };
    }

    logger.info(`Checking ${toCheck.length} predictions...`);

    // Step 3: Fetch game results
    const checkedPredictions = [];
    let successCount = 0;

    for (const prediction of toCheck) {
      try {
        const gameSummary = await apiClient.getGameSummary(prediction.id);

        if (!gameSummary) {
          logger.warn('Could not fetch game summary', { id: prediction.id });
          continue;
        }

        // Get final score
        const comp = gameSummary.header?.competitions?.[0];
        if (!comp) continue;

        const teams = comp.competitors;
        if (!teams || teams.length !== 2) continue;

        const homeTeam = teams.find(t => t.homeAway === 'home');
        const awayTeam = teams.find(t => t.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        // Check if game is final
        const status = gameSummary.header?.status?.type?.state;
        if (status !== 'post') {
          logger.debug('Game not final yet', { id: prediction.id, status });
          continue;
        }

        const actualResult = {
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          homeScore: parseInt(homeTeam.score) || 0,
          awayScore: parseInt(awayTeam.score) || 0
        };

        // Check prediction
        const checked = checkPrediction(prediction, actualResult);
        checkedPredictions.push(checked);
        successCount++;

        logger.info('Checked prediction', {
          game: `${actualResult.homeTeam} vs ${actualResult.awayTeam}`,
          predicted: `${prediction.predictedWinner} ${prediction.predictedScore}`,
          actual: `${actualResult.homeScore}-${actualResult.awayScore}`,
          correct: checked.correct ? '✅' : '❌'
        });
      } catch (error) {
        logger.error('Failed to check prediction', {
          id: prediction.id,
          error: error.message
        });
      }
    }

    if (successCount === 0) {
      logger.info('No results checked successfully');
      return { checked: 0, updated: 0 };
    }

    // Step 4: Update predictions file
    logger.info('Updating predictions...');

    await dataManager.updateJSON(DATA_PATHS.PREDICTIONS, (data) => {
      const updated = data.predictions.map(p => {
        const checked = checkedPredictions.find(c => c.id === p.id);
        return checked || p;
      });

      return {
        ...data,
        predictions: updated,
        lastChecked: new Date().toISOString()
      };
    });

    // Step 5: Update results history
    logger.info('Updating results history...');

    await dataManager.updateJSON(DATA_PATHS.RESULTS, (existing) => {
      const results = existing.results || [];

      // Add new results
      checkedPredictions.forEach(checked => {
        // Don't duplicate
        if (!results.find(r => r.id === checked.id)) {
          results.push(checked);
        }
      });

      // Calculate overall accuracy
      const accuracy = calculateAccuracy(results);

      return {
        lastUpdated: new Date().toISOString(),
        results,
        accuracy
      };
    }, { results: [] });

    // Step 6: Update Elo ratings
    logger.info('Updating Elo ratings...');

    const historicalElo = await dataManager.readJSON(DATA_PATHS.HISTORICAL_ELO) || { ratings: {} };
    let eloRatings = historicalElo.ratings || {};

    // Update ratings based on checked results
    checkedPredictions.forEach(result => {
      const [homeScore, awayScore] = result.actualScore.split('-').map(Number);
      const winner = homeScore > awayScore ? result.homeTeam : result.awayTeam;
      const loser = homeScore > awayScore ? result.awayTeam : result.homeTeam;
      const winnerScore = Math.max(homeScore, awayScore);
      const loserScore = Math.min(homeScore, awayScore);

      eloRatings = updateRatings(eloRatings, winner, loser, winnerScore, loserScore);
    });

    // Save updated Elo ratings
    await dataManager.writeJSON(DATA_PATHS.HISTORICAL_ELO, {
      ...historicalElo,
      ratings: eloRatings,
      lastUpdated: new Date().toISOString()
    });

    logger.end('Check results', startTime);

    logger.info('✅ Results checked', {
      checked: successCount,
      correct: checkedPredictions.filter(p => p.correct).length,
      incorrect: checkedPredictions.filter(p => !p.correct).length
    });

    return {
      checked: successCount,
      updated: checkedPredictions.length
    };
  } catch (error) {
    logger.error('Results check failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkResults()
    .then((result) => {
      logger.info('Results check workflow completed successfully', result);
      process.exit(0);
    })
    .catch(error => {
      logger.error('Results check workflow failed', { error: error.message });
      process.exit(1);
    });
}

export default checkResults;

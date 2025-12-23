/**
 * NFLv2 - Unified Predictor
 * Combines Elo and Efficiency models for predictions
 */

import * as elo from './elo.js';
import * as efficiency from './efficiency.js';
import { logger } from '../utils/logger.js';

/**
 * Generate prediction using both models
 */
export function predict(game, context) {
  const { eloRatings, teamStats, leagueAverage, rankings } = context;

  const homeTeam = game.homeTeam;
  const awayTeam = game.awayTeam;

  // Elo prediction
  const eloPrediction = elo.predictGame(eloRatings, homeTeam, awayTeam);

  // Efficiency prediction
  const homeStats = { ...teamStats[homeTeam], teamName: homeTeam };
  const awayStats = { ...teamStats[awayTeam], teamName: awayTeam };
  const efficiencyPrediction = efficiency.predictGame(homeStats, awayStats, leagueAverage, rankings);

  if (!eloPrediction || !efficiencyPrediction) {
    logger.error('Failed to generate predictions', { homeTeam, awayTeam });
    return null;
  }

  // Combine predictions (weighted average)
  const eloWeight = 0.6;
  const efficiencyWeight = 0.4;

  // Parse scores
  const [eloHome, eloAway] = eloPrediction.predictedScore.split('-').map(Number);
  const [effHome, effAway] = efficiencyPrediction.predictedScore.split('-').map(Number);

  // Weighted average scores
  const finalHomeScore = Math.round(eloHome * eloWeight + effHome * efficiencyWeight);
  const finalAwayScore = Math.round(eloAway * eloWeight + effAway * efficiencyWeight);

  // Determine final winner
  const finalWinner = finalHomeScore > finalAwayScore ? homeTeam : awayTeam;

  // Determine confidence (use stricter of the two models)
  const confidenceLevels = { high: 3, medium: 2, low: 1 };
  const eloConfLevel = confidenceLevels[eloPrediction.confidence];
  const effConfLevel = confidenceLevels[efficiencyPrediction.confidence];
  const finalConfLevel = Math.min(eloConfLevel, effConfLevel);

  let finalConfidence = 'low';
  if (finalConfLevel === 3) finalConfidence = 'high';
  else if (finalConfLevel === 2) finalConfidence = 'medium';

  return {
    id: game.id,
    gameDate: game.date,
    homeTeam,
    awayTeam,
    predictedWinner: finalWinner,
    predictedScore: `${finalHomeScore}-${finalAwayScore}`,
    spread: finalHomeScore - finalAwayScore,
    confidence: finalConfidence,
    timestamp: new Date().toISOString(),
    checked: false,
    models: {
      elo: {
        winner: eloPrediction.predictedWinner,
        score: eloPrediction.predictedScore,
        confidence: eloPrediction.confidence,
        homeWinProb: eloPrediction.homeWinProbability.toFixed(1),
        awayWinProb: eloPrediction.awayWinProbability.toFixed(1)
      },
      efficiency: {
        winner: efficiencyPrediction.predictedWinner,
        score: efficiencyPrediction.predictedScore,
        confidence: efficiencyPrediction.confidence
      }
    }
  };
}

/**
 * Generate predictions for multiple games
 */
export function predictGames(games, context) {
  const predictions = [];

  for (const game of games) {
    try {
      const prediction = predict(game, context);
      if (prediction) {
        predictions.push(prediction);
      }
    } catch (error) {
      logger.error('Failed to predict game', {
        game: `${game.homeTeam} vs ${game.awayTeam}`,
        error: error.message
      });
    }
  }

  logger.info(`Generated ${predictions.length}/${games.length} predictions`);
  return predictions;
}

/**
 * Check prediction result
 */
export function checkPrediction(prediction, actualResult) {
  const actualWinner = actualResult.homeScore > actualResult.awayScore
    ? actualResult.homeTeam
    : actualResult.awayTeam;

  const correct = prediction.predictedWinner === actualWinner;

  const [predHome, predAway] = prediction.predictedScore.split('-').map(Number);
  const scoreError = Math.abs(predHome - actualResult.homeScore) + Math.abs(predAway - actualResult.awayScore);

  return {
    ...prediction,
    checked: true,
    correct,
    actualWinner,
    actualScore: `${actualResult.homeScore}-${actualResult.awayScore}`,
    scoreError,
    checkedAt: new Date().toISOString()
  };
}

/**
 * Calculate prediction accuracy stats
 */
export function calculateAccuracy(predictions) {
  const total = predictions.length;
  const correct = predictions.filter(p => p.correct).length;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  // Accuracy by confidence level
  const byConfidence = {};
  ['high', 'medium', 'low'].forEach(level => {
    const levelPreds = predictions.filter(p => p.confidence === level);
    const levelCorrect = levelPreds.filter(p => p.correct).length;
    byConfidence[level] = {
      total: levelPreds.length,
      correct: levelCorrect,
      accuracy: levelPreds.length > 0 ? (levelCorrect / levelPreds.length) * 100 : 0
    };
  });

  // Average score error
  const totalScoreError = predictions.reduce((sum, p) => sum + (p.scoreError || 0), 0);
  const avgScoreError = total > 0 ? totalScoreError / total : 0;

  return {
    total,
    correct,
    incorrect: total - correct,
    accuracy: accuracy.toFixed(1),
    byConfidence,
    avgScoreError: avgScoreError.toFixed(1)
  };
}

export default {
  predict,
  predictGames,
  checkPrediction,
  calculateAccuracy
};

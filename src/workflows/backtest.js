#!/usr/bin/env node
/**
 * NFLv2 - Backtest Workflow
 * Tests prediction models against historical data
 */

import { apiClient } from '../core/api-client.js';
import { dataManager } from '../core/data-manager.js';
import { DATA_PATHS, CURRENT_SEASON } from '../core/constants.js';
import { predictGames, calculateAccuracy } from '../models/predictor.js';
import { initializeRatings, updateRatings } from '../models/elo.js';
import { calculateLeagueAverages } from '../models/efficiency.js';
import { extractTeamStats, aggregateStats, calculateRankings } from '../utils/stats-parser.js';
import { logger } from '../utils/logger.js';

async function backtest(startWeek = 1, endWeek = null) {
  const startTime = logger.start('Backtest');

  try {
    // Determine end week (current week if not specified)
    if (!endWeek) {
      const scoreboard = await apiClient.getScoreboard();
      endWeek = scoreboard[0]?.week || 18;
    }

    logger.info(`Running backtest for weeks ${startWeek}-${endWeek}`);

    // Initialize Elo ratings
    let eloRatings = initializeRatings();
    const allPredictions = [];
    const allResults = [];

    // Process each week
    for (let week = startWeek; week <= endWeek; week++) {
      logger.info(`Processing week ${week}...`);

      // Get games for this week
      const weekGames = await apiClient.getScoreboard(week);

      // Filter to completed games
      const completedGames = weekGames.filter(g => g.status?.type?.state === 'post');

      if (completedGames.length === 0) {
        logger.info(`No completed games in week ${week}`);
        continue;
      }

      // Get all historical data up to (but not including) this week
      const historicalSummaries = week > 1
        ? await apiClient.getAllBoxscores(1, week - 1)
        : [];

      // Parse historical stats
      const gameStats = [];
      for (const summary of historicalSummaries) {
        const stats = extractTeamStats(summary);
        if (!stats) continue;

        const gameInfo = summary.header?.competitions?.[0];
        if (!gameInfo) continue;

        const teams = gameInfo.competitors;
        if (!teams || teams.length !== 2) continue;

        const homeTeam = teams.find(t => t.homeAway === 'home');
        const awayTeam = teams.find(t => t.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        gameStats.push({
          id: summary.header.id,
          stats,
          scores: {
            [homeTeam.team.displayName]: parseInt(homeTeam.score) || 0,
            [awayTeam.team.displayName]: parseInt(awayTeam.score) || 0
          }
        });
      }

      // Aggregate and calculate stats
      const teamStats = aggregateStats(gameStats);
      const rankings = calculateRankings(teamStats);
      const leagueAverage = calculateLeagueAverages(teamStats);

      // Prepare games for prediction
      const gamesToPredict = completedGames.map(game => {
        const comp = game.competitions?.[0];
        const teams = comp?.competitors;
        const homeTeam = teams?.find(t => t.homeAway === 'home');
        const awayTeam = teams?.find(t => t.homeAway === 'away');

        return {
          id: game.id,
          date: comp.date,
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          actualHomeScore: parseInt(homeTeam.score) || 0,
          actualAwayScore: parseInt(awayTeam.score) || 0
        };
      }).filter(g => g.homeTeam && g.awayTeam);

      // Generate predictions
      const context = {
        eloRatings,
        teamStats,
        leagueAverage,
        rankings
      };

      const predictions = predictGames(gamesToPredict, context);

      // Check predictions and update Elo
      for (const pred of predictions) {
        const game = gamesToPredict.find(g => g.id === pred.id);
        if (!game) continue;

        const actualWinner = game.actualHomeScore > game.actualAwayScore
          ? game.homeTeam
          : game.awayTeam;

        const correct = pred.predictedWinner === actualWinner;

        const result = {
          ...pred,
          week,
          correct,
          actualWinner,
          actualScore: `${game.actualHomeScore}-${game.actualAwayScore}`,
          checked: true
        };

        allPredictions.push(pred);
        allResults.push(result);

        // Update Elo ratings
        const winner = actualWinner;
        const loser = winner === game.homeTeam ? game.awayTeam : game.homeTeam;
        const winnerScore = Math.max(game.actualHomeScore, game.actualAwayScore);
        const loserScore = Math.min(game.actualHomeScore, game.actualAwayScore);

        eloRatings = updateRatings(eloRatings, winner, loser, winnerScore, loserScore);
      }

      logger.info(`Week ${week} complete`, {
        games: predictions.length,
        correct: allResults.filter(r => r.week === week && r.correct).length
      });
    }

    // Calculate overall accuracy
    const accuracy = calculateAccuracy(allResults);

    const backtestResults = {
      startWeek,
      endWeek,
      season: CURRENT_SEASON,
      lastUpdated: new Date().toISOString(),
      predictions: allPredictions,
      results: allResults,
      accuracy,
      finalEloRatings: eloRatings
    };

    // Save backtest results
    logger.info('Saving backtest results...');
    await dataManager.writeJSON(DATA_PATHS.TEST_RESULTS, backtestResults);

    logger.end('Backtest', startTime);

    logger.info('✅ Backtest complete', {
      weeks: `${startWeek}-${endWeek}`,
      games: allResults.length,
      accuracy: accuracy.accuracy
    });

    return backtestResults;
  } catch (error) {
    logger.error('Backtest failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const startWeek = parseInt(process.argv[2]) || 1;
  const endWeek = process.argv[3] ? parseInt(process.argv[3]) : null;

  backtest(startWeek, endWeek)
    .then((result) => {
      logger.info('Backtest workflow completed successfully');
      console.log('\nBacktest Results:');
      console.log(`Weeks: ${result.startWeek}-${result.endWeek}`);
      console.log(`Total Games: ${result.results.length}`);
      console.log(`Accuracy: ${result.accuracy.accuracy}%`);
      console.log(`\nBy Confidence:`);
      console.log(`  High: ${result.accuracy.byConfidence.high.correct}/${result.accuracy.byConfidence.high.total} (${result.accuracy.byConfidence.high.accuracy.toFixed(1)}%)`);
      console.log(`  Medium: ${result.accuracy.byConfidence.medium.correct}/${result.accuracy.byConfidence.medium.total} (${result.accuracy.byConfidence.medium.accuracy.toFixed(1)}%)`);
      console.log(`  Low: ${result.accuracy.byConfidence.low.correct}/${result.accuracy.byConfidence.low.total} (${result.accuracy.byConfidence.low.accuracy.toFixed(1)}%)`);
      process.exit(0);
    })
    .catch(error => {
      logger.error('Backtest workflow failed', { error: error.message });
      process.exit(1);
    });
}

export default backtest;

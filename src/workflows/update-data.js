#!/usr/bin/env node
/**
 * NFLv2 - Data Update Workflow
 * Fetches and caches all NFL data (games, stats, injuries)
 */

import { apiClient } from '../core/api-client.js';
import { dataManager } from '../core/data-manager.js';
import { DATA_PATHS, UPDATE_CONFIG, CURRENT_SEASON } from '../core/constants.js';
import { extractTeamStats, aggregateStats, calculateRankings } from '../utils/stats-parser.js';
import { logger } from '../utils/logger.js';

async function updateData() {
  const startTime = logger.start('Data update');

  try {
    // Step 1: Fetch all completed games
    logger.info('Fetching all completed games...');
    const summaries = await apiClient.getAllBoxscores(1, 18);

    // Step 2: Parse game statistics
    logger.info('Parsing game statistics...');
    const gameStats = [];
    let successfulParses = 0;
    let failedParses = 0;

    for (const summary of summaries) {
      const stats = extractTeamStats(summary);

      if (stats) {
        // Get game info
        const gameInfo = summary.header?.competitions?.[0];
        if (!gameInfo) continue;

        const teams = gameInfo.competitors;
        if (!teams || teams.length !== 2) continue;

        const homeTeam = teams.find(t => t.homeAway === 'home');
        const awayTeam = teams.find(t => t.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        gameStats.push({
          id: summary.header.id,
          date: gameInfo.date,
          week: summary.header.week,
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          scores: {
            [homeTeam.team.displayName]: parseInt(homeTeam.score) || 0,
            [awayTeam.team.displayName]: parseInt(awayTeam.score) || 0
          },
          stats
        });

        successfulParses++;
      } else {
        failedParses++;
      }
    }

    logger.info('Game stats parsed', {
      total: summaries.length,
      successful: successfulParses,
      failed: failedParses
    });

    // Step 3: Aggregate team statistics
    logger.info('Aggregating team statistics...');
    const teamAggregates = aggregateStats(gameStats);

    // Step 4: Calculate rankings
    logger.info('Calculating rankings...');
    const rankings = calculateRankings(teamAggregates);

    // Step 5: Fetch injury data
    logger.info('Fetching injury data...');
    const injuries = await apiClient.getInjuryData();

    // Group injuries by team
    const injuriesByTeam = {};
    injuries.forEach(injury => {
      if (!injuriesByTeam[injury.team]) {
        injuriesByTeam[injury.team] = [];
      }
      injuriesByTeam[injury.team].push(injury);
    });

    // Step 6: Load manual injury overrides (if they exist)
    let manualInjuries = {};
    try {
      manualInjuries = await dataManager.readJSON(DATA_PATHS.MANUAL_INJURIES) || {};
    } catch (error) {
      logger.debug('No manual injuries file found');
    }

    // Merge manual injuries
    Object.entries(manualInjuries).forEach(([team, teamInjuries]) => {
      if (!injuriesByTeam[team]) {
        injuriesByTeam[team] = [];
      }
      injuriesByTeam[team].push(...teamInjuries);
    });

    // Step 7: Get current week's games (upcoming)
    logger.info('Fetching current week games...');
    const currentGames = await apiClient.getScoreboard();

    // Parse current games
    const upcomingGames = currentGames
      .filter(game => {
        const status = game.status?.type?.state;
        return status === 'pre' || status === 'in';
      })
      .map(game => {
        const comp = game.competitions?.[0];
        if (!comp) return null;

        const teams = comp.competitors;
        if (!teams || teams.length !== 2) return null;

        const homeTeam = teams.find(t => t.homeAway === 'home');
        const awayTeam = teams.find(t => t.homeAway === 'away');

        if (!homeTeam || !awayTeam) return null;

        return {
          id: game.id,
          date: comp.date,
          status: game.status?.type?.state,
          homeTeam: homeTeam.team.displayName,
          awayTeam: awayTeam.team.displayName,
          homeScore: parseInt(homeTeam.score) || 0,
          awayScore: parseInt(awayTeam.score) || 0
        };
      })
      .filter(g => g !== null);

    // Step 8: Prepare cached data object
    const cachedData = {
      lastUpdated: new Date().toISOString(),
      season: CURRENT_SEASON,
      gameStats,
      teamStats: teamAggregates,
      rankings,
      injuries: injuriesByTeam,
      upcomingGames,
      summary: {
        totalGames: gameStats.length,
        upcomingGames: upcomingGames.length,
        injuredPlayers: injuries.length,
        lastUpdate: new Date().toISOString()
      }
    };

    // Step 9: Save cached data atomically
    logger.info('Saving cached data...');
    await dataManager.writeJSON(DATA_PATHS.CACHED_DATA, cachedData);

    // Clear API cache for next run
    apiClient.clearCache();

    logger.end('Data update', startTime);

    logger.info('✅ Data update complete', {
      games: gameStats.length,
      upcoming: upcomingGames.length,
      injuries: injuries.length
    });

    return cachedData;
  } catch (error) {
    logger.error('Data update failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateData()
    .then(() => {
      logger.info('Data update workflow completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Data update workflow failed', { error: error.message });
      process.exit(1);
    });
}

export default updateData;

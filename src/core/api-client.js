/**
 * NFLv2 - Unified API Client
 * Handles all external API calls with retry logic, rate limiting, and caching
 */

import fetch from 'node-fetch';
import { API_ENDPOINTS, API_CONFIG, CURRENT_SEASON } from './constants.js';
import { logger } from '../utils/logger.js';

class APIClient {
  constructor() {
    this.requestCache = new Map();
    this.requestQueue = [];
    this.activeRequests = 0;
  }

  /**
   * Generic fetch with retry logic and timeout
   */
  async fetchWithRetry(url, options = {}, retryCount = 0) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);

      // If we haven't exceeded max retries, try again
      if (retryCount < API_CONFIG.MAX_RETRIES) {
        const delay = API_CONFIG.RETRY_DELAYS[retryCount];
        logger.warn(`API request failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${API_CONFIG.MAX_RETRIES})`, { url, error: error.message });

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      logger.error('API request failed after all retries', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Cached fetch - returns cached data if available
   */
  async cachedFetch(url, options = {}) {
    const cacheKey = url;

    if (this.requestCache.has(cacheKey)) {
      logger.debug('Returning cached response', { url });
      return this.requestCache.get(cacheKey);
    }

    const data = await this.fetchWithRetry(url, options);
    this.requestCache.set(cacheKey, data);
    return data;
  }

  /**
   * Rate-limited parallel fetch
   */
  async parallelFetch(urls, options = {}) {
    const results = [];

    for (let i = 0; i < urls.length; i += API_CONFIG.MAX_CONCURRENT) {
      const batch = urls.slice(i, i + API_CONFIG.MAX_CONCURRENT);
      const batchPromises = batch.map(url =>
        this.cachedFetch(url, options).catch(error => {
          logger.error('Parallel fetch error', { url, error: error.message });
          return null; // Return null for failed requests
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting delay between batches
      if (i + API_CONFIG.MAX_CONCURRENT < urls.length) {
        await new Promise(resolve => setTimeout(resolve, API_CONFIG.RATE_LIMIT_DELAY));
      }
    }

    return results;
  }

  /**
   * ESPN API - Get scoreboard (games for a specific week)
   */
  async getScoreboard(week = null, seasonType = 2) {
    const params = new URLSearchParams({
      dates: CURRENT_SEASON.toString(),
      seasontype: seasonType.toString(),
      limit: '100'
    });

    if (week !== null) {
      params.append('week', week.toString());
    }

    const url = `${API_ENDPOINTS.ESPN_BASE}${API_ENDPOINTS.ESPN_SCOREBOARD}?${params}`;

    try {
      const data = await this.cachedFetch(url);
      return data.events || [];
    } catch (error) {
      logger.error('Failed to fetch scoreboard', { week, error: error.message });
      return [];
    }
  }

  /**
   * ESPN API - Get game summary (detailed boxscore)
   */
  async getGameSummary(eventId) {
    const url = `${API_ENDPOINTS.ESPN_BASE}${API_ENDPOINTS.ESPN_SUMMARY}?event=${eventId}`;

    try {
      return await this.cachedFetch(url);
    } catch (error) {
      logger.error('Failed to fetch game summary', { eventId, error: error.message });
      return null;
    }
  }

  /**
   * ESPN API - Get multiple game summaries in parallel
   */
  async getGameSummaries(eventIds) {
    const urls = eventIds.map(id =>
      `${API_ENDPOINTS.ESPN_BASE}${API_ENDPOINTS.ESPN_SUMMARY}?event=${id}`
    );

    logger.info(`Fetching ${eventIds.length} game summaries in parallel`);
    return await this.parallelFetch(urls);
  }

  /**
   * ESPN API - Get all games for a week range
   */
  async getWeekRange(startWeek, endWeek, seasonType = 2) {
    const weeks = [];
    for (let week = startWeek; week <= endWeek; week++) {
      weeks.push(week);
    }

    const weekPromises = weeks.map(week => this.getScoreboard(week, seasonType));
    const weekResults = await Promise.all(weekPromises);

    // Flatten all games from all weeks
    const allGames = weekResults.flat();
    logger.info(`Fetched ${allGames.length} games from weeks ${startWeek}-${endWeek}`);

    return allGames;
  }

  /**
   * ESPN API - Get all boxscores for completed games
   */
  async getAllBoxscores(startWeek = 1, endWeek = 18) {
    logger.info(`Fetching all boxscores for weeks ${startWeek}-${endWeek}`);

    // Get all games first
    const games = await this.getWeekRange(startWeek, endWeek);

    // Filter to completed games only
    const completedGames = games.filter(game => {
      const status = game.status?.type?.state;
      return status === 'post';
    });

    logger.info(`Found ${completedGames.length} completed games`);

    // Get event IDs
    const eventIds = completedGames.map(game => game.id);

    // Fetch all summaries in parallel
    const summaries = await this.getGameSummaries(eventIds);

    // Filter out null results (failed requests)
    const validSummaries = summaries.filter(s => s !== null);

    logger.info(`Successfully fetched ${validSummaries.length}/${completedGames.length} boxscores`);

    return validSummaries;
  }

  /**
   * Sleeper API - Get all NFL players with injury data
   */
  async getInjuryData() {
    try {
      logger.info('Fetching injury data from Sleeper API');
      const data = await this.cachedFetch(API_ENDPOINTS.SLEEPER_PLAYERS);

      // Filter to injured players only
      const injuredPlayers = Object.entries(data)
        .filter(([_, player]) => player.injury_status && player.injury_status !== 'Healthy')
        .map(([id, player]) => ({
          id,
          name: `${player.first_name} ${player.last_name}`,
          team: player.team,
          position: player.position,
          depthChartPosition: player.depth_chart_position,
          injuryStatus: player.injury_status,
          injuryBodyPart: player.injury_body_part,
          injuryNotes: player.injury_notes
        }));

      logger.info(`Found ${injuredPlayers.length} injured players`);
      return injuredPlayers;
    } catch (error) {
      logger.error('Failed to fetch injury data', { error: error.message });
      return [];
    }
  }

  /**
   * Clear the request cache (call between update cycles)
   */
  clearCache() {
    const cacheSize = this.requestCache.size;
    this.requestCache.clear();
    logger.debug(`Cleared API cache (${cacheSize} entries)`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.requestCache.size,
      keys: Array.from(this.requestCache.keys())
    };
  }
}

// Singleton instance
export const apiClient = new APIClient();
export default apiClient;

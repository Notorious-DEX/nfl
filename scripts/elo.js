/**
 * NFL Elo Rating System
 *
 * Implementation of Elo ratings for NFL teams with:
 * - Standard 1500 starting rating
 * - K-factor of 20 (balanced reactivity)
 * - Home field advantage adjustment
 * - Season-start regression to mean
 */

// Constants
const INITIAL_ELO = 1500;
const LEAGUE_MEAN = 1500;
const K_FACTOR = 20;
const HOME_ADVANTAGE = 65; // ~2.5 point spread advantage

/**
 * Calculate expected win probability for team A
 * @param {number} eloA - Elo rating of team A
 * @param {number} eloB - Elo rating of team B
 * @returns {number} Expected win probability (0-1)
 */
function expectedScore(eloA, eloB) {
    return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Update Elo ratings after a game
 * @param {number} winnerElo - Current Elo of winning team
 * @param {number} loserElo - Current Elo of losing team
 * @param {number} marginOfVictory - Point differential (absolute value)
 * @param {boolean} homeWin - Whether home team won
 * @returns {object} Updated ratings {winnerElo, loserElo}
 */
function updateElo(winnerElo, loserElo, marginOfVictory, homeWin) {
    // Calculate expected scores
    const expectedWinner = expectedScore(winnerElo, loserElo);

    // Margin of victory multiplier (dampened)
    const movMultiplier = Math.log(Math.max(1, marginOfVictory) + 1);

    // Actual K-factor with MOV adjustment
    const adjustedK = K_FACTOR * movMultiplier;

    // Update ratings
    const change = adjustedK * (1 - expectedWinner);

    return {
        winnerElo: Math.round(winnerElo + change),
        loserElo: Math.round(loserElo - change)
    };
}

/**
 * Regress Elo rating toward league mean
 * Used at the start of each season to account for offseason changes
 * @param {number} elo - Current Elo rating
 * @param {number} regressionFactor - How much to regress (0-1), default 1/3
 * @returns {number} Regressed Elo rating
 */
function regressToMean(elo, regressionFactor = 1/3) {
    const change = (LEAGUE_MEAN - elo) * regressionFactor;
    return Math.round(elo + change);
}

/**
 * Convert Elo rating difference to expected point spread
 * @param {number} homeElo - Home team Elo
 * @param {number} awayElo - Away team Elo
 * @returns {number} Expected point spread (positive = home favored)
 */
function eloToSpread(homeElo, awayElo) {
    const eloDiff = (homeElo + HOME_ADVANTAGE) - awayElo;
    // Approximate conversion: 25 Elo points ≈ 1 point spread
    return eloDiff / 25;
}

/**
 * Initialize all teams to starting Elo
 * @param {Array<string>} teams - List of team names
 * @returns {Object} Map of team names to initial Elo ratings
 */
function initializeRatings(teams) {
    const ratings = {};
    teams.forEach(team => {
        ratings[team] = INITIAL_ELO;
    });
    return ratings;
}

module.exports = {
    INITIAL_ELO,
    LEAGUE_MEAN,
    K_FACTOR,
    HOME_ADVANTAGE,
    expectedScore,
    updateElo,
    regressToMean,
    eloToSpread,
    initializeRatings
};

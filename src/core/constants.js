/**
 * NFLv2 - Core Constants
 * Single source of truth for all application constants
 */

// Current NFL season (auto-detect based on date)
export const CURRENT_SEASON = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;

// NFL Team Data - Complete mapping
export const NFL_TEAMS = {
  'Arizona Cardinals': { abbrev: 'ARI', location: 'Arizona', name: 'Cardinals', conference: 'NFC', division: 'West' },
  'Atlanta Falcons': { abbrev: 'ATL', location: 'Atlanta', name: 'Falcons', conference: 'NFC', division: 'South' },
  'Baltimore Ravens': { abbrev: 'BAL', location: 'Baltimore', name: 'Ravens', conference: 'AFC', division: 'North' },
  'Buffalo Bills': { abbrev: 'BUF', location: 'Buffalo', name: 'Bills', conference: 'AFC', division: 'East' },
  'Carolina Panthers': { abbrev: 'CAR', location: 'Carolina', name: 'Panthers', conference: 'NFC', division: 'South' },
  'Chicago Bears': { abbrev: 'CHI', location: 'Chicago', name: 'Bears', conference: 'NFC', division: 'North' },
  'Cincinnati Bengals': { abbrev: 'CIN', location: 'Cincinnati', name: 'Bengals', conference: 'AFC', division: 'North' },
  'Cleveland Browns': { abbrev: 'CLE', location: 'Cleveland', name: 'Browns', conference: 'AFC', division: 'North' },
  'Dallas Cowboys': { abbrev: 'DAL', location: 'Dallas', name: 'Cowboys', conference: 'NFC', division: 'East' },
  'Denver Broncos': { abbrev: 'DEN', location: 'Denver', name: 'Broncos', conference: 'AFC', division: 'West' },
  'Detroit Lions': { abbrev: 'DET', location: 'Detroit', name: 'Lions', conference: 'NFC', division: 'North' },
  'Green Bay Packers': { abbrev: 'GB', location: 'Green Bay', name: 'Packers', conference: 'NFC', division: 'North' },
  'Houston Texans': { abbrev: 'HOU', location: 'Houston', name: 'Texans', conference: 'AFC', division: 'South' },
  'Indianapolis Colts': { abbrev: 'IND', location: 'Indianapolis', name: 'Colts', conference: 'AFC', division: 'South' },
  'Jacksonville Jaguars': { abbrev: 'JAX', location: 'Jacksonville', name: 'Jaguars', conference: 'AFC', division: 'South' },
  'Kansas City Chiefs': { abbrev: 'KC', location: 'Kansas City', name: 'Chiefs', conference: 'AFC', division: 'West' },
  'Las Vegas Raiders': { abbrev: 'LV', location: 'Las Vegas', name: 'Raiders', conference: 'AFC', division: 'West' },
  'Los Angeles Chargers': { abbrev: 'LAC', location: 'Los Angeles', name: 'Chargers', conference: 'AFC', division: 'West' },
  'Los Angeles Rams': { abbrev: 'LAR', location: 'Los Angeles', name: 'Rams', conference: 'NFC', division: 'West' },
  'Miami Dolphins': { abbrev: 'MIA', location: 'Miami', name: 'Dolphins', conference: 'AFC', division: 'East' },
  'Minnesota Vikings': { abbrev: 'MIN', location: 'Minnesota', name: 'Vikings', conference: 'NFC', division: 'North' },
  'New England Patriots': { abbrev: 'NE', location: 'New England', name: 'Patriots', conference: 'AFC', division: 'East' },
  'New Orleans Saints': { abbrev: 'NO', location: 'New Orleans', name: 'Saints', conference: 'NFC', division: 'South' },
  'New York Giants': { abbrev: 'NYG', location: 'New York', name: 'Giants', conference: 'NFC', division: 'East' },
  'New York Jets': { abbrev: 'NYJ', location: 'New York', name: 'Jets', conference: 'AFC', division: 'East' },
  'Philadelphia Eagles': { abbrev: 'PHI', location: 'Philadelphia', name: 'Eagles', conference: 'NFC', division: 'East' },
  'Pittsburgh Steelers': { abbrev: 'PIT', location: 'Pittsburgh', name: 'Steelers', conference: 'AFC', division: 'North' },
  'San Francisco 49ers': { abbrev: 'SF', location: 'San Francisco', name: '49ers', conference: 'NFC', division: 'West' },
  'Seattle Seahawks': { abbrev: 'SEA', location: 'Seattle', name: 'Seahawks', conference: 'NFC', division: 'West' },
  'Tampa Bay Buccaneers': { abbrev: 'TB', location: 'Tampa Bay', name: 'Buccaneers', conference: 'NFC', division: 'South' },
  'Tennessee Titans': { abbrev: 'TEN', location: 'Tennessee', name: 'Titans', conference: 'AFC', division: 'South' },
  'Washington Commanders': { abbrev: 'WAS', location: 'Washington', name: 'Commanders', conference: 'NFC', division: 'East' }
};

// Abbreviation to full name mapping
export const ABBREV_TO_NAME = Object.fromEntries(
  Object.entries(NFL_TEAMS).map(([name, data]) => [data.abbrev, name])
);

// Alternate abbreviations (ESPN variations)
export const ABBREV_ALTERNATES = {
  'WSH': 'WAS',
  'LA': 'LAR'
};

// Prediction model constants
export const MODEL_CONSTANTS = {
  HOME_FIELD_ADVANTAGE: 2.5,           // Points added for home team
  MATCHUP_WEIGHT: 0.15,                 // Multiplier for matchup advantages
  DEFAULT_THIRD_DOWN_PCT: 40,           // Default 3rd down % if no data
  DEFAULT_RED_ZONE_PCT: 50,             // Default red zone % if no data
  ELO_K_FACTOR: 20,                     // Elo rating adjustment factor
  ELO_REGRESSION: 1/3,                  // Season start regression to mean (1500)
  ELO_BASE_RATING: 1500,                // Starting Elo rating
  ELO_MOV_MULTIPLIER: 1,                // Margin of victory adjustment
  CONFIDENCE_HIGH_THRESHOLD: 100,       // Elo difference for high confidence
  CONFIDENCE_MEDIUM_THRESHOLD: 50       // Elo difference for medium confidence
};

// API endpoints
export const API_ENDPOINTS = {
  ESPN_BASE: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
  ESPN_SCOREBOARD: '/scoreboard',
  ESPN_SUMMARY: '/summary',
  SLEEPER_PLAYERS: 'https://api.sleeper.app/v1/players/nfl'
};

// API configuration
export const API_CONFIG = {
  TIMEOUT: 10000,                       // 10 second timeout
  MAX_RETRIES: 4,                       // Max retry attempts
  RETRY_DELAYS: [2000, 4000, 8000, 16000], // Exponential backoff (ms)
  RATE_LIMIT_DELAY: 100,                // Delay between parallel requests (ms)
  MAX_CONCURRENT: 10                    // Max concurrent API requests
};

// Data update timing
export const UPDATE_CONFIG = {
  RESULT_CHECK_HOURS: 4,                // Hours after game to check results
  CACHE_LOOKBACK_HOURS: 5,              // Hours to look back for completed games
  MAX_PREDICTION_AGE_DAYS: 7            // Max age of unchecked predictions
};

// File paths
export const DATA_PATHS = {
  CACHED_DATA: './data/cached-data.json',
  PREDICTIONS: './data/predictions.json',
  RESULTS: './data/results.json',
  HISTORICAL_ELO: './data/historical-elo.json',
  MANUAL_INJURIES: './data/manual-injuries.json',
  TEST_PREDICTIONS: './data/test-predictions.json',
  TEST_RESULTS: './data/test-results.json',
  SETTINGS: './src/config/settings.json'
};

// Stat name normalization mapping
export const STAT_NAMES = {
  // Passing stats
  'passingyards': 'passingYards',
  'netpassingyards': 'passingYards',
  'passingYards': 'passingYards',
  'completionAttempts': 'completionAttempts',
  'passcompletions': 'completionAttempts',

  // Rushing stats
  'rushingyards': 'rushingYards',
  'rushingYards': 'rushingYards',
  'rushingAttempts': 'rushingAttempts',
  'rushingattempts': 'rushingAttempts',

  // Other offensive stats
  'totalyards': 'totalYards',
  'totalYards': 'totalYards',
  'possessionTime': 'possessionTime',
  'possessiontime': 'possessionTime',
  'turnovers': 'turnovers',

  // Efficiency stats
  'thirddowneff': 'thirdDownEff',
  'thirdDownEff': 'thirdDownEff',
  'fourthdowneff': 'fourthDownEff',
  'fourthDownEff': 'fourthDownEff',
  'redZoneAttempts': 'redZoneAttempts',
  'redzoneeff': 'redZoneEff',
  'redZoneEff': 'redZoneEff',

  // Defensive stats
  'sacks': 'sacks',
  'sacks-yardslost': 'sacks',
  'sacksYardsLost': 'sacks',
  'tacklesForLoss': 'tacklesForLoss'
};

// Week schedule (for workflow timing)
export const WEEK_SCHEDULE = {
  THURSDAY: { gameTime: '20:15', updateTimes: ['16:15', '19:15', '20:00'] },
  SATURDAY: { gameTimes: ['12:00', '15:00', '16:00', '19:00', '20:00'], updateTimes: ['11:45', '14:45', '15:45', '18:45', '19:45'] },
  SUNDAY: { gameTimes: ['13:00', '16:25', '20:20'], updateTimes: ['12:45', '16:00', '17:00', '19:15', '20:05'] },
  MONDAY: { gameTime: '20:15', updateTimes: ['16:15', '19:15', '20:00'] }
};

export default {
  CURRENT_SEASON,
  NFL_TEAMS,
  ABBREV_TO_NAME,
  ABBREV_ALTERNATES,
  MODEL_CONSTANTS,
  API_ENDPOINTS,
  API_CONFIG,
  UPDATE_CONFIG,
  DATA_PATHS,
  STAT_NAMES,
  WEEK_SCHEDULE
};

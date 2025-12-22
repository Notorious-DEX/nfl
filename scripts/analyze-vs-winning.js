#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load the results data
const resultsPath = path.join(__dirname, '..', 'results.json');
const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const results = resultsData.games || [];

// Track each team's record as the season progresses
const teamRecords = {};
const vsWinningTeams = {};

// Initialize all teams
const allTeams = new Set();
results.forEach(game => {
  if (game.homeTeam) allTeams.add(game.homeTeam);
  if (game.awayTeam) allTeams.add(game.awayTeam);
});

allTeams.forEach(team => {
  teamRecords[team] = { wins: 0, losses: 0 };
  vsWinningTeams[team] = { wins: 0, losses: 0, games: [] };
});

// Sort games by week to process chronologically
results.sort((a, b) => a.week - b.week);

// Process each game
results.forEach(game => {
  // Skip games without actual results
  if (typeof game.actualHomeScore === 'undefined' || typeof game.actualAwayScore === 'undefined') return;
  if (!game.homeTeam || !game.awayTeam) return;

  const homeTeam = game.homeTeam;
  const awayTeam = game.awayTeam;

  // Check opponent's record at time of this game
  const homeRecord = teamRecords[homeTeam];
  const awayRecord = teamRecords[awayTeam];

  const homeWinPct = homeRecord.wins + homeRecord.losses === 0 ? 0.000 : homeRecord.wins / (homeRecord.wins + homeRecord.losses);
  const awayWinPct = awayRecord.wins + awayRecord.losses === 0 ? 0.000 : awayRecord.wins / (awayRecord.wins + awayRecord.losses);

  const homeWon = game.actualHomeScore > game.actualAwayScore;

  // Check if opponent had .500 or better record
  if (awayWinPct >= 0.500) {
    if (homeWon) {
      vsWinningTeams[homeTeam].wins++;
    } else {
      vsWinningTeams[homeTeam].losses++;
    }
    vsWinningTeams[homeTeam].games.push(`W${game.week} vs ${awayTeam} (${awayRecord.wins}-${awayRecord.losses})`);
  }

  if (homeWinPct >= 0.500) {
    if (!homeWon) {
      vsWinningTeams[awayTeam].wins++;
    } else {
      vsWinningTeams[awayTeam].losses++;
    }
    vsWinningTeams[awayTeam].games.push(`W${game.week} @ ${homeTeam} (${homeRecord.wins}-${homeRecord.losses})`);
  }

  // Update records after this game
  if (homeWon) {
    teamRecords[homeTeam].wins++;
    teamRecords[awayTeam].losses++;
  } else {
    teamRecords[awayTeam].wins++;
    teamRecords[homeTeam].losses++;
  }
});

// Sort teams by win percentage vs .500+ teams
const sorted = Object.entries(vsWinningTeams)
  .map(([team, record]) => {
    const total = record.wins + record.losses;
    const pct = total === 0 ? 0 : record.wins / total;
    return { team, wins: record.wins, losses: record.losses, total, pct };
  })
  .filter(r => r.total > 0)
  .sort((a, b) => b.pct - a.pct || b.wins - a.wins);

console.log('\n📊 Team Records vs .500+ Teams (at time of matchup)\n');
console.log('Rank | Team                    | Record | Win% |');
console.log('-----|-------------------------|--------|------|');

sorted.forEach((record, i) => {
  const rank = (i + 1).toString().padStart(2);
  const team = record.team.padEnd(23);
  const recordStr = `${record.wins}-${record.losses}`.padEnd(6);
  const pct = (record.pct * 100).toFixed(1).padStart(4);
  console.log(`${rank}   | ${team} | ${recordStr} | ${pct}% |`);
});

console.log('\n');

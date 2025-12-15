#!/usr/bin/env node

/**
 * Validate Historical Data Availability
 * Tests ESPN API access to 2022-2024 seasons to confirm 3 years of data
 * for Elo rating implementation
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function validateYear(year) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${year} Season`);
    console.log('='.repeat(60));

    const results = {
        year,
        accessible: false,
        weeksChecked: 0,
        totalGames: 0,
        boxscoresAvailable: 0,
        boxscoresFailed: 0,
        sampleGames: []
    };

    // Check weeks 1, 5, 10, 15 (sample across season)
    const testWeeks = [1, 5, 10, 15];

    for (const week of testWeeks) {
        try {
            const response = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=2&week=${week}`
            );

            if (!response.ok) {
                console.log(`  ❌ Week ${week}: HTTP ${response.status}`);
                continue;
            }

            const data = await response.json();
            const games = data.events || [];

            if (games.length === 0) {
                console.log(`  ⚠️  Week ${week}: No games found`);
                continue;
            }

            results.accessible = true;
            results.weeksChecked++;
            results.totalGames += games.length;

            console.log(`  ✅ Week ${week}: ${games.length} games found`);

            // Test boxscore availability for first game of each week
            if (games.length > 0) {
                const testGame = games[0];
                const comp = testGame.competitions[0];
                const home = comp.competitors.find(c => c.homeAway === 'home').team.displayName;
                const away = comp.competitors.find(c => c.homeAway === 'away').team.displayName;

                try {
                    const statsUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${testGame.id}`;
                    const statsResponse = await fetch(statsUrl);
                    const statsData = await statsResponse.json();

                    if (statsData.boxscore && statsData.boxscore.teams) {
                        results.boxscoresAvailable++;
                        console.log(`     📊 Boxscore available: ${away} @ ${home}`);

                        if (week === 1) {
                            results.sampleGames.push(`${away} @ ${home}`);
                        }
                    } else {
                        results.boxscoresFailed++;
                        console.log(`     ⚠️  Boxscore missing: ${away} @ ${home}`);
                    }
                } catch (e) {
                    results.boxscoresFailed++;
                    console.log(`     ❌ Boxscore error: ${away} @ ${home}`);
                }
            }

        } catch (error) {
            console.log(`  ❌ Week ${week}: ${error.message}`);
        }
    }

    return results;
}

async function main() {
    console.log('🏈 Historical Data Validation for Elo Implementation');
    console.log('Testing 3 years of ESPN API data (2022-2024)\n');

    const allResults = [];

    // Test each year
    for (const year of [2022, 2023, 2024]) {
        const result = await validateYear(year);
        allResults.push(result);
    }

    // Summary report
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));

    let fullyAccessible = 0;
    let totalGames = 0;
    let totalBoxscores = 0;

    for (const result of allResults) {
        console.log(`\n${result.year}:`);
        console.log(`  Status: ${result.accessible ? '✅ Accessible' : '❌ Not Accessible'}`);
        console.log(`  Weeks Checked: ${result.weeksChecked}/4 sample weeks`);
        console.log(`  Total Games: ${result.totalGames}`);
        console.log(`  Boxscores: ${result.boxscoresAvailable} available, ${result.boxscoresFailed} failed`);

        if (result.sampleGames.length > 0) {
            console.log(`  Sample: ${result.sampleGames[0]}`);
        }

        if (result.accessible && result.weeksChecked >= 3) {
            fullyAccessible++;
        }
        totalGames += result.totalGames;
        totalBoxscores += result.boxscoresAvailable;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('CONCLUSION');
    console.log('='.repeat(60));

    if (fullyAccessible >= 3) {
        console.log('✅ SUCCESS: 3 years of historical data confirmed');
        console.log(`   Total games validated: ${totalGames}`);
        console.log(`   Boxscore availability: ${totalBoxscores}/${allResults.length * 4} sample games`);
        console.log('\n✅ Ready to implement Elo carryover system');
        process.exit(0);
    } else {
        console.log(`❌ FAILURE: Only ${fullyAccessible} years fully accessible`);
        console.log('   Cannot proceed with 3-year Elo implementation');
        console.log('   Consider: 2-year lookback or current season only');
        process.exit(1);
    }
}

main();

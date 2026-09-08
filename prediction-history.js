let allGames = [];
let filteredGames = [];
let currentSort = { column: 'date', direction: 'asc' };

function nflSeasonYear(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    return month >= 7 ? year : year - 1;
}

function gameSeason(game) {
    if (game.seasonYear) return Number(game.seasonYear);
    return nflSeasonYear(game.date);
}

function currentNflSeason() {
    return nflSeasonYear(new Date().toISOString());
}

function availableSeasons() {
    const years = new Set(allGames.map(gameSeason).filter(Boolean));
    const current = currentNflSeason();
    if (current) {
        years.add(current);
        years.add(current - 1);
    }
    return [...years].sort((a, b) => b - a);
}

function fillSelect(select, values, allLabel, labelFn) {
    const previous = select.value || 'all';
    select.innerHTML = '';
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = allLabel;
    select.appendChild(all);
    values.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = labelFn ? labelFn(value) : value;
        select.appendChild(option);
    });
    select.value = [...select.options].some((o) => o.value === previous) ? previous : 'all';
}

function gamesForSeasonFilter() {
    const seasonFilter = document.getElementById('seasonFilter').value;
    if (seasonFilter === 'all') return allGames;
    const year = Number(seasonFilter);
    return allGames.filter((g) => gameSeason(g) === year);
}

function populateFilters() {
    fillSelect(document.getElementById('seasonFilter'), availableSeasons(), 'All Seasons', (y) => y + ' Season');
    const scoped = gamesForSeasonFilter();
    const weeks = [...new Set(scoped.map((g) => g.week).filter((w) => w != null))].sort((a, b) => a - b);
    fillSelect(document.getElementById('weekFilter'), weeks, 'All Weeks', (w) => 'Week ' + w);
    const teams = new Set();
    scoped.forEach((game) => {
        teams.add(game.homeTeam);
        teams.add(game.awayTeam);
    });
    fillSelect(document.getElementById('teamFilter'), [...teams].sort(), 'All Teams');
}

function updateStats() {
    const correct = filteredGames.filter((g) => g.correct).length;
    const total = filteredGames.length;
    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
    document.getElementById('totalGames').textContent = total;
    document.getElementById('correctPredictions').textContent = correct;
    document.getElementById('overallAccuracy').textContent = accuracy + '%';
}

function statList(title, rows, good) {
    let html = '<div class="analytics-card"><h3>' + title + '</h3>';
    rows.forEach((row) => {
        html += '<div class="analytics-item"><span>' + row.label + '</span><span class="' +
            (good ? 'correct' : 'incorrect') + '">' + row.value + '</span></div>';
    });
    return html + '</div>';
}

function updateAnalytics() {
    const weeklyStats = {};
    const teamStats = {};
    const confidenceStats = {};
    filteredGames.forEach((game) => {
        if (!weeklyStats[game.week]) weeklyStats[game.week] = { correct: 0, total: 0 };
        weeklyStats[game.week].total++;
        if (game.correct) weeklyStats[game.week].correct++;
        [game.homeTeam, game.awayTeam].forEach((team) => {
            if (!teamStats[team]) teamStats[team] = { correct: 0, total: 0 };
            teamStats[team].total++;
            if (game.correct) teamStats[team].correct++;
        });
        const conf = game.confidence || 'medium';
        if (!confidenceStats[conf]) confidenceStats[conf] = { correct: 0, total: 0 };
        confidenceStats[conf].total++;
        if (game.correct) confidenceStats[conf].correct++;
    });

    const weeklyArray = Object.entries(weeklyStats).map(([week, stats]) => ({
        week, accuracy: (stats.correct / stats.total * 100).toFixed(1)
    })).sort((a, b) => b.accuracy - a.accuracy);

    const teamArray = Object.entries(teamStats)
        .filter(([, stats]) => stats.total >= 3)
        .map(([team, stats]) => ({
            team,
            record: stats.correct + '-' + (stats.total - stats.correct),
            accuracy: (stats.correct / stats.total * 100).toFixed(1)
        }))
        .sort((a, b) => b.accuracy - a.accuracy);

    let html = statList('Best Weeks', weeklyArray.slice(0, 5).map((w) => ({ label: 'Week ' + w.week, value: w.accuracy + '%' })), true);
    html += statList('Worst Weeks', weeklyArray.slice(-5).reverse().map((w) => ({ label: 'Week ' + w.week, value: w.accuracy + '%' })), false);
    html += statList('Best Team Predictions', teamArray.slice(0, 5).map((t) => ({ label: t.team, value: t.record + ' (' + t.accuracy + '%)' })), true);
    html += statList('Worst Team Predictions', teamArray.slice(-5).reverse().map((t) => ({ label: t.team, value: t.record + ' (' + t.accuracy + '%)' })), false);

    html += '<div class="analytics-card"><h3>Confidence Performance</h3>';
    ['high', 'medium', 'low'].forEach((conf) => {
        const stats = confidenceStats[conf];
        if (!stats || !stats.total) return;
        const accuracy = ((stats.correct / stats.total) * 100).toFixed(1);
        const color = accuracy >= 65 ? 'correct' : 'incorrect';
        html += '<div class="analytics-item"><span>' + conf.toUpperCase() + '</span><span class="' + color + '">' +
            stats.correct + '-' + (stats.total - stats.correct) + ' (' + accuracy + '%)</span></div>';
    });
    html += '</div>';
    document.getElementById('analytics').innerHTML = html;
}

function renderTable() {
    const tbody = document.getElementById('gameTable');
    if (!filteredGames.length) {
        const season = document.getElementById('seasonFilter').value;
        const msg = season !== 'all'
            ? 'No ' + season + ' results yet. Finished games will show up here automatically.'
            : 'No games match your filters';
        tbody.innerHTML = '<tr><td colspan="9" class="loading">' + msg + '</td></tr>';
        return;
    }
    tbody.innerHTML = filteredGames.map((game) => {
        const date = new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const confidence = game.confidence || 'medium';
        const weekDisplay = game.playoffRound
            ? '<span class="week-badge playoff">' + game.playoffRound + '</span>'
            : '<span class="week-badge">Week ' + game.week + '</span>';
        const resultClass = game.correct ? 'correct' : 'incorrect';
        return '<tr>' +
            '<td>' + weekDisplay + '</td>' +
            '<td>' + date + '</td>' +
            '<td>' + game.awayTeam + ' @ ' + game.homeTeam + '</td>' +
            '<td>' + game.winner + '</td>' +
            '<td><span class="confidence-badge confidence-' + confidence + '">' + confidence.toUpperCase() + '</span></td>' +
            '<td class="' + resultClass + '">' + (game.actualWinner || 'TBD') + '</td>' +
            '<td class="predicted">' + game.awayScore + '-' + game.homeScore + '</td>' +
            '<td class="actual">' + (game.actualAwayScore || '-') + '-' + (game.actualHomeScore || '-') + '</td>' +
            '<td class="' + resultClass + '">' + (game.correct ? '\u2705' : '\u274c') + '</td>' +
            '</tr>';
    }).join('');
}

function applyFilters() {
    const seasonFilter = document.getElementById('seasonFilter').value;
    const weekFilter = document.getElementById('weekFilter').value;
    const teamFilter = document.getElementById('teamFilter').value;
    const resultFilter = document.getElementById('resultFilter').value;
    const confidenceFilter = document.getElementById('confidenceFilter').value;
    const searchInput = document.getElementById('searchInput').value.toLowerCase();

    filteredGames = allGames.filter((game) => {
        if (seasonFilter !== 'all' && String(gameSeason(game)) !== seasonFilter) return false;
        if (weekFilter !== 'all' && String(game.week) !== weekFilter) return false;
        if (teamFilter !== 'all' && game.homeTeam !== teamFilter && game.awayTeam !== teamFilter) return false;
        if (resultFilter === 'correct' && !game.correct) return false;
        if (resultFilter === 'incorrect' && game.correct) return false;
        if (confidenceFilter !== 'all' && (game.confidence || 'medium') !== confidenceFilter) return false;
        if (searchInput && !game.homeTeam.toLowerCase().includes(searchInput) && !game.awayTeam.toLowerCase().includes(searchInput)) return false;
        return true;
    });
    updateStats();
    updateAnalytics();
    sortTable(currentSort.column, currentSort.direction);
}

function resetFilters() {
    document.getElementById('seasonFilter').value = String(currentNflSeason() || 'all');
    populateFilters();
    document.getElementById('weekFilter').value = 'all';
    document.getElementById('teamFilter').value = 'all';
    document.getElementById('resultFilter').value = 'all';
    document.getElementById('confidenceFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    filteredGames = gamesForSeasonFilter();
    updateStats();
    updateAnalytics();
    renderTable();
}

function sortTable(column, direction) {
    currentSort = { column, direction };
    const confOrder = { high: 3, medium: 2, low: 1 };
    filteredGames.sort((a, b) => {
        let aVal, bVal;
        if (column === 'week') { aVal = a.week; bVal = b.week; }
        else if (column === 'date') { aVal = new Date(a.date); bVal = new Date(b.date); }
        else if (column === 'matchup') { aVal = a.awayTeam + a.homeTeam; bVal = b.awayTeam + b.homeTeam; }
        else if (column === 'predicted') { aVal = a.winner; bVal = b.winner; }
        else if (column === 'confidence') { aVal = confOrder[a.confidence] || 2; bVal = confOrder[b.confidence] || 2; }
        else if (column === 'actual') { aVal = a.actualWinner || ''; bVal = b.actualWinner || ''; }
        else if (column === 'result') { aVal = a.correct ? 1 : 0; bVal = b.correct ? 1 : 0; }
        else return 0;
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    document.querySelectorAll('th').forEach((th) => th.classList.remove('sorted-asc', 'sorted-desc'));
    const th = document.querySelector('th[data-sort="' + column + '"]');
    if (th) th.classList.add(direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
    renderTable();
}

async function loadPredictionHistory() {
    try {
        const response = await fetch('results.json');
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();
        allGames = data.games || [];
        populateFilters();
        const current = currentNflSeason();
        if (current) {
            document.getElementById('seasonFilter').value = String(current);
            populateFilters();
        }
        filteredGames = gamesForSeasonFilter();
        updateStats();
        updateAnalytics();
        renderTable();
    } catch (error) {
        console.error('Error loading prediction history:', error);
        document.getElementById('gameTable').innerHTML =
            '<tr><td colspan="9" class="loading" style="color:#e74c3c;">Error loading prediction history.</td></tr>';
    }
}

document.getElementById('seasonFilter').addEventListener('change', () => { populateFilters(); applyFilters(); });
document.getElementById('weekFilter').addEventListener('change', applyFilters);
document.getElementById('teamFilter').addEventListener('change', applyFilters);
document.getElementById('resultFilter').addEventListener('change', applyFilters);
document.getElementById('confidenceFilter').addEventListener('change', applyFilters);
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
        const column = th.dataset.sort;
        const direction = currentSort.column === column && currentSort.direction === 'asc' ? 'desc' : 'asc';
        sortTable(column, direction);
    });
});

loadPredictionHistory();
setInterval(loadPredictionHistory, 5 * 60 * 1000);

const backToTopButton = document.getElementById('backToTop');
if (backToTopButton) {
    window.addEventListener('scroll', () => {
        backToTopButton.classList.toggle('visible', window.pageYOffset > 300);
    });
    backToTopButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

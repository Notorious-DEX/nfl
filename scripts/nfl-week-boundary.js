/** NFL week runs through Monday 11:59:59 PM America/New_York (MNF is the last game). */
function nflNowParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return {
        weekday: parts.weekday,
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day)
    };
}

function isAfterMondayWeekEnd(date = new Date()) {
    const p = nflNowParts(date);
    if (p.weekday === 'Tue' || p.weekday === 'Wed') return true;
    if (p.weekday === 'Mon' && (p.hour > 23 || (p.hour === 23 && p.minute >= 59))) return true;
    return false;
}

function displayNflWeek(espnWeek, date = new Date()) {
    const week = Number(espnWeek) || 0;
    if (!week) return week;
    return isAfterMondayWeekEnd(date) ? week + 1 : week;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { nflNowParts, isAfterMondayWeekEnd, displayNflWeek };
}

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let text = fs.readFileSync(file, 'utf8');

text = text.replace(
    '<option value="all">All</option>\n                                <option value="high">High</option>',
    '<option value="all">All</option>\n                                <option value="high" selected>High</option>'
);

text = text.replace(
    "id=\"accuracyScopeLabel\" style=\"color: #95a5a6;\">All-Time Performance</p>",
    "id=\"accuracyScopeLabel\" style=\"color: #95a5a6;\">All-Time High Confidence Performance</p>"
);

text = text.replace(
    "const confidence = (document.getElementById('accuracyConfidenceFilter') || {}).value || 'all';",
    "const confidence = (document.getElementById('accuracyConfidenceFilter') || {}).value || 'high';"
);

const bind = `function bindAccuracyFilters() {
            const seasonSelect = document.getElementById('accuracySeasonFilter');
            const confSelect = document.getElementById('accuracyConfidenceFilter');`;
if (text.includes(bind) && !text.includes("confSelect.value = 'high'")) {
    text = text.replace(
        bind,
        `function bindAccuracyFilters() {
            const seasonSelect = document.getElementById('accuracySeasonFilter');
            const confSelect = document.getElementById('accuracyConfidenceFilter');
            if (confSelect && !confSelect.dataset.defaulted) {
                confSelect.dataset.defaulted = '1';
                confSelect.value = 'high';
            }`
    );
}

fs.writeFileSync(file, text);
console.log('Default accuracy confidence is High');

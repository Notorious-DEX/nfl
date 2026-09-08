#!/usr/bin/env node

/**
 * Generate NFL Predictions
 * Uses EXACT same algorithm as index.html for consistency
 */

const fs = require('fs');
const path = require('path');
const { fetch, currentNflSeasonYear } = require('./espn-fetch');

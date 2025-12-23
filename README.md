# NFL Predictions v2

Advanced NFL game predictions using combined Elo rating and efficiency models.

## 🎯 Features

- **Dual Model Approach**: Combines Elo ratings (60%) and efficiency metrics (40%)
- **Real-time Updates**: Data refreshes every 2-3 minutes during game times
- **Historical Analysis**: Backtesting against full season data
- **Modern UI**: Clean, responsive interface with dark theme
- **Automated Workflow**: GitHub Actions for continuous updates
- **Comprehensive Stats**: Team rankings, injury reports, and situational analysis

## 📊 Model Details

### Elo Rating Model
- K-factor of 20 with margin-of-victory adjustments
- Season-start regression (1/3 toward mean)
- Home field advantage: 2.5 points
- Historical database from 2022-2025

### Efficiency Model
- Offensive/defensive efficiency based on yards and points
- Matchup analysis (rush vs pass)
- Third-down and red-zone efficiency adjustments
- League-average normalized ratings

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/NFLv2.git
cd NFLv2

# Install dependencies
npm install

# Run initial data update
npm run update

# Generate predictions
npm run predict
```

### Commands

- `npm run update` - Fetch and cache all NFL data
- `npm run predict` - Generate predictions for upcoming games
- `npm run check` - Check prediction results
- `npm run backtest` - Run backtest analysis
- `npm run all` - Update data and generate predictions

## 📁 Project Structure

```
NFLv2/
├── src/
│   ├── core/               # Core modules
│   │   ├── constants.js    # All constants & config
│   │   ├── api-client.js   # Unified API client
│   │   └── data-manager.js # Atomic file operations
│   ├── models/             # Prediction models
│   │   ├── elo.js          # Elo rating system
│   │   ├── efficiency.js   # Efficiency model
│   │   └── predictor.js    # Combined predictor
│   ├── utils/              # Utilities
│   │   ├── stats-parser.js # Statistics parsing
│   │   ├── logger.js       # Structured logging
│   │   └── validator.js    # Input validation
│   └── workflows/          # Main workflows
│       ├── update-data.js  # Data update
│       ├── generate-predictions.js
│       ├── check-results.js
│       └── backtest.js
├── data/                   # Data files (JSON)
├── public/                 # Frontend
└── .github/workflows/      # GitHub Actions
```

## 🔄 Update Schedule

### Game Time (Every 3 Minutes)
- **Thursday**: 4 PM - 2 AM ET
- **Saturday**: 12 PM - 2 AM ET (Weeks 15-18)
- **Sunday**: 1 PM - 2 AM ET
- **Monday**: 4 PM - 2 AM ET

### Off-Peak (Hourly)
- Every hour when no games scheduled

## 📈 Accuracy

Current model accuracy based on 2025 season backtesting:
- **Overall**: ~65% (varies by week)
- **High Confidence**: 70-75%
- **Medium Confidence**: 60-65%
- **Low Confidence**: 50-55%

## 🔧 Configuration

Edit `src/config/settings.json` to customize:
- Model weights (Elo vs Efficiency)
- Update intervals
- Display preferences

## 📝 Data Sources

- **ESPN API**: Game schedules, scores, and statistics
- **Sleeper API**: Player injury data

All APIs used are **free** and require **no API keys**.

## 🛠️ Development

### Adding Manual Injuries

Edit `data/manual-injuries.json`:

```json
{
  "KC": [
    {
      "name": "Player Name",
      "position": "QB",
      "injuryStatus": "Out",
      "injuryBodyPart": "Knee"
    }
  ]
}
```

### Running Backtests

```bash
# Backtest specific weeks
npm run backtest -- 1 10

# Backtest from week 1 to current
npm run backtest
```

## 📊 Key Improvements Over v1

| Feature | v1 | v2 |
|---------|----|----|
| Code Size | 3,083 lines | ~1,800 lines (-40%) |
| Update Frequency | 9x/day | 20-30x/day |
| Update Speed | Several minutes | < 30 seconds |
| Code Duplication | High (4+ files) | None (modular) |
| Error Recovery | Silent failures | Auto-retry + logging |
| API Efficiency | Sequential | Parallel |
| Data Integrity | Partial corruption possible | Atomic operations |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and backtest
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

Built with:
- Node.js
- ESPN API
- Sleeper API
- GitHub Actions

---

**Note**: This is v2 - a complete rewrite focusing on code quality, maintainability, and performance.

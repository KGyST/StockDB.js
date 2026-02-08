# StockDB.js - Stock Database Management

## Project Structure

```
StockDB.js/
├── src/                    # Main application code (deployed to Google Apps Script)
│   ├── gas.js             # Google Apps Script service mocks
│   ├── db_service.js      # MongoDB cache service
│   ├── logic.js           # Core business logic
│   ├── mock_mongo_service.js # Local MongoDB mock for testing
│   └── appsscript.json   # Google Apps Script manifest
├── scripts/               # Local development and testing scripts
│   └── local_runner.js    # Local test runner
├── test_data/             # Test data files
│   └── eodhd_dividends.json
├── cache/                 # Local cache directory for mock service
├── .env                   # Environment variables (not committed)
├── .env.example           # Environment variables template
└── package.json           # Node.js dependencies
```

## Development

### Local Testing
```bash
# Run local development environment
node scripts/local_runner.js
```

### Google Apps Script Deployment
```bash
# Push to Google Apps Script
clasp push

# Open in editor
clasp open
```

## Environment Variables

Copy `.env.example` to `.env` and configure:
- `ALPHA_VANTAGE_API_KEY` - Alpha Vantage API key
- `MONGO_URI` - MongoDB connection string
- `EODHD_API_TOKEN` - EODHD API token

## File Naming Convention

- `try_*.js` - Temporary test files (following .windsurfrules)
- `src/` - Production code deployed to Google Apps Script
- `scripts/` - Local development utilities

## MongoDB Integration

The application supports both real MongoDB and mock MongoDB service:
- **Real MongoDB**: Uses connection from environment variables
- **Mock Service**: Local file-based cache for development without MongoDB

## Google Apps Script Services

All Google Apps Script services are mocked in `src/gas.js` for local development:
- `PropertiesService` - Reads from `.env` file
- `CacheService` - In-memory cache
- `UrlFetchApp` - HTTP requests using node-fetch

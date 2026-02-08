# StockDB.js - Stock Database Management

## Project Structure

```
StockDB.js/
├── src/                    # Main application code (deployed to Google Apps Script)
│   ├── db_service.js      # MongoDB cache service
│   ├── logic.js           # Core business logic
│   └── appsscript.json   # Google Apps Script manifest
├── scripts/               # Local development and testing scripts
│   ├── gas.js             # Google Apps Script service mocks
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

The application uses MongoDB for caching:
- **Local Development**: Uses MongoDB connection from environment variables
- **Google Apps Script**: Uses UrlFetchApp for HTTP-based cache operations

## Google Apps Script Services

All Google Apps Script services are mocked in `scripts/gas.js` for local development:
- `PropertiesService` - Reads from `.env` file
- `CacheService` - In-memory cache
- `UrlFetchApp` - HTTP requests using node-fetch

// Mock Google Apps Script services for Node.js testing
if (typeof PropertiesService === 'undefined') {
  const fs = require('fs');
  const path = require('path');
  
  // Load environment variables from .env file
  let envVars = {};
  try {
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
  } catch (error) {
    console.log('Could not load .env file:', error.message);
  }
  
  global.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: (key) => {
        // Return value from .env file or null if not found
        return envVars[key] || null;
      },
      setProperty: (key, value) => {
        console.log(`Mock: Setting ${key} = ${value}`);
        envVars[key] = value;
      }
    })
  };
}

if (typeof CacheService === 'undefined') {
  global.CacheService = {
    getScriptCache: () => ({
      get: (key) => null,
      put: (key, value, duration) => {
        console.log(`Mock: Caching ${key} for ${duration}s`);
      }
    })
  };
}

if (typeof UrlFetchApp === 'undefined') {
  global.UrlFetchApp = {
    fetch: (url) => {
      console.log(`Mock: Fetching ${url}`);
      // Return mock response for testing
      return {
        getContentText: () => {
          if (url.includes('eodhd.com')) {
            return JSON.stringify([
              { value: 1.5, date: "2011-01-01", period: "Final" },
              { value: 0.75, date: "2010-06-01", period: "Interim" }
            ]);
          }
          return '{}';
        }
      };
    }
  };
}

if (typeof LockService === 'undefined') {
  global.LockService = {
    getScriptLock: () => ({
      waitLock: (timeout) => {
        console.log(`Mock: Waiting for lock ${timeout}ms`);
      },
      releaseLock: () => {
        console.log('Mock: Lock released');
      }
    })
  };
}

if (typeof SpreadsheetApp === 'undefined') {
  global.SpreadsheetApp = {
    getUi: () => ({
      createMenu: (name) => ({
        addItem: (label, functionName) => ({
          addToUi: () => console.log(`Mock: Added menu item "${label}" to "${name}"`)
        })
      }),
      prompt: (title) => ({
        getSelectedButton: () => ({ OK: 'OK' }),
        getResponseText: () => 'test_api_key'
      }),
      alert: (message) => console.log(`Mock: Alert - ${message}`),
      Button: { OK: 'OK' }
    })
  };
}

/* ==============================================================
   MENU
   ============================================================== */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🔑 API")
    .addItem("Set Alpha Vantage key", "setAlphaVantageKey")
    .addToUi();
}

function setAlphaVantageKey() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("Alpha Vantage API key");
  if (r.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties()
      .setProperty("ALPHA_VANTAGE_API_KEY", r.getResponseText().trim());
    ui.alert("Key saved");
  }
}

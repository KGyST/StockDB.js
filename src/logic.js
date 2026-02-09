// ==============================================================
// GLOBAL SETTINGS - Properties retrieved dynamically when needed
// ==============================================================

// ==============================================================
// CORE UTILS
// ==============================================================
Array.prototype.sum = function() { return this.reduce((acc, val) => acc + (Number(val) || 0), 0); };
Array.prototype.last = function() { return this[this.length - 1]; };

// ==============================================================
// FIREBASE SERVICE
// ==============================================================
const FirebaseService = {
  // Helper to sanitize ticker names for Firebase keys (no dots allowed)
  _sanitizeTicker(ticker) {
    return ticker ? ticker.replace(/\./g, '_') : ticker;
  },

  _getFirebaseUrl() {
    const baseUrl = PropertiesService.getScriptProperties().getProperty('FIREBASE_URL');
    if (!baseUrl) throw new Error('FIREBASE_URL not set in Script Properties');
    return baseUrl.replace(/\/$/, ''); // Remove trailing slash if any
  },

  _getFirebaseAuth() {
    const auth = PropertiesService.getScriptProperties().getProperty('FIREBASE_AUTH');
    if (!auth) throw new Error('FIREBASE_AUTH not set in Script Properties');
    return auth;
  },

  async _makeRequest(url, options = {}) {
    // Google Apps Script environment
    const gasOptions = {
      method: options.method || 'get',
      contentType: 'application/json',
      payload: options.body || null,
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(url, gasOptions);
    const code = response.getResponseCode();
    const content = response.getContentText();
    return {
      ok: code >= 200 && code < 300,
      status: code,
      json: () => JSON.parse(content),
      text: () => content
    };
  },

  async getCache(ticker) {
    const cleanTicker = this._sanitizeTicker(ticker);
    const url = `${this._getFirebaseUrl()}/cache/${cleanTicker}.json?auth=${this._getFirebaseAuth()}`;
    
    try {
      const response = await this._makeRequest(url);
      if (!response.ok) return null;
      
      const result = response.json();
      return result?.data || null;
    } catch (e) {
      return null;
    }
  },

  async saveCache(ticker, data, ttl = 21600) {
    const cleanTicker = this._sanitizeTicker(ticker);
    const url = `${this._getFirebaseUrl()}/cache/${cleanTicker}.json?auth=${this._getFirebaseAuth()}`;
    
    const cacheData = {
      data: data,
      createdAt: new Date().toISOString()
    };

    try {
      const response = await this._makeRequest(url, {
        method: 'PUT',
        body: JSON.stringify(cacheData)
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  },

  async _deleteCache(ticker) {
    const cleanTicker = this._sanitizeTicker(ticker);
    const url = `${this._getFirebaseUrl()}/cache/${cleanTicker}.json?auth=${this._getFirebaseAuth()}`;
    await this._makeRequest(url, { method: 'DELETE' });
  }
};

// ==============================================================
// UNIFIED FETCH LOGIC
// ==============================================================
async function getFinancialData(ticker, provider, endpoint) {
  const cachePath = `${provider}/${endpoint}/${ticker}`;
  
  // 1. Check Cache
  const cached = await FirebaseService.getCache(cachePath);
  if (cached) return cached;

  // 2. Fetch from API with fallback keys
  const props = PropertiesService.getScriptProperties();
  let urls = [];
  let keyNames = [];
  
  if (provider === 'eodhd') {
    const tokens = props.getProperty('EODHD_API_TOKEN');
    let tokenArray;
    try {
      tokenArray = Array.isArray(tokens) ? tokens : JSON.parse(tokens || '[]');
    } catch (e) {
      tokenArray = tokens ? [tokens] : [];
    }
    urls = tokenArray.map(token => 
      `https://eodhd.com/api/${endpoint}/${ticker}?api_token=${token}&fmt=json`
    );
    keyNames = tokenArray.map((_, i) => `EODHD_API_TOKEN[${i}]`);
  } else {
    const keys = props.getProperty('ALPHA_VANTAGE_API_KEY');
    let keyArray;
    try {
      keyArray = Array.isArray(keys) ? keys : JSON.parse(keys || '[]');
    } catch (e) {
      keyArray = keys ? [keys] : [];
    }
    urls = keyArray.map(key => 
      `https://www.alphavantage.co/query?function=${endpoint}&symbol=${ticker}&apikey=${key}`
    );
    keyNames = keyArray.map((_, i) => `ALPHA_VANTAGE_API_KEY[${i}]`);
  }

  // Try each API key until one works
  for (let i = 0; i < urls.length; i++) {
    try {
      const response = await FirebaseService._makeRequest(urls[i]);
      if (response.ok) {
        const data = response.json();
        // Save to Cache and Return
        if (data) await FirebaseService.saveCache(cachePath, data);
        return data;
      } else if (response.status === 402) {
        console.log(`API quota exhausted for ${keyNames[i]}, trying next key...`);
        continue; // Try next key
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      if (i === urls.length - 1) {
        // Last key failed, throw the error
        throw error;
      }
      console.log(`Error with ${keyNames[i]}: ${error.message}, trying next key...`);
      continue;
    }
  }
  
  throw new Error(`All ${provider} API keys exhausted or failed`);
}

// ==============================================================
// BUSINESS LOGIC
// ==============================================================

async function GET_DIV(ticker, year, fiscalYearEnd = "05-31") {
  try {
    const arr = await getFinancialData(ticker, 'eodhd', 'div');

    if (!Array.isArray(arr) || arr.length === 0) return "Error: No data";

    const filteredArr = arr
      .filter(d => d.value && d.date)
      .map(d => ({ value: d.value, date: new Date(d.date), period: d.period }));

    // Logic for Annual/Final/Quarterly
    const aa = "Annual", ff = "Final", ii = "Interim", qq = "Quarterly";
    
    const annual = filteredArr.find(d => d.period === aa && d.date.getFullYear() === year + 1);
    if (annual) return annual.value;

    const final = filteredArr.find(d => d.period === ff && d.date.getFullYear() === year + 1);
    if (final) {
      const prev = filteredArr.filter(d => d.date < final.date && d.period !== ii).last();
      const interimsSum = filteredArr
        .filter(d => (d.period === ii || !d.period) && prev && d.date > prev.date && d.date < final.date)
        .map(d => d.value).sum();
      return interimsSum + final.value;
    }

    return filteredArr
      .filter(d => {
        const dDate = d.date;
        return dDate > new Date(`${year}-${fiscalYearEnd}`) && 
               dDate <= new Date(`${year + 1}-${fiscalYearEnd}`) && 
               (d.period === qq || !d.period);
      }).map(d => d.value).sum() || "Error: invalid div";
  } catch (error) {
    return error.message;
  }
}

async function GET_METRIC(ticker, year, targetCurrency = "EUR") {
  try {
    // Parallel fetch for speed
    const [incomeJson, earningsJson] = await Promise.all([
      getFinancialData(ticker, 'alphavantage', 'INCOME_STATEMENT'),
      getFinancialData(ticker, 'alphavantage', 'EARNINGS')
    ]);

    const rpt = incomeJson.annualReports?.find(r => r.fiscalDateEnding.startsWith(String(year)));
    const epsRpt = earningsJson.annualEarnings?.find(r => r.fiscalDateEnding.startsWith(String(year)));

    if (!rpt || !epsRpt) return "Error: Missing reports";

    const netIncome = Number(rpt.netIncome);
    const eps = Number(epsRpt.reportedEPS);
    const dividend = await GET_DIV(ticker, year);

    if (typeof dividend !== "number") return dividend; // Return error string

    const weightedShares = netIncome / eps;
    const fx = getDailyFxRate(`${year}-12-31`, "USD", targetCurrency);
    
    return (dividend * fx) / weightedShares;
  } catch (error) {
    return error.message;
  }
}

// ==============================================================
// FX & UTILITIES
// ==============================================================
// ==============================================================
// UI PROPERTY MANAGEMENT
// ==============================================================

// Create menu when spreadsheet opens
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🔑 StockDB Settings")
    .addSeparator()
    .addItem("🔑 Set Alpha Vantage Key", "setAlphaVantageKey")
    .addItem("💰 Set EODHD Token", "setEODHDToken")
    .addItem("🔥 Set Firebase URL", "setFirebaseURL")
    .addItem("🔐 Set Firebase Auth", "setFirebaseAuth")
    .addSeparator()
    .addItem("📋 Show Current Properties", "showCurrentProperties")
    .addItem("🗑️ Clear All Properties", "clearAllProperties")
    .addToUi();
}

// Individual property setters
function setAlphaVantageKey() {
  setPropertyWithUI("ALPHA_VANTAGE_API_KEY", "Alpha Vantage API Key");
}

function setEODHDToken() {
  setPropertyWithUI("EODHD_API_TOKEN", "EODHD API Token");
}

function setFirebaseURL() {
  setPropertyWithUI("FIREBASE_URL", "Firebase URL");
}

function setFirebaseAuth() {
  setPropertyWithUI("FIREBASE_AUTH", "Firebase Auth Token");
}

// Generic property setter with UI
function setPropertyWithUI(propertyKey, displayName) {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // Get current value
  const currentValue = scriptProperties.getProperty(propertyKey);
  const maskedValue = maskSensitive(propertyKey, currentValue);
  
  // For API keys, show array format hint
  let inputHint = `Enter new ${displayName}:`;
  if (propertyKey.includes('API_KEY') || propertyKey.includes('TOKEN')) {
    inputHint = `Enter new ${displayName} (single key or JSON array ["key1","key2"]):`;
  }
  
  const response = ui.prompt(
    `Set ${displayName}`,
    `Current value: ${maskedValue || '(not set)'}\n\n${inputHint}`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const newValue = response.getResponseText().trim();
    if (newValue) {
      scriptProperties.setProperty(propertyKey, newValue);
      ui.alert(`✅ ${displayName} saved successfully!`);
    } else {
      ui.alert(`❌ Please enter a valid ${displayName}`);
    }
  }
}

// Show current properties
function showCurrentProperties() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  const properties = scriptProperties.getProperties();
  
  if (Object.keys(properties).length === 0) {
    ui.alert("📋 No properties set. Use 'Setup All Properties' to get started.");
    return;
  }
  
  let message = "📋 Current Properties:\n\n";
  for (const [key, value] of Object.entries(properties)) {
    const maskedValue = maskSensitive(key, value);
    message += `${key}: ${maskedValue}\n`;
  }
  
  ui.alert(message);
}

// Clear all properties with confirmation
function clearAllProperties() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    "⚠️ Clear All Properties",
    "This will delete ALL properties. Are you sure?",
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    const scriptProperties = PropertiesService.getScriptProperties();
    const currentProps = scriptProperties.getProperties();
    const count = Object.keys(currentProps).length;
    
    scriptProperties.deleteAllProperties();
    ui.alert(`🗑️ Cleared ${count} properties`);
  }
}

// Helper function to mask sensitive values
function maskSensitive(key, value) {
  if (!value) return '(not set)';
  
  const sensitiveKeywords = ['KEY', 'TOKEN', 'AUTH', 'PASSWORD', 'SECRET'];
  const isSensitive = sensitiveKeywords.some(keyword => 
    key.toUpperCase().includes(keyword)
  );
  
  if (isSensitive) {
    // Handle JSON arrays for API keys
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => 
          item.length > 6 ? item.substring(0, 3) + '****' + item.substring(item.length - 2) : item
        ).join(', ');
      }
    } catch (e) {
      // Not JSON, treat as single value
    }
    
    // Single value masking
    if (value.length > 6) {
      return value.substring(0, 3) + '****' + value.substring(value.length - 2);
    }
  }
  return value;
}

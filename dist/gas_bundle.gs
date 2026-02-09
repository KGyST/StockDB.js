// ==============================================================
// GLOBAL SETTINGS - Add your API keys here
// ==============================================================
// Set these in Google Apps Script: File > Project properties > Script properties
// FIREBASE_URL: "https://your-firebase-project-default-rtdb.firebaseio.com"
// FIREBASE_AUTH: "your-firebase-auth-token"
// EODHD_API_TOKEN: "your-eodhd-api-token"
// ALPHA_VANTAGE_API_KEY: "your-alpha-vantage-api-key"

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

  // 2. Fetch from API
  let url;
  const props = PropertiesService.getScriptProperties();
  
  if (provider === 'eodhd') {
    const token = props.getProperty('EODHD_API_TOKEN');
    if (!token) throw new Error('EODHD_API_TOKEN not set in Script Properties');
    url = `https://eodhd.com/api/${endpoint}/${ticker}?api_token=${token}&fmt=json`;
  } else {
    const key = props.getProperty('ALPHA_VANTAGE_API_KEY');
    if (!key) throw new Error('ALPHA_VANTAGE_API_KEY not set in Script Properties');
    url = `https://www.alphavantage.co/query?function=${endpoint}&symbol=${ticker}&apikey=${key}`;
  }

  const response = await FirebaseService._makeRequest(url);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  
  const data = response.json();

  // 3. Save to Cache and Return
  if (data) await FirebaseService.saveCache(cachePath, data);
  return data;
}

// ==============================================================
// BUSINESS LOGIC
// ==============================================================

async function GET_DIV(ticker, year, fiscalYearEnd = "05-31") {
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
}

async function GET_METRIC(ticker, year, targetCurrency = "EUR") {
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
}

// ==============================================================
// FX & UTILITIES
// ==============================================================
function getDailyFxRate(date, src, tgt, fallback = 0.95) {
  const key = `FX_${src}_${tgt}_${date}`;
  const props = PropertiesService.getScriptProperties();
  const cached = props.getProperty(key);
  if (cached) return Number(cached);

  try {
    const url = `https://api.exchangerate.host/${date}?base=${src}&symbols=${tgt}`;
    const rate = JSON.parse(UrlFetchApp.fetch(url).getContentText())?.rates?.[tgt];
    if (rate) { props.setProperty(key, rate); return rate; }
  } catch (e) {}
  return fallback;
}

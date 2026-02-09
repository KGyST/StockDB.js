// local_runner.js - Local testing + deployment/.env setup
// Usage: node scripts/local_runner.js [test|deploy]

require('dotenv').config();
const { execSync } = require('child_process');

// Load mocks first
require('./gas');

// Core utilities (copy from gas_bundle.gs)
Array.prototype.sum = function() { return this.reduce((acc, val) => acc + (Number(val) || 0), 0); };
Array.prototype.last = function() { return this[this.length - 1]; };

// Firebase service definition
const FirebaseService = {
  _sanitizeTicker(ticker) {
    return ticker ? ticker.replace(/\./g, '_') : ticker;
  },

  _getFirebaseUrl() {
    const baseUrl = process.env.FIREBASE_URL;
    if (!baseUrl) throw new Error('FIREBASE_URL not set in .env');
    return baseUrl.replace(/\/$/, '');
  },

  _getFirebaseAuth() {
    const auth = process.env.FIREBASE_AUTH;
    if (!auth) throw new Error('FIREBASE_AUTH not set in .env');
    return auth;
  },

  async _makeRequest(url, options = {}) {
    const { default: fetch } = require('node-fetch');
    const fetchOptions = {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body || undefined
    };
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      json: () => JSON.parse(text),
      text: () => text
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
  }
};

// Global Firebase service reference (like in gas_bundle.gs)
global.FirebaseService = FirebaseService;

// Copy of GET_DIV function from gas_bundle.gs for local testing
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
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
    urls = tokenArray.map(token => 
      `https://eodhd.com/api/${endpoint}/${ticker}?api_token=${token}&fmt=json`
    );
    keyNames = tokenArray.map((_, i) => `EODHD_API_TOKEN[${i}]`);
  } else {
    const keys = props.getProperty('ALPHA_VANTAGE_API_KEY');
    const keyArray = Array.isArray(keys) ? keys : [keys];
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

// Mocking a cache logic in your GET_DIV
global.getStoredData = async (ticker) => {
  console.log(`Checking Firebase for ${ticker}...`);
  const cached = await FirebaseService.getCache(ticker);
  if (cached) {
    console.log(`Found cached data for ${ticker}:`, cached.data);
    return cached.data;
  }
  console.log(`No cached data found for ${ticker}`);
  return null;
};

global.setStoredData = async (ticker, data) => {
  console.log(`Saving to Firebase for ${ticker}...`);
  const success = await FirebaseService.saveCache(ticker, data);
  console.log(`Save ${success ? 'successful' : 'failed'} for ${ticker}`);
  return success;
};

// Check command
const command = process.argv[2] || 'test';

if (command === 'deploy') {
  deployToGAS();
} else {
}

// ==============================================================
// LOCAL TESTING FUNCTIONS
// ==============================================================

async function testLocally() {
  console.log("--- Testing Firebase Connection ---");
  // const ticker = "asml.as";
  const ticker = "MA";
  const year = 2023;
  
  console.log("\n=== Testing GET_DIV function ===");
  const result = await GET_DIV(ticker, year);
  
  console.log(`Result (${ticker}, ${year}):`, result);
}

testLocally();

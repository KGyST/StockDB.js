Array.prototype.sum = function() {
  return this.reduce((acc, val) => acc + (Number(val) || 0), 0);
};

Array.prototype.last = function() {
  return this[this.length - 1];
};

/* ==============================================================
   GLOBAL SETTINGS
   ============================================================== */
   function getAlphaVantageKey() {
    const key = PropertiesService.getScriptProperties().getProperty('ALPHA_VANTAGE_API_KEY');
    if (!key) throw new Error("Alpha Vantage API key not set");
    return key;
  }
  
  /* ==============================================================
     METRIC MAP
     ============================================================== */
  var METRIC_MAP = {
    "netIncome":      "INCOME_STATEMENT",
    "dividendPayout": "CASH_FLOW",
    "reportedEPS":    "EARNINGS",
  };
  

  /* ==============================================================
     FETCH + CACHE
     ============================================================== */
  function fetchAlphaVantageJson(ticker, endpoint) {
    const cache = CacheService.getScriptCache();
    const props = PropertiesService.getScriptProperties();
    const key = `AV_${endpoint}_${ticker}`;
  
    let raw = cache.get(key) || props.getProperty(key);
    if (raw) return JSON.parse(raw);
  
    const url =
      `https://www.alphavantage.co/query?function=${endpoint}` +
      `&symbol=${ticker}&apikey=${getAlphaVantageKey()}`;
  
    const resp = UrlFetchApp.fetch(url);
    raw = resp.getContentText();
  
    props.setProperty(key, raw);
    if (raw.length < 100 * 1024) cache.put(key, raw, 21600);
  
    return JSON.parse(raw);
  }
  

  function fetchEODHDJson(ticker, year, endpoint = "div") {
    const cache = CacheService.getScriptCache();
    const props = PropertiesService.getScriptProperties();
    const key = `AV_${endpoint}_${ticker}`;
    const lock = LockService.getScriptLock();
  
    let raw = cache.get(key) || props.getProperty(key);
    if (raw) return raw;

    const _token = "697e7b9bbdf2d4.20018857";
    const url =      
      `https://eodhd.com/api/${endpoint}/` +
      `/${ticker}?api_token=${_token}&fmt=json`;
  
    lock.waitLock(30000);

    try{
      const resp = UrlFetchApp.fetch(url);
      raw = resp.getContentText();
    
      props.setProperty(key, raw);
      if (raw.length < 100 * 1024) cache.put(key, raw, 21600);
    
      return raw;
    } finally {
      lock.releaseLock();
    }
  }
  
  /* ==============================================================
     FX (USD → target)
     ============================================================== */
  function getDailyFxRate(date, src, tgt, fallback = 0.95) {
    const key = `FX_${src}_${tgt}_${date}`;
    const props = PropertiesService.getScriptProperties();
    const cached = props.getProperty(key);
    if (cached) return Number(cached);
  
    try {
      const url = `https://api.exchangerate.host/${date}?base=${src}&symbols=${tgt}`;
      const json = JSON.parse(UrlFetchApp.fetch(url).getContentText());
      const rate = json?.rates?.[tgt];
      if (typeof rate === "number") {
        props.setProperty(key, rate);
        return rate;
      }
    } catch (_) {}
  
    return fallback;
  }


  // --------------------------------------------------------------
  // EARNINGS (EPS)
  // --------------------------------------------------------------

  function GET_DIV(ticker, year, fiscalYearEnd = "05-31")
  {
    var sum = 0;

    const ff = "Final";
    const qq = "Quarterly";
    const ii = "Interim";
    const aa = "Annual";

    const arr = JSON.parse(fetchEODHDJson(ticker, year) );

    if (!Array.isArray(arr) || arr.length === 0) {
      return "Error: no annualEarnings data (rate limit or missing EPS)";
    }

    var filteredArr = arr
      .filter(d => d.value && d.date)
      .map(d => ({
        value: d.value,
        date: new Date(d.date),
        period: d.period,
      }))

    var annual = filteredArr
      .find(d => (d.period == aa) && (d.date.getFullYear() == year + 1))

    if (annual)
      return annual.date;

    var final = filteredArr
      .find(d => (d.period == ff) && (d.date.getFullYear() == year + 1))

    if (final)
    // Interim / Final
    {
      var prev = filteredArr
        .filter(d => d.date < final.date && d.period != ii)
        // .sort((a, b)  => a.date > b.date)
        .last()

      var interims = filteredArr
        .filter(d => 
          (d.period == ii || d.period == null)
          && prev && d.date > prev.date 
          && d.date < final.date )
      
      if (interims)
        sum += interims
          .map(d => d.value)
          .sum();

      sum += final.value;
    }
    else
    // Quarerly
    {
      sum = filteredArr
        .filter(d => {
          const dDate = new Date(d.date);
          return dDate > new Date(`${year}-${fiscalYearEnd}`) 
            && dDate <= new Date(`${year + 1}-${fiscalYearEnd}`)
            && (d.period == qq || d.period == null);
        })
        .sum();
    } 

    return sum == null ? "Error: invalid div value" : sum;
  }

  /* ==============================================================
     CORE: DPS FROM EPS
     ============================================================== */
  function GET_METRIC(ticker, year, targetCurrency = "EUR") {
    const netIncome = _getMetric(ticker, "netIncome", year);
    const eps       = _getMetric(ticker, "reportedEPS", year);
    const dividend  = getEarnings(ticker, year);
    console.log(netIncome);
    console.log(eps);
    console.log(dividend);
  
    if ([netIncome, eps, dividend].some(v => typeof v !== "number")) {
      return "Error: missing numeric input";
    }
  
    // EPS definition → weighted avg shares
    const weightedShares = netIncome / eps;
  
    // FX correction (Alpha Vantage cashflow is USD)
    const fx = getDailyFxRate(`${year}-12-31`, "USD", targetCurrency, 0.95);
    const dividendEUR = dividend * fx;
  
    return dividendEUR / weightedShares;
  }
  
  function _getMetric(ticker, metric, optYear) {
    const map = METRIC_MAP[metric];
    const json = fetchAlphaVantageJson(ticker, map);
  
    // FINANCIAL STATEMENTS
    const reports = json.annualReports;
    const rpt = optYear
      ? reports.find(r => r.fiscalDateEnding.startsWith(String(optYear)))
      : reports[0];
  
    let val = rpt[metric];
    if (typeof val === "string") val = Number(val.replace(/,/g, ""));
    return val;
  }
  
// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GET_DIV,
    GET_METRIC,
    getDailyFxRate,
    fetchEODHDJson,
    fetchAlphaVantageJson,
    _getMetric
  };
}
  
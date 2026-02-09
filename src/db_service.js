let MongoClient;
if (typeof module !== 'undefined') {
  MongoClient = require('mongodb').MongoClient;
}

const MongoService = {
  client: null,

  // Helper to get and prepare URI
  _getUri() {
    const rawUri = (typeof PropertiesService !== 'undefined') 
      ? PropertiesService.getScriptProperties().getProperty('MONGO_URI') 
      : process.env.MONGO_URI;

    if (!rawUri) return null;
    if (!rawUri.includes(':') || !rawUri.includes('@')) return rawUri;

    // URL encode password logic
    const parts = rawUri.split('://');
    const [auth, host] = parts[1].split('@');
    const [user, pass] = auth.split(':');
    return `${parts[0]}://${user}:${encodeURIComponent(pass)}@${host}`;
  },

  // Singleton connection for Node.js
  async _getMongoClient() {
    if (this.client) return this.client;
    const uri = this._getUri();
    this.client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
      retryWrites: true
    });
    await this.client.connect();
    return this.client;
  },

  async getCache(ticker) {
    if (typeof MongoClient !== 'undefined') {
      const client = await this._getMongoClient();
      const db = client.db("stock_db");
      const result = await db.collection("fs_cache").findOne({ _id: ticker });

      if (result?.expiresAt && new Date() > new Date(result.expiresAt)) {
        await db.collection("fs_cache").deleteOne({ _id: ticker });
        return null;
      }
      return result;
    }
    return this._gasGet(ticker);
  },

  async saveCache(ticker, data, ttl = 21600) {
    const expiresAt = new Date(Date.now() + ttl * 1000);

    if (typeof MongoClient !== 'undefined') {
      const client = await this._getMongoClient();
      const db = client.db("stock_db");
      await db.collection("fs_cache").updateOne(
        { _id: ticker },
        { 
          $set: {
            data: data,
            createdAt: new Date(),
            expiresAt: expiresAt
          }
        },
        { upsert: true }
      );
      return true;
    }
    return this._gasSave(ticker, data, ttl);
  },

  // GAS Data API Implementation
  _gasAction(action, payload) {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('MONGODB_DATA_API_KEY');
    if (!apiKey) return null;

    const dataSource = props.getProperty('MONGODB_DATA_SOURCE') || 'DGI_Portfolio';
    const url = `https://data.mongodb-api.com/app/${dataSource}/endpoint/data/v1/action/${action}`;
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'api-key': apiKey },
      payload: JSON.stringify({
        dataSource: dataSource,
        database: props.getProperty('MONGODB_DATABASE') || 'DGI_Portfolio',
        collection: props.getProperty('MONGODB_COLLECTION') || 'cache',
        ...payload
      })
    };

    return UrlFetchApp.fetch(url, options);
  },

  _gasGet(ticker) {
    try {
      const response = this._gasAction('findOne', { filter: { _id: ticker } });
      const result = JSON.parse(response.getContentText());
      const doc = result.document;

      if (doc?.expiresAt && new Date() > new Date(doc.expiresAt)) {
        this._gasAction('deleteOne', { filter: { _id: ticker } });
        return null;
      }
      return doc;
    } catch (e) {
      return null;
    }
  },

  _gasSave(ticker, data, ttl) {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000);
      const response = this._gasAction('updateOne', {
        filter: { _id: ticker },
        update: {
          $set: { data, createdAt: new Date(), expiresAt }
        },
        upsert: true
      });
      return JSON.parse(response.getContentText()).acknowledged;
    } catch (e) {
      return false;
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = MongoService;
}
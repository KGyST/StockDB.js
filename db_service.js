// db_service.js
let MockMongoService;
if (typeof module !== 'undefined') {
  MockMongoService = require('./mock_mongo_service');
}
let MongoClient;
if (typeof module !== 'undefined') {
  MongoClient = require('mongodb').MongoClient;
}

const MongoService = {
  async getCache(ticker) {
    if (typeof MongoClient !== 'undefined') {
      // Local Node.js implementation
      return await this._localGet(ticker);
    } else if (typeof MockMongoService !== 'undefined') {
      // Mock service implementation
      const mockService = new MockMongoService();
      return await mockService.getCache(ticker);
    } else {
      // Google Apps Script implementation via UrlFetchApp
      return this._gasGet(ticker);
    }
  },

  async saveCache(ticker, data, ttl = 21600) {
    if (typeof MongoClient !== 'undefined') {
      // Local Node.js implementation
      return await this._localSave(ticker, data, ttl);
    } else if (typeof MockMongoService !== 'undefined') {
      // Mock service implementation
      const mockService = new MockMongoService();
      return await mockService.saveCache(ticker, data, ttl);
    } else {
      // Google Apps Script implementation via UrlFetchApp
      return this._gasSave(ticker, data, ttl);
    }
  },

  async _localGet(ticker) {
    const mongoUri = PropertiesService.getScriptProperties().getProperty('MONGO_URI') || process.env.MONGO_URI || 'mongodb+srv://karliterv_db_user:<db_password>@dgi-portfolio.qbnzkke.mongodb.net/?appName=DGI-Portfolio';
    
    // URL encode password if needed
    let finalUri = mongoUri;
    if (mongoUri.includes(':') && mongoUri.includes('@')) {
      const parts = mongoUri.split('://');
      if (parts.length === 2) {
        const authAndHost = parts[1];
        const authEnd = authAndHost.indexOf('@');
        if (authEnd > 0) {
          const auth = authAndHost.substring(0, authEnd);
          const hostPart = authAndHost.substring(authEnd);
          const [username, password] = auth.split(':');
          if (username && password) {
            const encodedPassword = encodeURIComponent(password);
            finalUri = `${parts[0]}://${username}:${encodedPassword}${hostPart}`;
          }
        }
      }
    }
    
    const client = new MongoClient(finalUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      family: 4,
      directConnection: false,
      retryWrites: true
    });
    
    // Add topology debugging
    client.on('topologyDescriptionChanged', (event) => {
      console.log('Topology changed:', {
        topologyId: event.topologyId,
        type: event.newDescription.type,
        serverDescriptions: Object.keys(event.newDescription.servers).map(key => ({
          address: key,
          type: event.newDescription.servers[key].type
        }))
      });
    });
    
    try {
      console.log('Connecting to MongoDB...');
      await client.connect();
      console.log('✓ Connected to MongoDB');
      
      const db = client.db("stock_db");
      const result = await db.collection("fs_cache").findOne({ _id: ticker });
      
      // Check if cache is expired
      if (result && result.expiresAt && new Date() > new Date(result.expiresAt)) {
        await db.collection("fs_cache").deleteOne({ _id: ticker });
        return null;
      }
      
      return result;
    } finally {
      await client.close();
    }
  },

  async _localSave(ticker, data, ttl) {
    const mongoUri = PropertiesService.getScriptProperties().getProperty('MONGO_URI') || process.env.MONGO_URI || 'mongodb+srv://karliterv_db_user:<db_password>@dgi-portfolio.qbnzkke.mongodb.net/?appName=DGI-Portfolio';
    
    // URL encode password if needed
    let finalUri = mongoUri;
    if (mongoUri.includes(':') && mongoUri.includes('@')) {
      const parts = mongoUri.split('://');
      if (parts.length === 2) {
        const authAndHost = parts[1];
        const authEnd = authAndHost.indexOf('@');
        if (authEnd > 0) {
          const auth = authAndHost.substring(0, authEnd);
          const hostPart = authAndHost.substring(authEnd);
          const [username, password] = auth.split(':');
          if (username && password) {
            const encodedPassword = encodeURIComponent(password);
            finalUri = `${parts[0]}://${username}:${encodedPassword}${hostPart}`;
          }
        }
      }
    }
    
    const client = new MongoClient(finalUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      family: 4,
      directConnection: false,
      retryWrites: true
    });
    
    // Add topology debugging
    client.on('topologyDescriptionChanged', (event) => {
      console.log('Topology changed:', {
        topologyId: event.topologyId,
        type: event.newDescription.type,
        serverDescriptions: Object.keys(event.newDescription.servers).map(key => ({
          address: key,
          type: event.newDescription.servers[key].type
        }))
      });
    });
    
    try {
      console.log('Connecting to MongoDB for save...');
      await client.connect();
      console.log('✓ Connected to MongoDB for save');
      
      const db = client.db("stock_db");
      const expiresAt = new Date(Date.now() + ttl * 1000);
      
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
    } finally {
      await client.close();
    }
  },

  _gasGet(ticker) {
    // Google Apps Script implementation using MongoDB Data API
    const apiKey = PropertiesService.getScriptProperties().getProperty('MONGODB_DATA_API_KEY');
    const dataSource = PropertiesService.getScriptProperties().getProperty('MONGODB_DATA_SOURCE') || 'DGI_Portfolio';
    const database = PropertiesService.getScriptProperties().getProperty('MONGODB_DATABASE') || 'DGI_Portfolio';
    const collection = PropertiesService.getScriptProperties().getProperty('MONGODB_COLLECTION') || 'cache';
    
    if (!apiKey) {
      console.log('MongoDB Data API key not configured');
      return null;
    }

    const url = `https://data.mongodb-api.com/app/${dataSource}/endpoint/data/v1/action/findOne`;
    
    const payload = {
      dataSource: dataSource,
      database: database,
      collection: collection,
      filter: { _id: ticker }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'api-key': apiKey
      },
      payload: JSON.stringify(payload)
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());
      
      if (result.document) {
        // Check if cache is expired
        if (result.document.expiresAt && new Date() > new Date(result.document.expiresAt)) {
          this._gasDelete(ticker);
          return null;
        }
        return result.document;
      }
      
      return null;
    } catch (error) {
      console.log('Error fetching from MongoDB Data API:', error);
      return null;
    }
  },

  _gasSave(ticker, data, ttl) {
    // Google Apps Script implementation using MongoDB Data API
    const apiKey = PropertiesService.getScriptProperties().getProperty('MONGODB_DATA_API_KEY');
    const dataSource = PropertiesService.getScriptProperties().getProperty('MONGODB_DATA_SOURCE') || 'DGI_Portfolio';
    const database = PropertiesService.getScriptProperties().getProperty('MONGODB_DATABASE') || 'DGI_Portfolio';
    const collection = PropertiesService.getScriptProperties().getProperty('MONGODB_COLLECTION') || 'cache';
    
    if (!apiKey) {
      console.log('MongoDB Data API key not configured');
      return false;
    }

    const url = `https://data.mongodb-api.com/app/${dataSource}/endpoint/data/v1/action/updateOne`;
    
    const expiresAt = new Date(Date.now() + ttl * 1000);
    
    const payload = {
      dataSource: dataSource,
      database: database,
      collection: collection,
      filter: { _id: ticker },
      update: {
        $set: {
          data: data,
          createdAt: new Date(),
          expiresAt: expiresAt
        }
      },
      upsert: true
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'api-key': apiKey
      },
      payload: JSON.stringify(payload)
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());
      return result.acknowledged === true;
    } catch (error) {
      console.log('Error saving to MongoDB Data API:', error);
      return false;
    }
  },

  _gasDelete(ticker) {
    // Google Apps Script implementation using MongoDB Data API
    const apiKey = PropertiesService.getScriptProperties().getProperty('MONGODB_DATA_API_KEY');
    const dataSource = PropertiesService.getScriptProperties().getProperty('MONGODB_DATA_SOURCE') || 'DGI_Portfolio';
    const database = PropertiesService.getScriptProperties().getProperty('MONGODB_DATABASE') || 'DGI_Portfolio';
    const collection = PropertiesService.getScriptProperties().getProperty('MONGODB_COLLECTION') || 'cache';
    
    if (!apiKey) return;

    const url = `https://data.mongodb-api.com/app/${dataSource}/endpoint/data/v1/action/deleteOne`;
    
    const payload = {
      dataSource: dataSource,
      database: database,
      collection: collection,
      filter: { _id: ticker }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'api-key': apiKey
      },
      payload: JSON.stringify(payload)
    };

    try {
      UrlFetchApp.fetch(url, options);
    } catch (error) {
      console.log('Error deleting from MongoDB Data API:', error);
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = MongoService;
}


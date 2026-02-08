
// Mock MongoDB service using local files
const fs = require('fs').promises;
const path = require('path');

class MockMongoService {
  constructor() {
    this.cacheDir = path.join(__dirname, 'cache');
    this.ensureCacheDir();
  }
  
  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (e) {}
  }
  
  async getCache(ticker) {
    try {
      const filePath = path.join(this.cacheDir, `${ticker}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Check expiration
      if (parsed.expiresAt && new Date() > new Date(parsed.expiresAt)) {
        await this.deleteCache(ticker);
        return null;
      }
      
      return parsed;
    } catch (error) {
      return null;
    }
  }
  
  async saveCache(ticker, data, ttl = 21600) {
    try {
      const filePath = path.join(this.cacheDir, `${ticker}.json`);
      const cacheData = {
        _id: ticker,
        data: data,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ttl * 1000)
      };
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  }
  
  async deleteCache(ticker) {
    try {
      const filePath = path.join(this.cacheDir, `${ticker}.json`);
      await fs.unlink(filePath);
    } catch (error) {}
  }
}

module.exports = MockMongoService;
  
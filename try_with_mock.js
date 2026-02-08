// Test with mock MongoDB service using your dividend data
const MockMongoService = require('./mock_mongo_service');
const fs = require('fs');
const path = require('path');

async function testWithMockService() {
  console.log('=== Testing with Mock MongoDB Service ===\n');
  
  const mockService = new MockMongoService();
  
  // Test saving your dividend data
  console.log('1. Loading dividend data from test_data/eodhd_dividends.json...');
  
  try {
    const dividendData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'test_data', 'eodhd_dividends.json'), 'utf8')
    );
    
    console.log(`✓ Loaded ${dividendData.length} dividend records`);
    
    // Save to mock cache
    console.log('\n2. Saving to mock cache...');
    const saved = await mockService.saveCache('eodhd/dividends/asml.as', dividendData, 21600);
    
    if (saved) {
      console.log('✓ Data saved successfully');
    } else {
      console.log('✗ Failed to save data');
      return;
    }
    
    // Test retrieving the data
    console.log('\n3. Retrieving from mock cache...');
    const retrieved = await mockService.getCache('eodhd/dividends/asml.as');
    
    if (retrieved) {
      console.log('✓ Data retrieved successfully');
      console.log('- Document ID:', retrieved._id);
      console.log('- Data type:', typeof retrieved.data);
      console.log('- Array length:', retrieved.data.length);
      console.log('- Created:', retrieved.createdAt);
      console.log('- Expires:', retrieved.expiresAt);
      
      console.log('\n4. Sample dividend data:');
      console.log('- First dividend:', retrieved.data[0]);
      console.log('- Last dividend:', retrieved.data[retrieved.data.length - 1]);
      
      // Test expiration logic
      console.log('\n5. Testing expiration logic...');
      const expiredData = {
        _id: 'test/expired',
        data: ['test'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };
      
      // Write expired data manually
      const expiredPath = path.join(__dirname, 'cache', 'try_expired.json');
      fs.writeFileSync(expiredPath, JSON.stringify(expiredData, null, 2));
      
      const expiredCheck = await mockService.getCache('try/expired');
      if (!expiredCheck) {
        console.log('✓ Exired data correctly removed');
      } else {
        console.log('✗ Expired data not removed');
      }
      
      console.log('\n=== Mock Service Working! ===');
      console.log('You can now use this mock service for local testing.');
      console.log('Update your db_service.js to use MockMongoService when MongoClient is not available.');
      
    } else {
      console.log('✗ Failed to retrieve data');
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

// Update db_service.js to use mock service
function updateDbService() {
  console.log('\n=== Updating db_service.js for Mock Support ===');
  
  try {
    const dbServicePath = path.join(__dirname, 'db_service.js');
    let content = fs.readFileSync(dbServicePath, 'utf8');
    
    // Add mock service import at the top
    if (!content.includes('MockMongoService')) {
      content = content.replace(
        '// db_service.js',
        '// db_service.js\nlet MockMongoService;\nif (typeof module !== \'undefined\') {\n  MockMongoService = require(\'./mock_mongo_service\');\n}'
      );
    }
    
    // Update getCache method to use mock when MongoClient is not available
    const getCachePattern = /async getCache\(ticker\) \{[\s\S]*?\}/;
    const newGetCache = `async getCache(ticker) {
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
  }`;
    
    content = content.replace(getCachePattern, newGetCache);
    
    // Update saveCache method similarly
    const saveCachePattern = /async saveCache\(ticker, data, ttl = 21600\) \{[\s\S]*?\}/;
    const newSaveCache = `async saveCache(ticker, data, ttl = 21600) {
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
  }`;
    
    content = content.replace(saveCachePattern, newSaveCache);
    
    fs.writeFileSync(dbServicePath, content);
    console.log('✓ db_service.js updated for mock support');
    
  } catch (error) {
    console.error('✗ Failed to update db_service.js:', error.message);
  }
}

async function runTest() {
  await testWithMockService();
  updateDbService();
}

runTest().catch(console.error);

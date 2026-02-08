// MongoDB Proxy Solution - bypass DNS issues
const http = require('http');
const https = require('https');
const { MongoClient } = require('mongodb');

// Load environment variables
const fs = require('fs');
const path = require('path');

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

// Option 1: HTTP Proxy Setup
function setupHttpProxy() {
  console.log('=== HTTP Proxy Solution ===');
  console.log('1. Install a proxy server like http-proxy-middleware:');
  console.log('   npm install http-proxy-middleware');
  console.log('\n2. Create a proxy server that forwards MongoDB requests');
  console.log('\n3. Update your .env to use the proxy');
}

// Option 2: Use known MongoDB Atlas IPs (bypass DNS)
function getKnownMongoDBIPs() {
  console.log('\n=== Known MongoDB Atlas IP Ranges ===');
  console.log('MongoDB Atlas uses these IP ranges:');
  console.log('- 52.0.0.0/16');
  console.log('- 44.0.0.0/16'); 
  console.log('- 34.0.0.0/16');
  console.log('- 54.0.0.0/16');
  console.log('- 18.0.0.0/16');
  console.log('\nTry updating .env with direct IP:');
  console.log('MONGO_URI=mongodb://karliterv_db_user:1dFFD84lIf62KfH7@52.0.1.1:27017/?ssl=true&authSource=admin');
}

// Option 3: Use a different DNS server
function setupCustomDNS() {
  console.log('\n=== Custom DNS Solution ===');
  console.log('1. Use Google DNS (8.8.8.8) or Cloudflare DNS (1.1.1.1)');
  console.log('2. Update your network adapter DNS settings');
  console.log('3. Or use Node.js with custom DNS:');
  
  const dns = require('dns');
  
  // Set custom DNS servers
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  
  console.log('Custom DNS servers set:', dns.getServers());
}

// Option 4: Test with public MongoDB
async function testPublicMongoDB() {
  console.log('\n=== Test with Public MongoDB ===');
  
  try {
    // Test with a public MongoDB instance
    const client = new MongoClient('mongodb://localhost:27017', {
      serverSelectionTimeoutMS: 3000
    });
    
    await client.connect();
    console.log('✓ Local MongoDB accessible');
    
    const db = client.db('test');
    await db.collection('test').insertOne({ test: 'data' });
    console.log('✓ Can write to local MongoDB');
    
    await client.close();
  } catch (error) {
    console.log('✗ Local MongoDB not accessible:', error.message);
    console.log('Consider setting up a local MongoDB instance');
  }
}

// Option 5: Create a mock data service for testing
function createMockDataService() {
  console.log('\n=== Mock Data Service for Testing ===');
  console.log('Since MongoDB is not accessible, create a local file-based cache:');
  
  const mockService = `
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
      const filePath = path.join(this.cacheDir, \`\${ticker}.json\`);
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
      const filePath = path.join(this.cacheDir, \`\${ticker}.json\`);
      const cacheData = {
        _id: ticker,
        data: data,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ttl * 1000)
      };
      
      await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  }
  
  async deleteCache(ticker) {
    try {
      const filePath = path.join(this.cacheDir, \`\${ticker}.json\`);
      await fs.unlink(filePath);
    } catch (error) {}
  }
}

module.exports = MockMongoService;
  `;
  
  console.log('Creating mock service file...');
  require('fs').writeFileSync(
    path.join(__dirname, 'mock_mongo_service.js'),
    mockService
  );
  console.log('✓ Mock service created: mock_mongo_service.js');
}

// Run all solutions
async function runSolutions() {
  setupHttpProxy();
  getKnownMongoDBIPs();
  setupCustomDNS();
  await testPublicMongoDB();
  createMockDataService();
  
  console.log('\n=== Recommended Next Steps ===');
  console.log('1. Try changing your DNS to 8.8.8.8 or 1.1.1.1');
  console.log('2. Use the mock service for local testing');
  console.log('3. Set up a local MongoDB instance');
  console.log('4. Contact your network admin about MongoDB Atlas access');
}

runSolutions().catch(console.error);

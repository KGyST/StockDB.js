// Test with aggressive connection settings
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load environment variables
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

async function testAggressiveConnection() {
  const mongoUri = envVars.MONGO_URI;
  console.log('Testing with aggressive connection settings...\n');
  console.log('URI:', mongoUri.replace(/:([^@]+)@/, ':***@'));
  
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 5000,    // 5 second timeout
    connectTimeoutMS: 5000,            // 5 second connect timeout
    socketTimeoutMS: 5000,             // 5 second socket timeout
    maxPoolSize: 1,
    minPoolSize: 0,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 5000,
    retryWrites: false,                 // Disable retry for faster failure
    readPreference: 'primary',
    compressors: ['snappy', 'zlib']
  });
  
  try {
    console.log('Attempting to connect (5s timeout)...');
    const startTime = Date.now();
    
    await client.connect();
    
    const connectTime = Date.now() - startTime;
    console.log(`✓ Connected in ${connectTime}ms!`);
    
    // Test database access
    const db = client.db('stock_db');
    console.log('✓ Database accessible');
    
    // Test collection access
    const collection = db.collection('fs_cache');
    console.log('✓ Collection accessible');
    
    // Count documents
    const count = await collection.countDocuments();
    console.log(`✓ Found ${count} documents`);
    
    // Try to find your specific document
    const doc = await collection.findOne({ _id: 'eodhd/dividends/asml.as' });
    
    if (doc) {
      console.log('✓ Found your dividend data!');
      console.log('- Data type:', typeof doc.data);
      console.log('- Array length:', doc.data.length);
      console.log('- First dividend:', doc.data[0]);
    } else {
      console.log('✗ Document not found, but connection works!');
    }
    
    await client.close();
    console.log('✓ Connection closed successfully');
    
  } catch (error) {
    const connectTime = Date.now() - startTime;
    console.log(`✗ Failed after ${connectTime}ms: ${error.message}`);
    
    // Provide specific guidance
    if (error.message.includes('timeout')) {
      console.log('\nTimeout suggests:');
      console.log('- Network connectivity issues');
      console.log('- Firewall blocking MongoDB ports');
      console.log('- MongoDB cluster not accessible from this network');
    } else if (error.message.includes('authentication')) {
      console.log('\nAuthentication suggests:');
      console.log('- Invalid username/password');
      console.log('- Wrong auth source database');
    }
  }
}

testAggressiveConnection();

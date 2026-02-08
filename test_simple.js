// Simple MongoDB connection test
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
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

async function testSimpleConnection() {
  const { MongoClient } = require('mongodb');
  const mongoUri = envVars.MONGO_URI;
  
  console.log('Testing connection to:', mongoUri.replace(/:([^@]+)@/, ':***@'));
  
  // Test with different connection options
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 5000, // 5 second timeout
    connectTimeoutMS: 5000,
    maxPoolSize: 1
  });
  
  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✓ Connected successfully!');
    
    // Test database access
    const db = client.db('stock_db');
    console.log('✓ Database "stock_db" accessible');
    
    // Test collection access
    const collection = db.collection('fs_cache');
    console.log('✓ Collection "fs_cache" accessible');
    
    // Count documents
    const count = await collection.countDocuments();
    console.log(`✓ Found ${count} documents in collection`);
    
    // Try to find the specific document
    const doc = await collection.findOne({ _id: 'eodhd/dividends/asml.as' });
    if (doc) {
      console.log('✓ Found target document!');
      console.log('- Document keys:', Object.keys(doc));
      if (doc.data) {
        console.log('- Data type:', typeof doc.data);
        if (typeof doc.data === 'string') {
          try {
            const parsed = JSON.parse(doc.data);
            console.log('- Parsed data is array with', parsed.length, 'items');
            if (parsed.length > 0) {
              console.log('- First dividend:', parsed[0]);
            }
          } catch (e) {
            console.log('- Data preview (first 100 chars):', doc.data.substring(0, 100));
          }
        } else {
          console.log('- Data preview:', doc.data);
        }
      }
    } else {
      console.log('✗ Target document not found');
      
      // Show some sample documents
      const samples = await collection.find({}).limit(3).toArray();
      console.log('Sample documents:');
      samples.forEach((sample, i) => {
        console.log(`  ${i + 1}. _id: ${sample._id}`);
      });
    }
    
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
    
    // Provide more specific error guidance
    if (error.message.includes('querySrv')) {
      console.log('\nPossible causes:');
      console.log('- Network connectivity issues');
      console.log('- DNS resolution problems');
      console.log('- MongoDB Atlas cluster not accessible from this network');
      console.log('- Firewall blocking MongoDB connections');
    } else if (error.message.includes('authentication')) {
      console.log('\nAuthentication failed - check username/password');
    }
  } finally {
    try {
      await client.close();
      console.log('Connection closed');
    } catch (e) {
      // Ignore close errors
    }
  }
}

testSimpleConnection();

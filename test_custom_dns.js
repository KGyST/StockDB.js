// Test with custom DNS servers
const dns = require('dns');
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

async function testWithCustomDNS() {
  console.log('Testing with custom DNS servers...\n');
  
  // Save original DNS servers
  const originalServers = dns.getServers();
  console.log('Original DNS servers:', originalServers);
  
  // Try different DNS servers
  const dnsServers = [
    ['8.8.8.8', '1.1.1.1'],      // Google + Cloudflare
    ['1.1.1.1', '8.8.8.8'],      // Cloudflare + Google
    ['208.67.222.222', '208.67.220.220'], // OpenDNS
  ];
  
  const hosts = [
    'dgi-portfolio.qbnzkke.mongodb.net',
    'dgi-portfolio-shard-00-00.qbnzkke.mongodb.net',
    'mongodb.net'
  ];
  
  for (let i = 0; i < dnsServers.length; i++) {
    const servers = dnsServers[i];
    console.log(`\n=== Testing with DNS: ${servers.join(', ')} ===`);
    
    dns.setServers(servers);
    console.log('Set DNS to:', dns.getServers());
    
    for (const host of hosts) {
      try {
        console.log(`Resolving ${host}...`);
        const addresses = await new Promise((resolve, reject) => {
          dns.resolve4(host, (err, addresses) => {
            if (err) reject(err);
            else resolve(addresses);
          });
        });
        
        console.log(`✓ ${host} -> ${addresses.join(', ')}`);
        
        // If we can resolve, try MongoDB connection
        if (host.includes('dgi-portfolio')) {
          console.log('Testing MongoDB connection...');
          await testMongoConnection(addresses[0]);
        }
        
      } catch (error) {
        console.log(`✗ ${host} failed: ${error.message}`);
      }
    }
  }
  
  // Restore original DNS
  dns.setServers(originalServers);
  console.log('\nRestored original DNS servers:', dns.getServers());
}

async function testMongoConnection(ip) {
  try {
    // Create connection string with IP
    const mongoUri = envVars.MONGO_URI.replace(
      /@[^?]+/, 
      `@${ip}:27017`
    ).replace('mongodb+srv://', 'mongodb://');
    
    console.log(`Trying: ${mongoUri.replace(/:([^@]+)@/, ':***@')}`);
    
    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      sslValidate: false  // May need this for IP connections
    });
    
    await client.connect();
    console.log('✓ Connected via IP!');
    
    const db = client.db('stock_db');
    const collection = db.collection('fs_cache');
    const doc = await collection.findOne({ _id: 'eodhd/dividends/asml.as' });
    
    if (doc) {
      console.log('✓ Found dividend data!');
      console.log('- Data type:', typeof doc.data);
      if (typeof doc.data === 'string') {
        try {
          const parsed = JSON.parse(doc.data);
          console.log('- Array length:', parsed.length);
          console.log('- First dividend:', parsed[0]);
        } catch (e) {
          console.log('- Data preview:', doc.data.substring(0, 100));
        }
      }
    }
    
    await client.close();
    
    // Success! Update .env with working IP
    console.log('\n=== WORKING CONNECTION FOUND ===');
    console.log('Update your .env with:');
    console.log(`MONGO_URI=${mongoUri}`);
    
  } catch (error) {
    console.log(`✗ IP connection failed: ${error.message}`);
  }
}

testWithCustomDNS().catch(console.error);

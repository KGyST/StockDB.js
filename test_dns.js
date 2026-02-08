// Test DNS resolution for MongoDB Atlas hosts
const dns = require('dns');
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

async function testDNSResolution() {
  console.log('Testing DNS resolution for MongoDB Atlas hosts...\n');
  
  // Extract hostname from MongoDB URI
  const mongoUri = envVars.MONGO_URI;
  const match = mongoUri.match(/@([^:]+)/);
  const hostname = match ? match[1] : null;
  
  console.log('Original hostname from URI:', hostname);
  
  // Test various MongoDB Atlas host patterns
  const hostsToTest = [
    hostname,
    'dgi-portfolio-shard-00-00.qbnzkke.mongodb.net',
    'dgi-portfolio-shard-00-01.qbnzkke.mongodb.net', 
    'dgi-portfolio-shard-00-02.qbnzkke.mongodb.net',
    'mongodb.net',
    'cloud.mongodb.com'
  ];
  
  for (const host of hostsToTest) {
    if (!host) continue;
    
    console.log(`\nTesting: ${host}`);
    
    try {
      // Test DNS resolution
      const addresses = await new Promise((resolve, reject) => {
        dns.resolve4(host, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      
      console.log(`✓ Resolved to: ${addresses.join(', ')}`);
      
      // Test connectivity with a simple TCP connection
      const net = require('net');
      const socket = new net.Socket();
      
      const connected = await new Promise((resolve) => {
        socket.setTimeout(3000);
        socket.connect(27017, host, () => {
          resolve(true);
          socket.destroy();
        });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
          resolve(false);
          socket.destroy();
        });
      });
      
      if (connected) {
        console.log(`✓ Port 27017 accessible`);
      } else {
        console.log(`✗ Port 27017 not accessible`);
      }
      
    } catch (error) {
      console.log(`✗ DNS resolution failed: ${error.message}`);
    }
  }
  
  console.log('\n=== Alternative Connection String Formats ===');
  
  // Generate alternative connection strings
  if (hostname) {
    const baseUri = mongoUri.replace(/@[^?]+/, '@');
    
    console.log('\n1. Direct shard connection (if DNS works for shards):');
    console.log(`${baseUri}dgi-portfolio-shard-00-00.qbnzkke.mongodb.net/?appName=DGI-Portfolio`);
    
    console.log('\n2. Using IP address (if you can resolve it manually):');
    console.log('// You would need to resolve the IP address first');
    
    console.log('\n3. SRV record bypass:');
    const srvBypass = baseUri.replace('mongodb+srv://', 'mongodb://') + 
                     'dgi-portfolio-shard-00-00.qbnzkke.mongodb.net:27017,';
    console.log(`${srvBypass}dgi-portfolio-shard-00-01.qbnzkke.mongodb.net:27017,` +
                `dgi-portfolio-shard-00-02.qbnzkke.mongodb.net:27017/?replicaSet=DGI-Portfolio-shard-0`);
  }
}

testDNSResolution().catch(console.error);

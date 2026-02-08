// Test connectivity to MongoDB shard hosts
const net = require('net');
const fs = require('fs');
const path = require('path');

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

async function testHostConnectivity() {
  const mongoUri = envVars.MONGO_URI;
  console.log('Testing connectivity to MongoDB hosts...\n');
  console.log('URI:', mongoUri.replace(/:([^@]+)@/, ':***@'));
  
  // Extract hosts from URI
  const hostPattern = /@([^:]+):(\d+)/g;
  const hosts = [];
  let match;
  
  while ((match = hostPattern.exec(mongoUri)) !== null) {
    hosts.push({ host: match[1], port: parseInt(match[2]) });
  }
  
  console.log('\nFound hosts:');
  hosts.forEach((h, i) => console.log(`${i + 1}. ${h.host}:${h.port}`));
  
  // Test each host
  for (const { host, port } of hosts) {
    console.log(`\nTesting ${host}:${port}...`);
    
    try {
      const connected = await new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);
        
        socket.connect(port, host, () => {
          console.log(`✓ Connected to ${host}:${port}`);
          resolve(true);
          socket.destroy();
        });
        
        socket.on('error', () => {
          console.log(`✗ Failed to connect to ${host}:${port}`);
          resolve(false);
          socket.destroy();
        });
        
        socket.on('timeout', () => {
          console.log(`✗ Timeout connecting to ${host}:${port}`);
          resolve(false);
          socket.destroy();
        });
      });
      
      if (connected) {
        console.log(`✓ ${host}:${port} is reachable`);
      }
    } catch (error) {
      console.log(`✗ Error testing ${host}:${port}: ${error.message}`);
    }
  }
}

testHostConnectivity();

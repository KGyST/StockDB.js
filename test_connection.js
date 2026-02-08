const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Egyszerűsített .env betöltés
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

async function testConnection() {
  let mongoUri = envVars.MONGO_URI;
  if (!mongoUri) return console.error('Missing MONGO_URI');

  // URL encode password if needed
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
          mongoUri = `${parts[0]}://${username}:${encodedPassword}${hostPart}`;
          console.log('Password URL encoded');
        }
      }
    }
  }

  console.log('Connecting to MongoDB (IPv4 enforced)...');
  console.log('URI length:', mongoUri.length);
  console.log('URI preview:', mongoUri.substring(0, 100) + '...');

  // Senior-level connection options a timeout és IPv6 hibák ellen
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 10000, // 10mp bőven elég, ha jó a hálózat
    connectTimeoutMS: 10000,
    family: 4,                      // Kényszerített IPv4 (megoldja a Windows timeoutok 90%-át)
    directConnection: false,         // Use replica set
    retryWrites: true
  });

  // Topológia figyelés - kiírja, ha látja a szervereket
  client.on('topologyDescriptionChanged', (event) => {
    console.log('Topology event received');
    const servers = event.newDescription.servers;
    console.log('Server count:', Object.keys(servers).length);
    for (const [address, server] of servers) {
      console.log(`  ${address}: ${server.type}`);
    }
  });

  // Server selection figyelés
  client.on('serverOpening', (event) => {
    console.log('Server opening:', event.address);
  });

  client.on('serverClosed', (event) => {
    console.log('Server closed:', event.address);
  });

  try {
    await client.connect();
    console.log('✓ SUCCESS: Protocol handshake complete.');

    const db = client.db('stock_db');
    const collection = db.collection('fs_cache');
    
    const result = await collection.findOne({ _id: 'eodhd/dividends/asml.as' });
    console.log(result ? '✓ Document found!' : '✗ Document not found, but connection is OK!');

  } catch (error) {
    console.error('✗ Driver Error:', error.message);
    if (error.message.includes('timeout')) {
      console.log('TIP: Still timing out? Check if Atlas Network Access is truly "Active" for 0.0.0.0/0.');
    }
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

testConnection();
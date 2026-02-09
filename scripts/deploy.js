#!/usr/bin/env node

// deploy.js - Set Google Apps Script properties from .env and deploy

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envVars = {};
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
  } catch (error) {
    console.error('Error loading .env file:', error.message);
    process.exit(1);
  }
  
  return envVars;
}

// Set Google Apps Script properties using clasp
function setProperties(envVars) {
  console.log('Setting Google Apps Script properties...');
  console.log('Note: You may need to set properties manually in Google Apps Script editor');
  console.log('Go to: Project Settings > Script Properties');
  
  const properties = [
    { key: 'ALPHA_VANTAGE_API_KEY', value: envVars.ALPHA_VANTAGE_API_KEY },
    { key: 'MONGO_URI', value: envVars.MONGO_URI },
    { key: 'EODHD_API_TOKEN', value: envVars.EODHD_API_TOKEN }
  ];
  
  properties.forEach(prop => {
    if (prop.value) {
      console.log(`${prop.key}: ${prop.value.substring(0, 10)}...`);
    } else {
      console.warn(`Skipping ${prop.key} - no value found`);
    }
  });
  
  console.log('\nTo set properties manually:');
  console.log('1. Open Google Apps Script editor: clasp open');
  console.log('2. Go to File > Project properties');
  console.log('3. Add script properties with the values above');
}

// Deploy to Google Apps Script
function deploy() {
  console.log('\nDeploying to Google Apps Script...');
  try {
    execSync('clasp push', { stdio: 'inherit' });
    console.log('✅ Deployment successful!');
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Main execution
function main() {
  console.log('🚀 Starting deployment process...\n');
  
  const envVars = loadEnv();
  setProperties(envVars);
  deploy();
  
  console.log('\n✨ Deployment complete!');
}

if (require.main === module) {
  main();
}

module.exports = { loadEnv, setProperties, deploy };

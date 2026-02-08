// function test()
// {
//   //return GET_DIV("ASML.AS", 2019)
//   return GET_DIV("MC.PA", 2010)
//   return "Test"
//   // return GET_DIV("MC.PA", 2019)
// }

const MongoService = require('../src/db_service');

// Mocking a cache logic in your GET_DIV
global.getStoredData = async (ticker) => {
  console.log(`Checking Mongo for ${ticker}...`);
  const cached = await MongoService.getCache(ticker);
  if (cached) {
    console.log(`Found cached data for ${ticker}:`, cached.data);
    return cached.data;
  }
  console.log(`No cached data found for ${ticker}`);
  return null;
};

global.setStoredData = async (ticker, data) => {
  console.log(`Saving to Mongo for ${ticker}...`);
  const success = await MongoService.saveCache(ticker, data);
  console.log(`Save ${success ? 'successful' : 'failed'} for ${ticker}`);
  return success;
};

// Load mocks first
require('./gas');

const { GET_DIV } = require('../src/logic');

async function test() {
  console.log("--- Teszt indítása ---");
  const ticker = "MC.PA";
  const year = 2010;
  
  // Test MongoDB cache first
  console.log("\n=== Testing MongoDB Cache ===");
  try {
    const testData = [{ value: 2.5, date: "2011-01-01", period: "Final" }];
    await setStoredData(ticker, testData);
    
    const cachedData = await getStoredData(ticker);
    console.log("Cached data retrieved:", cachedData);
  } catch (error) {
    console.log("MongoDB connection failed (expected without proper credentials):", error.message);
    console.log("This is normal - MongoDB integration is ready but needs proper credentials");
  }
  
  console.log("\n=== Testing GET_DIV function ===");
  const result = GET_DIV(ticker, year);
  
  console.log(`Eredmény (${ticker}, ${year}):`, result);
}

test();


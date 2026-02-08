// Debug the module export issue
const MockMongoService = require('./mock_mongo_service');

console.log('=== Debug Module Export ===\n');

async function debugTest() {
  try {
    console.log('1. Loading db_service.js...');
    const dbService = require('./db_service.js');
    console.log('✓ db_service.js loaded');
    console.log('- Export type:', typeof dbService);
    console.log('- Export keys:', Object.keys(dbService));
    
    console.log('\n2. Testing getCache method...');
    if (dbService && typeof dbService.getCache === 'function') {
      console.log('✓ getCache method found');
      
      // Test with mock service
      console.log('\n3. Testing mock service directly...');
      const mockService = new MockMongoService();
      
      const result = await mockService.getCache('eodhd/dividends/asml.as');
      if (result) {
        console.log('✓ Mock service returned data');
        console.log('- Data length:', result.data.length);
      } else {
        console.log('✗ Mock service returned null');
      }
      
    } else {
      console.log('✗ getCache method not found');
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugTest();

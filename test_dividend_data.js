// Test fetching your specific dividend data
require('./gas'); // Load mocks first
const MongoService = require('./db_service');

async function testDividendData() {
  console.log('=== Testing Dividend Data Access ===\n');
  
  try {
    // Test fetching the ASML.AS dividend data
    console.log('1. Fetching eodhd/dividends/asml.as from cache...');
    const result = await MongoService.getCache('eodhd/dividends/asml.as');
    
    if (result) {
      console.log('✓ Data found in cache!');
      console.log('- Document ID:', result._id);
      console.log('- Data type:', typeof result.data);
      console.log('- Array length:', result.data.length);
      console.log('- Created:', result.createdAt);
      console.log('- Expires:', result.expiresAt);
      
      // Show some sample data
      console.log('\n2. Sample dividend records:');
      console.log('- First (2007):', result.data[0]);
      console.log('- Recent (2024):', result.data[result.data.length - 3]);
      console.log('- Latest:', result.data[result.data.length - 1]);
      
      // Test data integrity
      console.log('\n3. Data integrity check:');
      const totalValue = result.data.reduce((sum, dividend) => sum + dividend.value, 0);
      console.log('- Total dividend value:', totalValue.toFixed(2));
      console.log('- Currency:', result.data[0].currency);
      console.log('- Date range:', result.data[0].date, 'to', result.data[result.data.length - 1].date);
      
      // Test saving new data
      console.log('\n4. Testing save functionality...');
      const testData = [{ value: 2.5, date: "2026-01-01", period: "Test" }];
      const saved = await MongoService.saveCache('test/dividend/new', testData);
      
      if (saved) {
        console.log('✓ New data saved successfully');
        
        // Retrieve the test data
        const retrieved = await MongoService.getCache('test/dividend/new');
        if (retrieved && retrieved.data.length === 1) {
          console.log('✓ Test data retrieved successfully');
          console.log('- Test data:', retrieved.data[0]);
        }
      }
      
    } else {
      console.log('✗ No data found for eodhd/dividends/asml.as');
      console.log('Make sure the data was loaded by running test_with_mock.js first');
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

testDividendData();

// setProperties.gs - Set Google Apps Script properties from environment

function setProperty() {
  // This function can be called via clasp to set individual properties
  // Usage: clasp run setProperty "KEY" "VALUE"
  
  const key = arguments[0];
  const value = arguments[1];
  
  if (key && value) {
    PropertiesService.getScriptProperties().setProperty(key, value);
    console.log(`Set ${key} = ${value}`);
    return `Property ${key} set successfully`;
  } else {
    return 'Error: Both key and value must be provided';
  }
}

function setAllProperties() {
  // Set all required properties at once
  const properties = {
    'ALPHA_VANTAGE_API_KEY': 'YOUR_ALPHA_VANTAGE_KEY',
    'MONGO_URI': 'YOUR_MONGO_URI',
    'EODHD_API_TOKEN': 'YOUR_EODHD_TOKEN'
  };
  
  const scriptProperties = PropertiesService.getScriptProperties();
  
  Object.keys(properties).forEach(key => {
    scriptProperties.setProperty(key, properties[key]);
    console.log(`Set ${key}`);
  });
  
  return 'All properties set successfully';
}

function testProperties() {
  // Test that properties are set correctly
  const scriptProperties = PropertiesService.getScriptProperties();
  const keys = ['ALPHA_VANTAGE_API_KEY', 'MONGO_URI', 'EODHD_API_TOKEN'];
  
  keys.forEach(key => {
    const value = scriptProperties.getProperty(key);
    console.log(`${key}: ${value ? 'SET' : 'NOT SET'}`);
  });
  
  return 'Property test complete';
}

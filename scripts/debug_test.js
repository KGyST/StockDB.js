// Simple debug test to verify breakpoints work
console.log("Starting debug test...");

function testBreakpoints() {
  console.log("Line 1 - Before breakpoint");
  
  // Set breakpoint here
  const message = "Breakpoint should stop here";
  console.log("Line 2 - After breakpoint:", message);
  
  const result = {
    ticker: "MC.PA",
    year: 2010,
    data: [1.5, 0.75]
  };
  
  console.log("Line 3 - Result:", result);
  return result;
}

// Call the function
const output = testBreakpoints();
console.log("Final output:", output);

console.log("Debug test completed");

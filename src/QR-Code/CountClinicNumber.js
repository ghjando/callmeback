const fs = require('fs');

let totalNumberOfKeys = 0;
let totalNumberOfObjects = 0;

// Read the file
fs.readFile('./DifferentJsonFile/多出來的店家.json', 'utf8', (err, jsonString) => {
  if (err) {
    console.log('Error reading file:', err);
    return;
  }

  // Parse the JSON string into an object
  const data = JSON.parse(jsonString);

  // Loop through the object using a for...in loop
  for (const id in data) {
    totalNumberOfObjects++;

    // Check if the value of 'isMultiCaller' is true
    if (data[id].isMultiCaller === true) {
      // Get the "callers" object from the current object
      const callers = data[id].callers;

      // Count the number of keys in the "callers" object
      const numberOfKeys = Object.keys(callers).length;
      totalNumberOfKeys += numberOfKeys;
    }
  }

  console.log(`\r店家總數為: ${totalNumberOfObjects} 家`);
  console.log(`診間總數為: ${totalNumberOfKeys} 間`);
  const allNumbers = totalNumberOfObjects + totalNumberOfKeys;
  console.log(`店家數+診間數為: ${allNumbers} 個`);

});

const fs = require('fs');

// Read the contents of jsonA.json
fs.readFile('nameModifiedToNewName.json', 'utf8', (err, jsonStringA) => {
  if (err) {
    console.log('Error reading file:', err);
    return;
  }

  // Parse the contents of jsonA.json
  const dataA = JSON.parse(jsonStringA);

  // Read the contents of jsonB.json
  fs.readFile('callMe.json', 'utf8', (err, jsonStringB) => {
    if (err) {
      console.log('Error reading file:', err);
      return;
    }

    // Parse the contents of jsonB.json
    const dataB = JSON.parse(jsonStringB);

    // Loop through the objects in jsonA.json
    for (const id in dataA) {
      // Check if the same key exists in jsonB.json
      if (id in dataB) {
        // Replace the object in jsonB.json with the object from jsonA.json
        dataB[id] = dataA[id];
      }
    }

    // Write the updated contents of jsonB.json
    fs.writeFile('callMe.json', JSON.stringify(dataB, null, 2), err => {
      if (err) {
        console.log('Error writing file:', err);
        return;
      }

      console.log('File has been updated successfully');
    });
  });
});

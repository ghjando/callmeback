const fs = require('fs');

// 讀取 callMe.json 檔案
const jsonContent = fs.readFileSync('shop_data.json', 'utf-8');
// 將檔名變更為 meCall.json
fs.writeFileSync('callMe.json', jsonContent);
// 刪除 callMe.json 檔案
//fs.unlinkSync('callMe.json');
console.log('shop_data.json檔案內容已成功 copy 到 callMe.json..');


// Read the file
fs.readFileSync('./callMe.json', 'utf8', (err, jsonString) => {
  if (err) {
    console.log('Error reading file:', err);
    return;
  }

  // Parse the JSON string into an object
  const data = JSON.parse(jsonString);

  // Loop through the object using a for...in loop
  for (const id in data) {
    // Get the "callers" object from the current object
    const callers = data[id].callers;

    // Count the number of keys in the "callers" object
    const numberOfKeys = Object.keys(callers).length;
    // console.log(`The number of keys in the "callers" object for object with id "${id}" is: ${numberOfKeys}`);
    // Check if the number of keys in the "callers" object is greater than 1
    if (data[id].isMultiCaller === false && numberOfKeys > 1) {
      console.log(`Error!!! "isMultiCaller"為"false",但診間'${id}卻多於一間!`);
      console.log('-=-=-=-=-=-=>', data[id]);
    }
    // }
  }
});
console.log('已確認完成...');

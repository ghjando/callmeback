const fs = require('fs');

// 讀取 jsonA.json 和 jsonB.json 檔案
const jsonA = JSON.parse(fs.readFileSync('callMe.json', 'utf-8'));
const jsonB = JSON.parse(fs.readFileSync('./DifferentJsonFile/診間數量變動.json', 'utf-8'));

// 處理 jsonB.json 中"callers"子物件的 key 數量大於 jsonA.json 中"callers"子物件的 key 數量
for (const key in jsonB) {
  if (jsonB[key].hasOwnProperty('callers') && jsonA[key].hasOwnProperty('callers')) {
    const callersInA = Object.keys(jsonA[key].callers);
    const callersInB = Object.keys(jsonB[key].callers);
    if (callersInB.length > callersInA.length) {
      const newCallersObj = {};
      for (const caller of callersInB) {
        if (!callersInA.includes(caller)) {
          newCallersObj[caller] = jsonB[key].callers[caller];
        }
      }
      jsonB[key].callers = newCallersObj;
    }
  }
}

// 將處理後的 jsonB 資料儲存到 "moreCallers.json" 檔案
fs.writeFileSync('moreCallers.json', JSON.stringify(jsonB, null, 2));

console.log('\r\n 多出的診間,已儲存於 moreCallers.json檔案中...\n');

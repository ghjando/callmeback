const fs = require('fs');

// 讀取 jsonA.json 和 jsonB.json 檔案
const jsonAData = JSON.parse(fs.readFileSync('search_callMe_earlier_date.json', 'utf8'));
const jsonBData = JSON.parse(fs.readFileSync('search_callMe_latest_date.json', 'utf8'));

// 遍歷 jsonA.json 中的每個 key
for (const key in jsonAData) {
  // 確保 jsonBData 中也有相同的 key
  if (jsonBData[key]) {
    // 比較 name 值
    if (jsonAData[key].name !== jsonBData[key].name) {
      console.log(`店家Id:'${jsonAData[key].id}' 店名已從 '${jsonAData[key].name}' ==> '${jsonBData[key].name}'.`);
    }
  } else {
    console.log(`商店Id '${key}' 在最新資料中已不存在。`);
  }
}

// 遍歷 jsonA.json 中的每個 key
for (const key in jsonAData) {
  // 確保 jsonBData 中也有相同的 key
  if (jsonBData[key]) {
    // 比較 name 值
    if (jsonAData[key].address !== jsonBData[key].address) {
      console.log(`店家Id:'${jsonAData[key].id}' 店家ADDRESS已從 '${jsonAData[key].address}' ==> '${jsonBData[key].address}'.`);
    }
  }
}


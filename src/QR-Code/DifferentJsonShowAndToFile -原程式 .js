const fs = require('fs');
const path = require('path');

const obj1Path = './callMe.json';  //new json from shop_data
const obj2Path = './all_callMeFromShop_data.json'; //old json

const obj1 = JSON.parse(fs.readFileSync(obj1Path, 'utf8'));
const obj2 = JSON.parse(fs.readFileSync(obj2Path, 'utf8'));

const differences = {
  'moreStore': {},
  'deletedStore': {},
  'callersChange': {}
};

const differences2File = {
  '多出來的店家': {},
  '刪除掉的店家': {},
  '診間數量變動': {}
};


//去除多出來及少掉的商店,  找出診間有變動之商店
const obj1Keys = Object.keys(obj1);  //new
const obj2Keys = Object.keys(obj2);  //old

const keysToCompare = obj1Keys.filter(key => obj2.hasOwnProperty(key));

for (const key of keysToCompare) {
  const value1 = obj1[key];
  const value2 = obj2[key];
  const obj1Callers = Object.keys(value1.callers).length;
  const obj2Callers = Object.keys(value2.callers).length;

  if (obj1Callers !== obj2Callers) {
    const addNum = obj2Callers - obj1Callers;
    differences.callersChange[key] = {
      有變動: `診間數量從 '${obj1Callers}間' 變成 '${obj2Callers}間', 需印出A4Qrcode ${addNum}張` //物件文字顯示法
    };
    differences2File.診間數量變動[key] = {
      ...value2,
      index: key
    };
  }
}

for (const key of obj1Keys) {
  if (!obj2.hasOwnProperty(key)) {
    differences.deletedStore[key] = {};
    differences2File.刪除掉的店家[key] = {
      ...obj1[key],
      index: key
    };
  }
}


for (const key of obj2Keys) {
  if (!obj1.hasOwnProperty(key)) {
    differences.moreStore[key] = {};
    differences2File.多出來的店家[key] = {
      ...obj2[key],
      index: key
    };
  }
}

console.log({
  多出來的店家: Object.keys(differences.moreStore),
  刪除掉的店家: Object.keys(differences.deletedStore),
  診間變動的店: differences.callersChange
});
console.log(`此次多出來的診間有: ${Object.keys(differences.moreStore).length}間`);
console.log(`此次診間有變動的有: ${Object.keys(differences.callersChange).length}間`);
console.log(`此次被刪除的診間有: ${Object.keys(differences.deletedStore).length}間\n`);

const differentJsonFileDir = path.join(__dirname, 'DifferentJsonFile');
if (!fs.existsSync(differentJsonFileDir)) {
  fs.mkdirSync(differentJsonFileDir);
};


const callersDifferenceJsonPath = path.join(differentJsonFileDir, '診間數量變動.json');
const missingInObj1JsonPath = path.join(differentJsonFileDir, '多出來的店家.json');
const missingInObj2JsonPath = path.join(differentJsonFileDir, '刪除掉的店家.json');

fs.writeFileSync(callersDifferenceJsonPath, JSON.stringify(differences2File.診間數量變動, null, 2));
fs.writeFileSync(missingInObj1JsonPath, JSON.stringify(differences2File.多出來的店家, null, 2));
fs.writeFileSync(missingInObj2JsonPath, JSON.stringify(differences2File.刪除掉的店家, null, 2));

console.log(`相關物件檔案, 請到'DifferentJsonFile資料夾'內搜尋\n`);

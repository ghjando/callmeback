const fs = require('fs');

// 讀取jsonA.json和jsonB.json
let newClinicName = JSON.parse(fs.readFileSync('nameOldToNewName.json', 'utf8'));
let callMe = JSON.parse(fs.readFileSync('callMe.json', 'utf8'));


let modifiedObjects = {};
let countNum = 1;
// 遍歷jsonA的所有物件
for (let keyA in newClinicName) {
  // 遍歷jsonB的所有物件
  for (let keyB in callMe) {
    // 如果jsonA的oldName與jsonB的Name相同
    if (newClinicName[keyA].oldName === callMe[keyB].name) {
      //console.log('===jsonB[keyB]===', jsonB[keyB]);
      // 更新jsonB的name為jsonA的newName
      callMe[keyB].name = newClinicName[keyA].newName;

      modifiedObjects[keyB] = callMe[keyB];


      console.log(`\r第${countNum}間商店名稱,已從'${newClinicName[keyA].oldName}'修正成=>'${newClinicName[keyA].newName}'.`);
      count = countNum++;     //第一次, 全都視為"新名稱"(修正後名稱). 故會列出全部名稱. 不管有沒有簡稱.
    }
  }
}
//將有修改的物件儲存到檔案 ModifyMainPiObjectName.json 為物件形式
fs.writeFileSync('nameModifiedToNewName.json', JSON.stringify(modifiedObjects, null, 2));

// (先不用) 將更新後的jsonB寫回檔案
//fs.writeFileSync('mainPi.json', JSON.stringify(jsonB, null, 2), 'utf8');
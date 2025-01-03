const excel = require('exceljs');
const fs = require('fs');

const workbook = new excel.Workbook();
workbook.xlsx.readFile('nameOldToNewName.xlsx')
  .then(function () {
    const worksheet = workbook.getWorksheet('Name Data');
    const data = {};

    // let index = 1;
    worksheet.eachRow({ includeEmpty: false }, function (row, rowNumber) {
      if (rowNumber === 1) return; // Skip the first row
      const clinicId = row.getCell('A').value;
      const oldName = row.getCell('B').value;
      const newName = row.getCell('C').value;

      const key = `${clinicId}`;
      data[key] = { oldName, newName };
    });

    fs.writeFileSync('nameOldToNewName.json', JSON.stringify(data, null, 2));
  })
  .catch(function (error) {
    console.log('Error reading excel file:', error);
  });
console.log('\n===-=-=> nameExcelToJson Process has Finished\n');

/////====================================================================================================

// 讀取jsonA.json和jsonB.json
let newClinicName = JSON.parse(fs.readFileSync('nameOldToNewName.json', 'utf8'));
let callMe = JSON.parse(fs.readFileSync('./callMe.json', 'utf8'));


let modifiedObjects = {};
let countNum = 1;

for (let keyA in newClinicName) {
  for (let keyB in callMe) {
    // 如果jsonA的oldName與jsonB的Name相同
    if (newClinicName[keyA].oldName === callMe[keyB].name) {
      //console.log('===jsonB[keyB]===', jsonB[keyB]);
      // 更新jsonB的name為jsonA的newName
      callMe[keyB].name = newClinicName[keyA].newName;
      modifiedObjects[keyB] = callMe[keyB];

      console.log(`\r第${countNum}間商店名稱,已從'${callMe[keyB].id}_${newClinicName[keyA].oldName}'修正成=>'${newClinicName[keyA].newName}'.`);
      count = countNum++;     //第一次, 全都視為"新名稱"(修正後名稱). 故會列出全部名稱. 不管有沒有簡稱.
    }
  }
}
//將有修改的物件儲存到檔案 ModifyMainPiObjectName.json 為物件形式
fs.writeFileSync('nameModifiedToNewName.json', JSON.stringify(modifiedObjects, null, 2));

//////================================================================================================================

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
    fs.writeFile('callMe.json', JSON.stringify(dataB, null, 2), err => {
      if (err) {
        console.log('Error writing file:', err);
        return;
      }

      console.log('File has been updated to callMe.json successfully');
    });
  });
});

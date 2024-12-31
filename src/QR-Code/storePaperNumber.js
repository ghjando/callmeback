const fs = require('fs');
const jsonfile = require('jsonfile');
const ExcelJS = require('exceljs');

// 讀取 all_callMe_20240423_1777Y.json 檔案
const jsonData = jsonfile.readFileSync('all_callMe_20240423_1777Y.json');

// 處理資料
for (const key in jsonData) {
  if (jsonData[key].isMultiCaller === false) {
    jsonData[key].paperNumber = 1;
  } else {
    jsonData[key].paperNumber = Object.keys(jsonData[key].callers).length + 1;
  }
}

// 儲存到 Excel 檔案
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('number');
sheet.columns = [
  { header: '店家編號', key: 'id', width: 15 },
  { header: '店家名稱', key: 'name', width: 20 },
  { header: '總張數', key: 'paperNumber', width: 15 }
];

Object.keys(jsonData).forEach((key, index) => {
  sheet.addRow({
    id: jsonData[key].id,
    name: jsonData[key].name,
    paperNumber: jsonData[key].paperNumber
  });
});

// 設定 C 列為置中
sheet.getColumn('C').alignment = { vertical: 'middle', horizontal: 'center' };

workbook.xlsx.writeFile('storeNumber.xlsx')
  .then(() => {
    console.log('Excel file written successfully.');
  })
  .catch((error) => {
    console.log('Error writing Excel file: ', error);
  });

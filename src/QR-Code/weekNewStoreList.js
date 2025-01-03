const fs = require('fs');
const ExcelJS = require('exceljs');

// 讀取 JSON 檔案
const jsonData = JSON.parse(fs.readFileSync('./DifferentJsonFile/多出來的店家.json', 'utf8'));

// 創建新的 Excel 工作簿
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Add Store List');

// 設定標題行
worksheet.addRow(['序號', '商店編號', '商店名稱', '商店地址', '電話']);

// 將 JSON 數據添加到工作表
let index = 1;
for (const key in jsonData) {
  if (jsonData.hasOwnProperty(key)) {
    const item = jsonData[key];
    worksheet.addRow([index, item.id, item.name, item.address, item.phone]);
    index++;
  }
}

// 儲存 Excel 檔案
workbook.xlsx.writeFile('新增店家列表.xlsx')
  .then(() => {
    console.log('Excel 檔案已成功儲存！');
  })
  .catch((error) => {
    console.error('儲存 Excel 檔案時發生錯誤:', error);
  });

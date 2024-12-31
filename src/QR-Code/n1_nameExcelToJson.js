const excel = require('exceljs');
const fs = require('fs');

const workbook = new excel.Workbook();
workbook.xlsx.readFile('nameOldToNewName.xlsx')
  .then(function () {
    const worksheet = workbook.getWorksheet('Name Data');
    const data = {};

    let index = 1;
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
console.log('\n===-=-=> Process has Finished\n');



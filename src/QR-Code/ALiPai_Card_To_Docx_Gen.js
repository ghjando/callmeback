const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, ImageRun, Table, TableCell, TableRow } = require('docx');

// 讀取圖片檔案
const imageDir = './Lipai_Card_Final';
const docFilePath = './Lipai_Card.docx';

// 創建一個新的文檔，並指定作者等屬性
const doc = new Document({
  sections: [{
    properties: {
      // 設定 A4 大小的文檔
      pageSize: {
        width: 11906, // A4 width in twips
        height: 16838, // A4 height in twips
      },
      margin: {
        top: 120, // 1 inch margin
        right: 120,
        bottom: 120,
        left: 120,
      },
    },
    children: [],
  }],
});

// 獲取所有的 PNG 檔案
fs.readdir(imageDir, (err, files) => {
  if (err) {
    console.error('無法讀取圖片目錄:', err);
    return;
  }

  let images = files.filter(file => path.extname(file) === '.png');

  // 每頁插入4張圖片
  const imagesPerPage = 4;

  for (let i = 0; i < images.length; i += imagesPerPage) {
    const sectionImages = images.slice(i, i + imagesPerPage);

    // 創建表格以顯示四張圖片
    const rows = [];
    const cells = sectionImages.map(imageFile => {
      const imagePath = path.join(imageDir, imageFile);
      const imageBuffer = fs.readFileSync(imagePath);

      // 創建圖片運行
      const imageRun = new ImageRun({
        data: imageBuffer,
        transformation: {
          width: 293, // 設定圖片寬度 (可以根據需要調整) 
          height: 442, // 設定圖片高度 (可以根據需要調整)
        },
      });

      return new TableCell({
        children: [new Paragraph({ children: [imageRun] })],
        width: { size: 1000, type: 'dxa' }, // 設定單元格寬度 def:4000
      });
    });

    // 將每四個單元格組成一行
    for (let j = 0; j < cells.length; j += 2) {
      const rowCells = cells.slice(j, j + 2); // 每行兩個單元格
      rows.push(new TableRow({ children: rowCells }));
    }

    // 創建表格並添加到文檔中
    const table = new Table({
      rows: rows,
      width: { size: 1000, type: 'dxa' }, // 設定表格寬度 def:5000
    });

    doc.addSection({
      children: [table],
    });
  }

  // 將文檔保存到指定路徑
  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(docFilePath, buffer);
    console.log('文檔已成功保存到', docFilePath);

    // 用戶操作：回到第一頁並刪除空白,實際操作需要手動進行）
    console.log('\x1b[33;1m打開Word檔案:\n=> 請按"PgUp"直到第一頁，並於空白處點擊滑鼠左鍵一次,再按下"Del"鍵 ==>空白頁即可消除\x1b[0m)');

    // \x1b[33;1mr\x1b[0m)[店名太長店家縮減]       (\x1b[33mR\x1b[0meduce Long Name of Store)



  }).catch(error => {
    console.error('保存文檔時發生錯誤:', error);
  });
});
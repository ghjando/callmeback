const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const docx = require('docx');

// 設定資料夾路徑
const inputDir = 'C:\\Users\\mickmon\\version_QRcode\\callMeQrcodeGenerator_ver.20.12.2\\imageLiPaiFinal';
const outputDir = 'C:\\Users\\mickmon\\version_QRcode\\callMeQrcodeGenerator_ver.20.12.2\\Lipai_Card_Final';
const docxFilePath = './Liapi_Card.docx';

// 讀取所有 .png 檔案
fs.readdir(inputDir, (err, files) => {
  if (err) { throw err; }

  const pngFiles = files.filter(file => path.extname(file) === '.png');

  // 縮小圖檔並儲存
  Promise.all(pngFiles.map(file => {
    const inputFilePath = path.join(inputDir, file);
    const outputFilePath = path.join(outputDir, file);

    return sharp(inputFilePath)
      .resize({ width: Math.round(0.307 * 955), height: Math.round(0.307 * 1440) }) // 假設原始圖像大小為955x1440
      .toFile(outputFilePath);
  }))
    .then(() => {
      console.log('所有圖片已縮小並儲存。');
      //insertImagesIntoDocx();
    })
    .catch(err => console.error(err));
});

// // 將縮小後的圖片插入到 DOCX 檔案中
// function insertImagesIntoDocx() {
//   const doc = new docx.Document({
//     sections: [{
//       properties: {},
//       children: []
//     }]
//   });

//   fs.readdir(outputDir, (err, files) => {
//     if (err) { throw err; }

//     const pngFiles = files.filter(file => path.extname(file) === '.png');

//     pngFiles.forEach(file => {
//       const imagePath = path.join(outputDir, file);
//       const imageBuffer = fs.readFileSync(imagePath);

//       // 將圖片轉換為 docx 可用的格式
//       const imageRun = new docx.ImageRun({
//         data: imageBuffer,
//         transformation: {
//           width: 47.75,
//           height: 72,
//         },
//       });

//       // 將圖片添加到文檔中
//       doc.addSection({
//         children: [imageRun],
//       });
//     });

//     // 儲存 DOCX 檔案
//     docx.Packer.toBuffer(doc).then(buffer => {
//       fs.writeFileSync(docxFilePath, buffer);
//       console.log('所有圖片已插入到 DOCX 檔案中。');
//     }).catch(err => console.error(err));
//   });
// }
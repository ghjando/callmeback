const fs = require('fs');
const path = require('path');

// 定義要清空的資料夾路徑
const foldersToClean =
  [
    'qrCodeOriginal',
    'imageResults1',
    'imageResults2',
    'imageResults3',
    'imageLiPaiFinal',
    'qrCodeOriginalA4',
    'imageA4Results1',
    'imageA4Results2',
    'imageA4Results3',
    'imageA4Final'
  ];

// 遍歷要清空的資料夾
for (const folderName of foldersToClean) {
  const folderPath = path.join(__dirname, folderName);
  // 清空資料夾內容
  cleanFolder(folderPath);
}

function cleanFolder(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const currentPath = path.join(folderPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        // 遞迴清空子資料夾
        cleanFolder(currentPath);
      } else {
        // 刪除檔案
        fs.unlinkSync(currentPath);
        console.log(`Deleted file: ${currentPath}`);
      }
    });

    console.log(`Cleaned folder: ${folderPath}`);
  } else {
    console.log(`Folder does not exist: ${folderPath}`);
  }
}

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 定義檔案路徑
const earlierDateFilePath =
  path.join('C:', 'Users', 'mickmon', 'version_QRcode', 'callMeQrcodeGenerator_ver.20.12.2', 'search_callMe_earlier_date.json');
const latestDateFilePath =
  path.join('C:', 'Users', 'mickmon', 'version_QRcode', 'callMeQrcodeGenerator_ver.20.12.2', 'search_callMe_latest_date.json');
const sourceFilePath =
  path.join('C:', 'Users', 'mickmon', 'Downloads', 'shop_data.json');
const destinationFilePath =
  path.join('C:', 'Users', 'mickmon', 'version_QRcode', 'callMeQrcodeGenerator_ver.20.12.2', 'shop_data.json');
const newEarlierDateFilePath =
  earlierDateFilePath; // 重新命名的檔案路徑
const newLatestDateFilePath =
  path.join('C:', 'Users', 'mickmon', 'version_QRcode', 'callMeQrcodeGenerator_ver.20.12.2', 'search_callMe_latest_date.json');

// 1. 刪除 "search_callMe_earlier_date.json" 檔案
fs.unlink(earlierDateFilePath, (err) => {
  if (err) {
    console.error('刪除檔案時發生錯誤:', err);
    return;
  }
  console.log('\n已刪除上上週舊資料檔案:', earlierDateFilePath);

  // 2. 將 "search_callMe_latest_date.json" 檔案變更為 "search_callMe_earlier_date.json"
  fs.rename(latestDateFilePath, newEarlierDateFilePath, (err) => {
    if (err) {
      console.error('變更檔案名稱時發生錯誤:', err);
      return;
    }
    console.log('已將上週最新檔案變更為本週舊檔案:', newEarlierDateFilePath);

    // 3. 拷貝 "shop_data.json" 檔案到指定路徑
    fs.copyFile(sourceFilePath, destinationFilePath, (err) => {
      if (err) {
        console.error('拷貝檔案時發生錯誤:', err);
        return;
      }
      console.log('已將本週最新檔案拷貝好了:', destinationFilePath);

      // 4. 將 "shop_data.json" 檔案變更為 "search_callMe_latest_date.json"
      fs.rename(destinationFilePath, newLatestDateFilePath, (err) => {
        if (err) {
          console.error('變更檔案名稱時發生錯誤:', err);
          return;
        }
        console.log('已將拷貝檔案變更為最新檔案:', newLatestDateFilePath);
      });
    });
  });
});

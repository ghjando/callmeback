const { exec } = require('child_process');
const path = require('path');

// 定義要執行的檔案路徑
const scripts = [
  path.join('C:', 'Users', 'mickmon', 'version_QRcode', 'callMeQrcodeGenerator_ver.20.12.2', 'week_newStore_Changed.js'),
  path.join('C:', 'Users', 'mickmon', 'version_QRcode', 'callMeQrcodeGenerator_ver.20.12.2', 'showChangedNameStore.js'),
  path.join('C:', 'Users', 'mickmon', 'version_QRcode', 'callMeQrcodeGenerator_ver.20.12.2', 'DifferentJsonShowAndToFile.js'),
  path.join('C:', 'Users', 'mickmon', 'version_QRcode', 'callMeQrcodeGenerator_ver.20.12.2', 'weekNewStoreList.js')
];

// 使用 Promise 封裝 exec 函數
const execPromise = (scriptPath) => {
  return new Promise((resolve, reject) => {
    exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        reject(`執行檔案時發生錯誤: ${error.message}`);
      } else if (stderr) {
        reject(`錯誤輸出: ${stderr}`);
      } else {
        resolve(stdout);
      }
    });
  });
};

// 使用 async 函數來串行執行所有腳本
const runScripts = async () => {
  for (const script of scripts) {
    try {
      const output = await execPromise(script);
      console.log(`執行 ${script} :\n ${output}\n`);
    } catch (error) {
      console.error(error);
    }
  }
};

// 開始執行
runScripts();
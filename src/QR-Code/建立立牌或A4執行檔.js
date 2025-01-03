const readline = require('readline');
const { exec } = require('child_process');
const util = require('util');
const execPromisified = util.promisify(exec);


const inputFileName = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

//注意!!  '1' 'd' 'c', 也要是一個檔案!! 一個起頭檔名.
const fileMap = {
  '1': ['ALiPai_make_Qrcode_only', 'ALiPaiQrcodeGenerators'],
  '2': ['A4_make_Qrcode_only', 'A4QrcodeGenerators'],
  '3': ['A4_make_Qrcode_only', 'ALiPai_make_Qrcode_only', 'ALiPaiQrcodeGenerators', 'A4QrcodeGenerators'],
  'd': ['DeletedZeroActiveStore'],   //要準備readyToDeletedStore.xlsx 檔案
  'r': ['n1_nameExcelToJson', 'n2_nameJsonOldToNewName', 'n3_modifiedNameToCallMe'],          //要準備nameOldToNewName.xlsx    檔案
  's': ['CountClinicNumber'],
  'c': ['DeleteFolderContent'],
  'w': ['DeleteFolderContent', 'week_List_To_Excel', 'showChangedNameStore', 'A4_make_Qrcode_only', 'ALiPai_make_Qrcode_only', 'ALiPaiQrcodeGenerators', 'A4QrcodeGenerators'],
  't': ['A4ShortenName_Qrcode', 'ALiPaiShortenName_Qrcode'],
  'l': ['ALiPai_make_Qrcode_only', 'ALiPaiQrcodeGenerators', 'ALiPai_Card_Generators', 'ALiPai_Card_To_Docx_Gen'],
  'a': ['shop_ranking_result'],
};

async function getInput() {
  await inputFileName.question(`請輸入要執行項目之文字( s / d / r / c / w / 1 / 2 /3 /t /a / l + Enter):
\x1b[33;1ms\x1b[0m)[計算店家及診間數量組合] (\x1b[33mS\x1b[0mearch Items Total in ./DifferentJsonFile/多出來的店家.json檔)
\x1b[33;1md\x1b[0m)[刪除不活躍店家]         (\x1b[33mD\x1b[0melete Inactive Store)
\x1b[33;1mr\x1b[0m)[店名太長店家縮減]       (\x1b[33mR\x1b[0meduce Long Name of Store)
\x1b[33;1mc\x1b[0m)[清除相關資料夾內資料]   (\x1b[33mC\x1b[0mlear All Files in the "image***" Folder)
\x1b[32;1mw\x1b[0m)[\x1b[32;1m一週新增店家名單列表\x1b[0m]   \x1b[32m(\x1b[32mW\x1b[0meek Table List) (將oneDrive特定路徑下之shop_data.json檔,確認下載至downloads資料夾後執行.)
\x1b[34;1mt\x1b[0m)[\x1b[34;1m新增店家名稱過長修剪\x1b[0m]   \x1b[34m(\x1b[34mT\x1b[0mrim Store Name) (將欲修改店家json檔內容,先儲存至./DifferentJsonFile/shortenStoreNameList.json檔,並在該檔內修改完name後執行.)
\x1b[33;1ma\x1b[0m)[恢復活躍數之店家]       (\x1b[33mA\x1b[0mctive Shop) (恢復活躍之店家, 跳號數 => 由 0 變為 大於0)
\x1b[32;1ml\x1b[0m)[\x1b[32;1mLiPaiCard製作\x1b[0m]          \x1b[32m(\x1b[32mL\x1b[0miPai 白玉卡 => 需先清"Lipai_Card_Final資料夾內檔案, 欲製作白玉卡的診間,放入"多出來的店家.json"檔) 
\x1b[33;1m1\x1b[0m)[立牌 Only]              (!! 先前塑膠立牌 =>目前已廢除)
\x1b[33;1m2\x1b[0m)[新增A4:診間 Only]
\x1b[33;1m3\x1b[0m)[新增店家:立牌+A4]
\x1b[31;1m離開\x1b[0m=>請按[Ctrl+C]
==> : `,
    async (fileName) => {
      if (!['c', 's', 'd', 'r', 'w', '1', '2', '3', 't', 'a', 'l'].includes(fileName)) {
        console.log('\x1b[31;4m!! 輸入錯誤,請重新輸入 !!\x1b[0m\n===========================================\n');
        await getInput();
      } else {
        try {
          const filesToExecute = [fileName].concat(fileMap[fileName] || []);
          for (let file of filesToExecute) {
            const { stdout, stderr } = await execPromisified(`node ${file}`);
            if (stderr) {
              console.log(`stderr: ${stderr}`);
            }
            console.log(`${stdout}`);
          }
        }
        catch (error) {
          console.log(`執行錯誤: ${error.message}`);
        }
        inputFileName.close();
      }
    });
}

getInput();

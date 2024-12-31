// Import Admin SDK
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const { getDatabase } = require('firebase-admin/database');
const WebSocket = require('ws');
const fs = require('fs');
const path = require("path");
const chokidar = require('chokidar');

const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://shop-list-callme-398802.asia-southeast1.firebasedatabase.app/",
  apiKey: "AIzaSyABaO_1hc52aV--k8Zmore8TQbrruKI3gA",
  authDomain: "callme-project.firebaseapp.com",
  projectId: "callme-project",
  storageBucket: "callme-project.appspot.com",
  messagingSenderId: "342848666882",
  appId: "1:342848666882:web:27e22955f23a0479f9d61b",
  measurementId: "G-V0R4Q2HR8T"
};

firebaseConfig.databaseURL = 'https://test-query-callme-398802.asia-southeast1.firebasedatabase.app/';
const testApp = admin.initializeApp(firebaseConfig, 'testApp');
const testDB = getDatabase(testApp);

firebaseConfig.databaseURL = 'https://callnum-log-callme-398802.asia-southeast1.firebasedatabase.app/';
const callnumApp = admin.initializeApp(firebaseConfig, 'callnumApp');
const callnumDB = getDatabase(callnumApp);


// 取得 年月日字串 "yyyymmdd"
function get_ymd(date_object) {
  let year = date_object.getFullYear();
  let month = ("00"+(date_object.getMonth()+1)).substr(-2);
  let day = ("00"+date_object.getDate()).substr(-2);
  let ymd = `${year}${month}${day}`;
  return ymd;
}


async function test_del_exp_data() {
  let date_obj = new Date();
  let exp_date_obj = new Date();
  let exp_ymd = '';

  // 叫號機跳號資料
  callnumData = {};

  // 建立測試資料 (for 儲存 callnum_log)
  callnumData['20240401'] = {
    "1005-0": {
      "14:38:33": {
        "call_num": 1,
        "time_diff": 95956062,
        "timestamp": "1711175913335"
      },
      "14:39:52": {
        "call_num": 2,
        "time_diff": 79170,
        "timestamp": "1711175992505"
      }
    }
  };

  callnumData['20240330'] = {
    "1004-0": {
      "08:40:07": {
        "call_num": 1,
        "time_diff": 41928172,
        "timestamp": "1711154407988"
      },
      "08:44:26": {
        "call_num": 2,
        "time_diff": 258274,
        "timestamp": "1711154666262"
      }
    }
  };

  callnumData['20240331'] = {
    "1003-0": {
      "14:38:33": {
        "call_num": 1,
        "time_diff": 95956062,
        "timestamp": "1711175913335"
      },
      "14:39:52": {
        "call_num": 2,
        "time_diff": 79170,
        "timestamp": "1711175992505"
      }
    }
  };
  
    // 儲存前一天的 callnum_log 至檔案
    let log_date_obj = new Date();
    log_date_obj.setDate(date_obj.getDate()-1);
    let log_ymd = get_ymd(log_date_obj);
    
    // 取得 callnumData 的日期陣列，並依大小排列
    let date_arr = Object.keys(callnumData);
    date_arr = date_arr.sort(function (a, b) {
      return a > b ? 1 : -1;
    });
    
    // 假如 callnumData 有前一天的完整資料，則使用 callnumData    
    if ((log_ymd in callnumData) && (log_ymd!=date_arr[0])) {   // 程式開啟的第一天，callnumData 的資料不完整. 
      let callnum_data = callnumData[log_ymd];
      fs.writeFile(`../common_data/callnum_log_test/${log_ymd}.json`, JSON.stringify(callnum_data, null, 2), function(err) {
        if (err) {
            console.log(err);
        }
        else {
          for (let log_date in callnumData) {
            if (log_date < log_ymd) {
              delete callnumData[log_date];
              console.log(`delete callnumData: ${log_date}`);
            }
          }
        }
      });
    }
    else {  // 否則從 firebase 的 callnumDB 取得 前一天 的資料
      callnumDB.ref(`/${log_ymd}`).once('value', (snapshot) => {
        if (snapshot.exists()) {
          let callnum_data = snapshot.val();
          fs.writeFile(`../common_data/callnum_log_test/${log_ymd}.json`, JSON.stringify(callnum_data, null, 2), function(err) {
              if (err) {
                  console.log(err);
              }
          });
        } else {
          console.log('[firebase] callnum_log: no data');
        }
      }, (errorObject) => {
        console.log('[firebase] callnum_log: read failed: ' + errorObject.name);
      });
    }

    // 計算 callnum-log 過期日期
    exp_date_obj.setDate(date_obj.getDate()-101);
    exp_ymd = get_ymd(exp_date_obj);

    // 移除 callnum-log 過期 json 檔
    let filenames = fs.readdirSync("../common_data/callnum_log_test");
    for (let i=0; i<filenames.length; i++) {
      let fname = path.parse(filenames[i]).name;
      if (fname <= exp_ymd) {
        fs.unlink(`../common_data/callnum_log_test/${filenames[i]}`, (err) => {
          if (err) {
            console.error(err);
          } else {
            console.log(`remove callnum-log file: ${filenames[i]}`);
          }
        });        
      }
    }

    // 移除 callnum-log 過期資料
    await testDB.ref(`/${exp_ymd}`).remove();
    console.log(`remove callnum-log data: ${exp_ymd}`);

    let callnum_snapshot = await testDB.ref('/').orderByKey().endBefore(`${exp_ymd}`).limitToFirst(1).once('value');
    if (callnum_snapshot.exists()) {
      let first_key = Object.keys(callnum_snapshot.val())[0];
      while(true){
        exp_date_obj.setDate(exp_date_obj.getDate()-1);
        exp_ymd = get_ymd(exp_date_obj);
        if (exp_ymd < first_key) break;
        
        await testDB.ref(`/${exp_ymd}`).remove();
        console.log(`remove callnum-log data: ${exp_ymd}`);
      }
    }
}

async function main() {
  test_del_exp_data();
}

main();
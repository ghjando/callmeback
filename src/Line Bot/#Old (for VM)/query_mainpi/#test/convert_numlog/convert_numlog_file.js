//  串接免排API並更新叫號情形 該程式為主要程式

// Import Admin SDK
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const { getDatabase } = require('firebase-admin/database');

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

firebaseConfig.databaseURL = 'https://callnum-log-callme-398802.asia-southeast1.firebasedatabase.app/';
const callnumApp = admin.initializeApp(firebaseConfig, 'callnumApp');
const callnumDB = getDatabase(callnumApp);

const numlog_data = require("./shop_ranking_data/call-num-log.json");
//const shop_data = require("./shop_ranking_data/shop-list.json");
const fs = require('fs');

// 轉存 num_log
async function convert_numlog() {
  let callnumData = {};

  let end_str = "20240226"; 
  for (let caller_id in numlog_data) {
    for (let month in numlog_data[caller_id]) {
      for (let day in numlog_data[caller_id][month]) {
        if (numlog_data[caller_id][month][day] != null) {
          let ymd = `${month}${day}`;
          if (ymd <= end_str) {
            // 儲存到 callnumData
            if (!(ymd in callnumData)) callnumData[ymd] = {};
            callnumData[ymd][caller_id] = numlog_data[caller_id][month][day];
          }
        }
      }
    }
  }
  
  for (let ymd in callnumData) {
    console.log(ymd);
    let callnum_data = callnumData[ymd];
    callnumDB.ref(`/${ymd}`).set(callnum_data);
    fs.writeFile(`../common_data/callnum_log/${ymd}.json`, JSON.stringify(callnum_data, null, 2), function(err) {
      if (err) {
        console.log(err);
      }
    });
  }  
}

async function main() {
  // 轉存 num_log
  convert_numlog();
}

main();


//  串接免排API並更新叫號情形 該程式為主要程式

// Import Admin SDK
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const { getDatabase } = require('firebase-admin/database');

//const numlog_data = require("./shop_ranking_data/call-num-log.json");
//const shop_data = require("./shop_ranking_data/shop-list.json");
//const fs = require('fs');

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
const testqueryApp = admin.initializeApp(firebaseConfig, 'testqueryApp');
const testqueryDB = getDatabase(testqueryApp);

/*
// 轉存 num_log
async function convert_numlog() {
  // 取得 caller_id_arr
  let owner_obj = {};
  for (let shop_id in shop_data) {
    for (let caller_id in shop_data[shop_id].callers) {
      owner_obj[caller_id] = shop_id;
    }
  }
  let caller_id_arr = Object.keys(owner_obj);
  let caller_id_count = caller_id_arr.length;
 
  let callnumData = {};
  for (let i=0; i<caller_id_count; i++) {
    let caller_id = caller_id_arr[i];
    console.log(caller_id);

    // 讀取 202402 資料
    let month = '202402';
    let numlog_snapshot = await numlogDB.ref(`/${caller_id}/${month}`).orderByKey().startAt('27').once('value');
    if (numlog_snapshot.exists()) {
      let numlog_data = numlog_snapshot.val();
      for (let day in numlog_data) {
        let ymd = `${month}${day}`;
        // 儲存到 callnumData
        if (!(ymd in callnumData)) callnumData[ymd] = {};
        callnumData[ymd][caller_id] = numlog_data[day];
      }
    }
    
    // 讀取 202403 資料
    month = '202403';
    numlog_snapshot = await numlogDB.ref(`/${caller_id}/${month}`).orderByKey().endAt('22').once('value');
    if (numlog_snapshot.exists()) {
      let numlog_data = numlog_snapshot.val();
      for (let day in numlog_data) {
        let ymd = `${month}${day}`;
        // 儲存到 callnumData
        if (!(ymd in callnumData)) callnumData[ymd] = {};
        callnumData[ymd][caller_id] = numlog_data[day];
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
*/

async function main() {
  // 轉存 num_log
  // convert_numlog();

  await testqueryDB.ref('/').orderByKey().startAt('3').endAt('5').ref.remove();  
  
}

main();


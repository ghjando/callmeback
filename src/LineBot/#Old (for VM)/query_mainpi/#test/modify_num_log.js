//  串接免排API並更新叫號情形 該程式為主要程式

// Import Admin SDK
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const { getDatabase } = require('firebase-admin/database');
const WebSocket = require('ws');

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

const shopApp = admin.initializeApp(firebaseConfig, 'shopApp');
const shopDB = getDatabase(shopApp);

firebaseConfig.databaseURL = 'https://test-num-log-callme-398802.asia-southeast1.firebasedatabase.app/';
const numlogApp = admin.initializeApp(firebaseConfig, 'numlogApp');
const numlogDB = getDatabase(numlogApp);

// 叫號機所屬店家
var belong_shops = {};

// 詢問訊息陣列
var query_msgs = [];

// websocket 陣列
var ws = [];

/*
var numlogData = null;
numlogDB.ref('/').once('value', (snapshot) => {
  if (snapshot.exists()) {
    numlogData = snapshot.val();
    for (let caller_id in numlogData) {
      console.log(caller_id);
      for (let year_month in numlogData[caller_id]) {
        console.log(year_month);
        let split_arr = year_month.split('-');
        let year = split_arr[0];
        let month = split_arr[1];
        let new_year_month = `${year}${month}`;
        
        let numlogRef = numlogDB.ref(`${caller_id}`);
        numlogRef.child(new_year_month).set(numlogData[caller_id][year_month]);
        numlogRef.child(year_month).remove();
        console.log(new_year_month);
      }
    }
  } else {
    console.log('[firebase] numlog: no data');
  }
  process.exit(0);
}, (errorObject) => {
  console.log('[firebase] numlog: read failed: ' + errorObject.name);
  process.exit(1);
});
*/

async function main() {
  let snapshot = await numlogDB.ref('/').once('value');
  if (snapshot.exists()) {
    let numlogData = snapshot.val();
    for (let caller_id in numlogData) {
      console.log(caller_id);
      for (let year_month in numlogData[caller_id]) {
        console.log(year_month);
        let split_arr = year_month.split('-');
        let year = split_arr[0];
        let month = split_arr[1];
        let new_year_month = `${year}${month}`;
        
        let numlogRef = numlogDB.ref(`${caller_id}`);
        await numlogRef.child(`${new_year_month}`).set(numlogData[caller_id][year_month]);
        await numlogRef.child(`${year_month}`).remove();
        console.log(new_year_month);
      }
    }
  }
  process.exit(0);
}

main();
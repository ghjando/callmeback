import fs from 'fs/promises';
import line from '@line/bot-sdk';
import admin from 'firebase-admin';
import chokidar from 'chokidar';

// reply_msg.js
import * as reply_msg from './reply_msg.js';

// async-lock
import AsyncLock from 'async-lock';
var lock = new AsyncLock({timeout: 1000});

// thread number
var thread_num = 4;

/*
let linebot = require('linebot');

let bot = linebot({
    channelId: '2000682442',
    channelSecret:'a2af010087429d276051b2f1f739c856',
    channelAccessToken: 'vcClHW6zeF2V/nBoWQtDR7XiSOl98/uqK0s615RbKXHkGeRS3l2TTAZVQr3DjIE+l3yzEHydaekwMRapABOGcvrX7BX7mJsV4XKKRdO/x2nPGKz4f9conu09LbPQQFylNn/VvZONdEwmNEvaiDxo2QdB04t89/1O/w1cDnyilFU='
});
*/

// sleep m_sec millisecond
function sleep(m_sec){
 return new Promise((resolve,reject)=>{
  setTimeout(()=>resolve(),m_sec)
 })
}

function relative_time(second_diff) {
  if (second_diff < 0) second_diff = 0;

  // 轉換成相對時間
  let time_str = ``;
  if (second_diff < 60) {
      // Less than a minute has passed:
      time_str = `${second_diff}秒前`;
  } else if (second_diff < 3600) {
      // Less than an hour has passed:
      time_str = `${Math.floor(second_diff / 60)}分鐘前`;
  } else if (second_diff < 86400) {
      // Less than a day has passed:
      time_str = `${Math.floor(second_diff / 3600)}小時前`;
  } else if (second_diff < 2620800) {
      // Less than a month has passed:
      time_str = `${Math.floor(second_diff / 86400)}天前`;
  } else if (second_diff < 31449600) {
      // Less than a year has passed:
      time_str = `${Math.floor(second_diff / 2620800)}個月前`;
  } else {
      // More than a year has passed:
      time_str = `${Math.floor(second_diff / 31449600)}年前`;
  }

  return time_str;
}

var line_client;
var shopDB;
var callerDB;
var eventDB;
var userDB;

// 需先準備的資料
var shopData = null;
var belong_shops = {};

// 取得 叫號機所屬店家 陣列
function get_belong_shops(shop_data) {
  let owner_obj = {};
  for (let shop_id in shop_data) {
    for (let caller_id in shop_data[shop_id].callers) {
      owner_obj[caller_id] = shop_id;
    }
  }
  // 儲存到全域變數
  belong_shops = owner_obj;
}

async function main() {
  let line_config_file = await fs.readFile('./data/lineConfig.json', 'utf8');
  let config = JSON.parse(line_config_file);
  line_client = new line.Client(config);

  let rawDataFirebaseKey = await fs.readFile('./data/firebase_service_account_key.json', 'utf8');
  let serviceAccountKey = JSON.parse(rawDataFirebaseKey);

  let firebase_config_file = await fs.readFile('./data/firebaseConfig.json', 'utf8');
  let firebase_config = JSON.parse(firebase_config_file);
  let db_str = firebase_config.db_str;

  let shopApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      databaseURL: 'https://shop-list-' + db_str
  }, 'shopApp');
  
  let callerApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https://shop-caller-' + db_str
  }, 'callerApp');

  let eventApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https://user-event-' + db_str
  }, 'eventApp');

  let userApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      databaseURL: 'https://line-user-msg-' + db_str
  }, 'userApp');

  shopDB = shopApp.database();
  callerDB = callerApp.database();
  eventDB = eventApp.database();
  userDB = userApp.database();

  // 讀取店家資料
  let shop_file = await fs.readFile('../common_data/shop_data.json', 'utf8');
  shopData = await JSON.parse(shop_file);
  console.log('shop count:', Object.keys(shopData).length);
  get_belong_shops(shopData);

  // 即時更新店家資料
  chokidar.watch('../common_data/shop_data.json').on('change', (path, stats) => {
    //console.log(path, stats);
    read_new_shop_data();
  });

  async function read_new_shop_data() {
    await sleep(5000);
    let new_shop_file = await fs.readFile('../common_data/shop_data.json', 'utf8');
    let new_shopData = await JSON.parse(new_shop_file);
    shopData = new_shopData;
    console.log('shop count:', Object.keys(shopData).length);
    get_belong_shops(shopData);
  }

  /*
  // 讀取店家資料
  await shopDB.ref('/').once('value', (snapshot) => {
    if (snapshot.exists()) {
      shopData = snapshot.val();
      get_belong_shops();
      //console.log('[firebase] Shop:', shopData);
    } else {
      console.log('[firebase] Shop: no data');
    }
  }, (errorObject) => {
    console.log('[firebase] Shop: read failed: ' + errorObject.name);
  });
  
  // 即時更新店家資料
  shopDB.ref('/').on('value', (snapshot) => {
    if (snapshot.exists()) {
      shopData = snapshot.val();
      get_belong_shops();
    } else {
      console.log('[firebase] Shop: no data');
    }
  }, (errorObject) => {
    console.log('[firebase] Shop: read failed: ' + errorObject.name);
  });
  */

  console.log("ready!");
  
  for (let i=0; i<thread_num; i++) {
    notify_user(i, thread_num);  
    setInterval(() => notify_user(i, thread_num), 5000);
  }
}

async function notify_user(thread_id, thread_num) {
  lock.acquire('lock_'+thread_id, async () => {
    // 記錄開始時間
    let start_time = Date.now();
    
    let eventData = {};	
    console.log('[thread '+thread_id+']'+'reading event data...');
    await eventDB.ref().once('value', (snapshot) => {
      if (snapshot.exists() && (snapshot!=null)) {
        eventData = snapshot.val();      
        // 移除 thresd_id 不符的項目
        for (let c_shop_id in eventData) {
          if (c_shop_id % thread_num != thread_id) delete eventData[c_shop_id];
        }
        if (Object.keys(eventData).length == 0) console.log('[thread '+thread_id+']'+'event data not exist!');
      }
      else {
        if (!snapshot.exists()) console.log('[thread '+thread_id+']'+'event data not exist!');
        if (snapshot == null) console.log('[thread '+thread_id+']'+'event data is null!');
      }
    }, (errorObject) => {
      console.log('[thread '+thread_id+']'+'[firebase] event data read failed: ' + errorObject.name);
    });

    if (Object.keys(eventData).length > 0) {
      for (let c_shop_id in eventData) {
        let caller_snapshot = await callerDB.ref(`${c_shop_id}`).once('value');
        if (caller_snapshot.exists()) {
          let caller_data = caller_snapshot.val();
          for (let c_room_id in eventData[c_shop_id]) {
            // 取得店家資訊
            let caller_id = c_shop_id+"-"+c_room_id;
            let shop_id = belong_shops[caller_id];
            let shop_name = shopData[shop_id].name;
            let address = shopData[shop_id].address;
            let callers = shopData[shop_id].callers;
            
            // 若是多叫號機，要取得叫號機名稱                          
            let b_multi_caller = shopData[shop_id].isMultiCaller;
            let caller_name = (b_multi_caller)? callers[caller_id]:"";
            
            // 取得 caller 資訊.
            let curr_num = caller_data['call_nums'][c_room_id];
            let prev_num = caller_data['prev_nums'][c_room_id];
            let change_time = relative_time(Math.floor((Date.now()-caller_data.change_times[c_room_id])/1000));
            let update_time = relative_time(Math.floor((Date.now()-caller_data.update_time)/1000));
            let last_update = caller_data.last_update;
            console.log(`[thread ${thread_id}]${shop_name} ${caller_name}: ${curr_num}號`);
            for (let user_id in eventData[c_shop_id][c_room_id]) {
              let notified = eventData[c_shop_id][c_room_id][user_id]['notified'];
              let notify_num = eventData[c_shop_id][c_room_id][user_id]['notify_num'];
              //let user_num = eventData[c_shop_id][c_room_id][user_id]['user_num'];
              let timestamp = eventData[c_shop_id][c_room_id][user_id]['timestamp'];

              // 通知訊息陣列
              let notify_Msgs = [];
              
              // 過期訊息(超過12小時)，將其刪除
              if ((Date.now()-timestamp) > 43200*1000) {
                await eventDB.ref(`${c_shop_id}/${c_room_id}`).child(`${user_id}`).remove();
                let target = (caller_name=="")? shop_name:(shop_name+" "+caller_name);
                notify_Msgs.push({
                  type: 'text',
                  //text: `${target} 叫號設定 ${user_num}號 已過期(逾12小時)，系統已自動刪除...`
                  text: `${target} 叫號設定 ${notify_num}號 已過期(逾12小時)，系統已自動刪除...`
                });
              }
              
              // 判斷是否通知
              /*
              if ((curr_num >= notify_num) && (curr_num < user_num)) {
                if (!notified) {
                  // 更新 focusCaller
                  let focus_caller = {};
                  focus_caller['shop_id'] = shop_id;
                  focus_caller['caller_id'] = caller_id;
                  let userRef = userDB.ref(`lineUserMsg/${user_id}`);
                  await userRef.child('focusCaller').set(focus_caller);
                  
                  // 通知即將到號
                  notify_Msgs.push(reply_msg.query_num('notify', shop_id, caller_id, shop_name, caller_name, curr_num, prev_num, change_time, update_time, last_update, user_num, notify_num));
                  await eventDB.ref(`${c_shop_id}/${c_room_id}/${user_id}`).child('notified').set(true);
                }
              }
              else if (curr_num >= user_num) {
              */  
              if (curr_num >= notify_num) {
                // 更新 focusCaller
                let focus_caller = {};
                focus_caller['shop_id'] = shop_id;
                focus_caller['caller_id'] = caller_id;
                let userRef = userDB.ref(`lineUserMsg/${user_id}`);
                await userRef.child('focusCaller').set(focus_caller);
                  
                // 通知已到號
                notify_Msgs.push(reply_msg.query_num('notify', shop_id, caller_id, shop_name, address, caller_name, curr_num, prev_num, change_time, update_time, last_update, "已到號", notify_num));
                await eventDB.ref(`${c_shop_id}/${c_room_id}`).child(`${user_id}`).remove();
              }
              
              // 送出訊息
              if (notify_Msgs.length > 0) line_client.pushMessage(user_id, notify_Msgs);
            }        
          }
        }  
      }    
    }
    // 測試 lock
    //await sleep(6000);

    // 取得結束時間
    let end_time = Date.now();
    // 計算 執行過程花費時間
    console.log('[thread '+thread_id+']'+(end_time-start_time)/1000+"秒");
  }, async (err, ret) => {
    if (err) {
      console.log('[thread '+thread_id+']'+'執行失敗');
      //console.log(err);
    }
    if (ret) console.log(ret);
  });
}

main();



import fs from 'fs';
import fsPromises from 'fs/promises';
import line from '@line/bot-sdk';
import admin from 'firebase-admin';
import chokidar from 'chokidar';
import AsyncLock from 'async-lock';
import md5 from 'md5';

// for CloudRun
import {Storage} from '@google-cloud/storage';
import express from 'express';
import path from 'path';
import {execSync, exec} from 'child_process';

// reply_msg.js
import * as reply_msg from './reply_msg.js';

// 設定時區
process.env.TZ = "Asia/Taipei";

// 取得 deploy_type
let deploy_type = "VM";
if ( typeof process.env.DEPLOY_TYPE !== 'undefined' && process.env.DEPLOY_TYPE ) {
  deploy_type = process.env.DEPLOY_TYPE;
}
console.log(`deploy_type: ${deploy_type}`);

// 取得 project_id
let project_id;
if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
  project_id = process.env.PROJECT_ID;
}
else {
  try {
    const cmd = "gcloud config get-value project";
    project_id = execSync(cmd).toString().split("\n")[0]; //只取第一列
  } catch (err) {
    console.log(`error code: ${err.status}  mesaage: ${err.message}`);
    process.exit(1);
  }
}
console.log(`project_id: ${project_id}`);

// 取得 bucketName
let bucketName = project_id+'_common_data';

// sleep m_sec millisecond
function sleep(m_sec){
 return new Promise((resolve,reject)=>{
  setTimeout(()=>resolve(),m_sec)
 })
}

// 取得 年月日字串 "yyyymmdd"
function get_ymd(date_object) {
  let year = date_object.getFullYear();
  let month = ("00"+(date_object.getMonth()+1)).substr(-2);
  let day = ("00"+date_object.getDate()).substr(-2);
  let ymd = `${year}${month}${day}`;
  return ymd;
}

// 取得星期幾
function get_week_day(date_obj) {
  let week_day = date_obj.getDay();

  switch (week_day) {
    case 0:
      week_day = "星期日";
    break;
    case 1:
      week_day = "星期一";
    break;
    case 2:
      week_day = "星期二";
    break;
    case 3:
      week_day = "星期三";
    break;
    case 4:
      week_day = "星期四";
    break;
    case 5:
      week_day = "星期五";
    break;
    case 6:
      week_day = "星期六";
    break;
  }
  
  return week_day;
}

// get relative time
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

// async lock
var lock = new AsyncLock({timeout: 1000});

// thread number
var thread_num = 4;

var line_client;
var shopDB;
var callerDB;
var eventDB;
var userDB;
var bookingDB;
var bookingTempDB;

// 需先準備的資料
var shopData = {};
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
  // shop_data.json 檔案路徑  
  let shop_file_path = path.join(process.cwd(), '../common_data/shop_data.json');
  console.log(shop_file_path);

  // Creates a cloud storage client
  let storage_client;
  if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
    let storage_key_file = await fsPromises.readFile(`./data/${project_id}/storage_service_account_key.json`, 'utf8');
    let storage_key = JSON.parse(storage_key_file);
    storage_client = new Storage({
      projectId: project_id,
      credentials: storage_key
    });
  }
  
  // 從 cloud storage 下載 shop_data.json
  async function download_shop_file(target_path) {
    let fileName = 'shop_data.json';
    
    // Downloads the file
    const options = {
      destination: target_path
    };
    await storage_client.bucket(bucketName).file(fileName).download(options);
    console.log(
      `gs://${bucketName}/${fileName} downloaded to ${target_path}.`
    );
    
    return Promise.resolve(null);
  }

  if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
    await download_shop_file(shop_file_path);
  }
  
  // 檢查 shop_data.json 是否存在
  if (!fs.existsSync(shop_file_path)) {
    console.log("shop_data.json 檔案不存在...");
    process.exit(1);
  }
  
  let line_config_file = await fsPromises.readFile(`./data/${project_id}/lineConfig.json`, 'utf8');
  let line_config = JSON.parse(line_config_file);
  line_client = new line.Client(line_config);

  let firebase_key_file = await fsPromises.readFile(`./data/${project_id}/firebase_service_account_key.json`, 'utf8');
  let firebase_key = JSON.parse(firebase_key_file);

  let firebase_config_file = await fsPromises.readFile(`./data/${project_id}/firebaseConfig.json`, 'utf8');
  let firebase_config = JSON.parse(firebase_config_file);
  let db_str = firebase_config.db_str;

  let shopApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://shop-list-' + db_str
  }, 'shopApp');
  
  let callerApp = admin.initializeApp({
    credential: admin.credential.cert(firebase_key),
    databaseURL: 'https://shop-caller-' + db_str
  }, 'callerApp');

  let eventApp = admin.initializeApp({
    credential: admin.credential.cert(firebase_key),
    databaseURL: 'https://user-event-' + db_str
  }, 'eventApp');

  let userApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://line-user-msg-' + db_str
  }, 'userApp');

  let bookingApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://user-booking-' + db_str
  }, 'bookingApp');

  let bookingTempApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://user-booking-temp-' + db_str
  }, 'bookingTempApp');

  shopDB = shopApp.database();
  callerDB = callerApp.database();
  eventDB = eventApp.database();
  userDB = userApp.database();
  bookingDB = bookingApp.database();
  bookingTempDB = bookingTempApp.database();

  // 讀取店家資料
  let shop_file = await fsPromises.readFile(shop_file_path, 'utf8');
  shopData = await JSON.parse(shop_file);
  console.log('shop count:', Object.keys(shopData).length);
  get_belong_shops(shopData);

  // 即時更新店家資料
  chokidar.watch(shop_file_path).on('change', (path, stats) => {
    //console.log(path, stats);
    read_new_shop_data();
  });

  async function read_new_shop_data() {
    await sleep(5000);
    let new_shop_file = await fsPromises.readFile(shop_file_path, 'utf8');
    let new_shopData = await JSON.parse(new_shop_file);
    shopData = new_shopData;
    console.log('shop count:', Object.keys(shopData).length);
    get_belong_shops(shopData);
  }

  /*
  // (firebase) 讀取店家資料
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
  
  // (firebase) 即時更新店家資料
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

  let app = express();
  app.use(express.json());

  // 接收預約資料
  app.post('/booking', async (req, res) => {
    //console.log(req.query);    
    //console.log(req.params);
    //console.log(req.body);
    
    // 顯示 booking_str
    let booking_str = JSON.stringify(req.body, null, 2);
    console.log(booking_str);
    
    // 取得 booking_obj
    let booking_obj = {};
    booking_obj = JSON.parse(booking_str);
    
    // 新使用者預約
    if (!('callme_id' in booking_obj)) booking_obj.callme_id = "";

    // 檢查必需欄位是否存在
    if (!('source_id' in booking_obj) || !('action' in booking_obj) || !('callme_id' in booking_obj) || !('booking_date' in booking_obj) || !('booking_time_id' in booking_obj) || !('hash' in booking_obj)) {
      console.log("資料缺少必要欄位");
      return res.sendStatus(400);
    }

    // 驗証 hash code
    let source_id = booking_obj.source_id;
    let booking_time_id = booking_obj.booking_time_id;
    let hash = md5(`${source_id}_${booking_time_id}_callme`);
    if (booking_obj.hash != hash) {
      console.log("資料來源錯誤");
      console.log(hash);
      return res.sendStatus(400);
    }
    
    // 將 免排測試帳號 test123 轉換成正常 callme_id
    if (booking_obj.callme_id == "test123") booking_obj.callme_id = "VTk1NTQ3YjdiOWIxMjI2ZjA4NTYzODI1YzdmOGRiNTMz";
    
    // 取得 user_id (base64 decode)
    let bufferObj = Buffer.from(booking_obj.callme_id, "base64");
    let user_id = bufferObj.toString("utf8");
    //console.log(user_id);

    // 用 user_id 取代 callme_id
    delete booking_obj['callme_id'];
    booking_obj['user_id'] = user_id;
    
    // 加入 notified 欄位
    booking_obj['notified'] = false;
    
    // booking_time 只取到分鐘 (hh:mm)
    if ('booking_time' in booking_obj) booking_obj.booking_time = booking_obj.booking_time.substr(0,5);

    // 讀取 預約資料
    let action = booking_obj.action;
    let date = booking_obj.booking_date;
    let date_key = date.replaceAll("-","");
    let user_name = "";
    let target_name = "";
    let time = "";
    let number = "";
    
    // 取得 Week Day
    let date_obj = new Date(date);
    let week_day = get_week_day(date_obj);

    let msg = "";
    if (action == "預約") {
      user_name = booking_obj.user_name;
      target_name = booking_obj.shop_name+" "+booking_obj.booking_name;
      time = booking_obj.booking_time;
      number = booking_obj.booking_num;
      // 資料庫 新增預約資料
      if (user_id != "") {
        bookingDB.ref(`${date_key}/${user_id}/${booking_time_id}`).set(booking_obj);
        msg = "已收到預約資訊：";
      }
      else {
        // 缺少 user_id, 新增至 預約暫存資料
        bookingTempDB.ref(`${date_key}/${user_name}/${time}`).set(booking_obj);    
      }
    }
    else if (action == "取消預約") {
      // 資料庫 讀取預約資料
      let bookingData = {};	
      await bookingDB.ref(`${date_key}/${user_id}/${booking_time_id}`).once('value', (snapshot) => {
        if (snapshot.exists() && (snapshot!=null)) {
          bookingData = snapshot.val();      
          if (Object.keys(bookingData).length == 0) console.log('booking data not exist!');
        }
        else {
          if (!snapshot.exists()) console.log('booking data not exist!');
          if (snapshot == null) console.log('booking data is null!');
        }
      }, (errorObject) => {
        console.log('[firebase] booking data read failed: ' + errorObject.name);
      });
      if (Object.keys(bookingData).length > 0) {
        user_name = bookingData.user_name;
        target_name = bookingData.shop_name+" "+bookingData.booking_name;
        time = bookingData.booking_time;
        number = bookingData.booking_num;
        // 資料庫 刪除預約資料
        bookingDB.ref(`${date_key}/${user_id}/${booking_time_id}`).remove();
        msg = "已取消預約：";
      }
    }

    // 準備通知訊息
    if (msg != "") {
      msg += `\n${target_name}`;
      msg += `\n姓名：${user_name}`;
      msg += `\n日期：${date} (${week_day})`;
      if (time != "") msg += `\n時間：${time}`;
      if (number!="" && number!="-1") msg += `\n號碼：${number}`;
      if (action == "預約") {
        msg += "\n\n將於預約日前一天☀️𝟵:𝟬𝟬提醒您";
        msg += "\n(逾上述時間後預約，將不再提醒)";
      }
    }
    else {
      if (action == "取消預約") {
        msg = `${date}預約資料不存在或已取消`;
      }
    }
    
    // 傳送通知訊息
    if (msg != "") {
      let notify_Msgs = [];
      notify_Msgs.push({type:'text', text:msg});
      line_client.pushMessage(user_id, notify_Msgs);
    }
    
    return res.sendStatus(200);
  });

  // 回報 service 的狀態
  app.get('/status', (req, res) => {
    res.send('Server is running');
  });
  
  // listen port 3000
  app.listen(3100, () => {
    console.log('Listening on port 3100');
  });
  
  if (deploy_type == "cloud_run") {
    // 接收 cloud storage 的 common_data 異動 trigger
    app.post('/common_data', async (req, res) => {
      // 顯示 header 所有欄位
      //console.log(JSON.stringify(req.headers, null, 2));
      
      if (!req.header('ce-subject')) {
        console.log("找不到 header 'ce-subject'");
        //return res.sendStatus(400);
        return res.status(400).send('Bad Request: missing required header: ce-subject');
      }
      else {
        if (req.header('ce-subject') == "objects/shop_data.json") {
          let download_path = path.join(process.cwd(), '../download/shop_data.json');
          await download_shop_file(download_path);
          console.log(`cp -f ${download_path} ${shop_file_path}`);
          exec(`cp -f ${download_path} ${shop_file_path}`, (error, stdout, stderr) => {
            if (error) {
              console.log(`執行失敗: ${error}`);
              return;
            }
            else if (stderr) {
              console.log(`執行失敗: ${stderr}`);
              return;
            }
            else if (stdout) {
              console.log(`執行結果: ${stdout}`);
            }
          });          
        }
        //return res.sendStatus(200);
        return res.status(200).send(`Detected change in Cloud Storage bucket: ${req.header('ce-subject')}`);
      }
    });

    // 接收 cloud schedule 的 job_1m trigger
    app.get('/job_1m', (req, res) => {
      // 記錄開始時間
      let start_time = Date.now();
      console.log('job_1m start');
      
      // setInterval (5秒執行一次)
      let interval_id_arr=[];
      for (let i=0; i<thread_num; i++) {
        notify_user(i, thread_num);  
        interval_id_arr[i] = setInterval(() => notify_user(i, thread_num), 5000);
      }
      
      // 1分鐘後 clearInterval
      setTimeout(() => {
        for (let i=0; i<thread_num; i++) {
          clearInterval(interval_id_arr[i]);
        }
        // 取得結束時間
        let end_time = Date.now();
        // 計算時間
        console.log('job_1m end - '+(end_time-start_time)/1000+"秒");
      }, 59500);
      
      res.send('job_1m OK');
    });
    
    // 接收 cloud schedule 的 job_1h trigger
    app.get('/job_1h', (req, res) => {
      notify_booking();        
      res.send('job_1h OK');
    });
  }
  else {
    // 提醒就診 (網路預約)
    notify_booking();
    setInterval(notify_booking, 1000*60*60);
    
    // 通知到號
    for (let i=0; i<thread_num; i++) {
      notify_user(i, thread_num);  
      setInterval(() => notify_user(i, thread_num), 5000);
    }
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
            let callers = shopData[shop_id].callers;
            let address = shopData[shop_id].address;
            let zone = "";
            if ('zone' in shopData[shop_id]) zone = shopData[shop_id].zone;
            let g_address = "";
            if ('google_map' in shopData[shop_id] && 'address' in shopData[shop_id].google_map) {
              g_address = shopData[shop_id].google_map.address;
            }

            //取得 address_fix (地址顯示字串)
            let address_fix = "";
            if (address != "") address_fix = address;
            else if (g_address != "") address_fix = g_address;
            else address_fix = zone;
            
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
              let timestamp = eventData[c_shop_id][c_room_id][user_id]['timestamp'];

              // 過期訊息(超過12小時)，將其刪除
              if ((Date.now()-timestamp) > 43200*1000) {
                // 移除過期事件
                await eventDB.ref(`${c_shop_id}/${c_room_id}`).child(`${user_id}`).remove();
                
                // 送出通知訊息
                let target = (caller_name=="")? shop_name:(shop_name+" "+caller_name);
                let notify_Msgs = [];
                notify_Msgs.push({
                  type: 'text',
                  text: `${target} 叫號設定 ${notify_num}號 已過期(逾12小時)，系統已自動刪除...`
                });
                line_client.pushMessage(user_id, notify_Msgs);
                
                // console 顯示訊息
                let target_name = `${shop_name} ${caller_name}`;
                console.log(`${user_id}\n通知過期：${target_name}`);
              }
              
              // 判斷是否通知
              if (curr_num >= notify_num) {
                // 更新 focusCaller
                let focus_caller = {};
                focus_caller['shop_id'] = shop_id;
                focus_caller['caller_id'] = caller_id;
                let userRef = userDB.ref(`lineUserMsg/${user_id}`);
                await userRef.child('focusCaller').set(focus_caller);

                // 準備通知訊息
                let notify_Msgs = [];
                notify_Msgs.push(reply_msg.query_num('notify', shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, "已到號", notify_num));

                // 送出通知訊息
                if (notify_Msgs.length > 0) {
                  line_client.pushMessage(user_id, notify_Msgs);
                  // 移除已通知事件
                  await eventDB.ref(`${c_shop_id}/${c_room_id}`).child(`${user_id}`).remove();
                  // console 顯示訊息
                  let target_name = `${shop_name} ${caller_name}`;
                  console.log(`${user_id}\n通知到號：${target_name}`);
                }
              }
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

// 提醒就診 (網路預約)
async function notify_booking() {
  // 每天 20:00 ~ 21:00 執行
  let date_obj = new Date();
  let hour = ("00"+date_obj.getHours()).substr(-2);
  //if (parseInt(hour,10) > 12) {   // for 測試
  if (hour == "09") {
    // 取得明天日期
    let tomorrow_obj = new Date(Date.now()+1000*60*60*24*1);
    let tomorrow_ymd = get_ymd(tomorrow_obj);

    // 讀取明天的預約資訊
    let bookingData = {};	
    console.log('reading booking data...');
    await bookingDB.ref(`${tomorrow_ymd}`).once('value', (snapshot) => {
      if (snapshot.exists() && (snapshot!=null)) {
        bookingData = snapshot.val();      
        if (Object.keys(bookingData).length == 0) console.log('booking data not exist!');
      }
      else {
        if (!snapshot.exists()) console.log('booking data not exist!');
        if (snapshot == null) console.log('booking data is null!');
      }
    }, (errorObject) => {
      console.log('[firebase] booking data read failed: ' + errorObject.name);
    });
    
    // 提醒就診
    if (Object.keys(bookingData).length > 0) {
      for (let user_id in bookingData) {
        // 通知訊息陣列
        for (let booking_time_id in bookingData[user_id]) {
          // 忽略已提醒過的訊息
          let notified = bookingData[user_id][booking_time_id].notified;
          if (notified) continue;
          
          let user_name = bookingData[user_id][booking_time_id].user_name;
          let target_name = bookingData[user_id][booking_time_id].shop_name+" "+bookingData[user_id][booking_time_id].booking_name;
          let date = bookingData[user_id][booking_time_id].booking_date;
          let time = bookingData[user_id][booking_time_id].booking_time;
          let number = bookingData[user_id][booking_time_id].booking_num;

          // 取得 Week Day
          let date_obj = new Date(date);
          let week_day = get_week_day(date_obj);

          // 準備通知訊息
          let msg = "🔔提醒您明天有預約：";
          msg += `\n${target_name}`;
          msg += `\n姓名：${user_name}`;
          if (date != "") msg += `\n日期：${date} (${week_day})`;
          if (time != "") msg += `\n時間：${time}`;
          if (number!="" && number!="-1") msg += `\n號碼：${number}`;
          // 傳送通知訊息
          let notify_Msgs = [];
          notify_Msgs.push({
            type: 'text',
            text: msg
          });
          line_client.pushMessage(user_id, notify_Msgs);
          // 設定為已通知
          bookingDB.ref(`${tomorrow_ymd}/${user_id}/${booking_time_id}/notified`).set(true);
        }
      }
    }
    
    // 計算 user_booking 過期日期 (保留一週)
    let exp_date_obj = new Date(Date.now()-1000*60*60*24*8);
    let exp_ymd = get_ymd(exp_date_obj);
    console.log("user_booking 過期日期："+exp_ymd);
    //log_file.write("user_booking 過期日期："+exp_ymd+"\n");
    
    // (Firebase) 移除 user_booking 過期資料 
    bookingDB.ref(`/${exp_ymd}`).remove();
    console.log(`[firebase] remove user_booking data: ${exp_ymd}`);
    //log_file.write(`[firebase] remove user_booking data: ${exp_ymd}\n`);

    let booking_snapshot = await bookingDB.ref('/').orderByKey().endBefore(`${exp_ymd}`).limitToFirst(1).once('value');
    if (booking_snapshot.exists()) {
      // 取得過期資料最早的日期
      let first_key = Object.keys(booking_snapshot.val())[0];
      while(true){
        exp_date_obj = new Date(exp_date_obj.valueOf()-1000*60*60*24*1); // 往前一天
        exp_ymd = get_ymd(exp_date_obj);
        if (exp_ymd < first_key) break;
        
        bookingDB.ref(`/${exp_ymd}`).remove();
        console.log(`[firebase] remove user_booking data: ${exp_ymd}`);
        //log_file.write(`[firebase] remove user_booking data: ${exp_ymd}\n`);
      }
    }
    
    // 計算 user_booking_temp 過期日期 (只保留今天)
    exp_date_obj = new Date(Date.now()-1000*60*60*24*1);
    exp_ymd = get_ymd(exp_date_obj);
    console.log("user_booking_temp 過期日期："+exp_ymd);
    //log_file.write("user_booking_temp 過期日期："+exp_ymd+"\n");
    
    // (Firebase) 移除 user_booking_temp 過期資料 
    bookingTempDB.ref(`/${exp_ymd}`).remove();
    console.log(`[firebase] remove user_booking_temp data: ${exp_ymd}`);
    //log_file.write(`[firebase] remove user_booking_temp data: ${exp_ymd}\n`);

    let booking_temp_snapshot = await bookingTempDB.ref('/').orderByKey().endBefore(`${exp_ymd}`).limitToFirst(1).once('value');
    if (booking_temp_snapshot.exists()) {
      // 取得過期資料最早的日期
      let first_key = Object.keys(booking_temp_snapshot.val())[0];
      while(true){
        exp_date_obj = new Date(exp_date_obj.valueOf()-1000*60*60*24*1); // 往前一天
        exp_ymd = get_ymd(exp_date_obj);
        if (exp_ymd < first_key) break;
        
        bookingTempDB.ref(`/${exp_ymd}`).remove();
        console.log(`[firebase] remove user_booking_temp data: ${exp_ymd}`);
        //log_file.write(`[firebase] remove user_booking_temp data: ${exp_ymd}\n`);
      }
    }    
  }
}

main();



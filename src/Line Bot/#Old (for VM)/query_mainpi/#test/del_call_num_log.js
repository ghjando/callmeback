//  串接免排API並更新叫號情形 該程式為主要程式

// Import Admin SDK
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const { getDatabase } = require('firebase-admin/database');
const WebSocket = require('ws');
const fs = require('fs');
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

const shopApp = admin.initializeApp(firebaseConfig, 'shopApp');
const shopDB = getDatabase(shopApp);

firebaseConfig.databaseURL = 'https://shop-caller-callme-398802.asia-southeast1.firebasedatabase.app/';
const callerApp = admin.initializeApp(firebaseConfig, 'callerApp');
const callerDB = getDatabase(callerApp);

firebaseConfig.databaseURL = 'https://call-num-log-callme-398802.asia-southeast1.firebasedatabase.app/';
const numlogApp = admin.initializeApp(firebaseConfig, 'numlogApp');
const numlogDB = getDatabase(numlogApp);

firebaseConfig.databaseURL = 'https://webhook-events-callme-398802.asia-southeast1.firebasedatabase.app';
const webhookApp = admin.initializeApp(firebaseConfig, 'webhookApp');
const webhookDB = getDatabase(webhookApp);

// 店家資料
var shopData = {};

// 叫號機所屬店家
var belong_shops = {};

// 詢問訊息陣列
var query_msgs = [];

// websocket 陣列
var ws = [];

/*
var shopData = null;
shopDB.ref('/').on('value', (snapshot) => {
  if (snapshot.exists()) {
    shopData = snapshot.val();
    //build_msg(shopData);
    get_query_msgs(shopData);
    //console.log('[firebase] Shop:', shopData);
  } else {
    console.log('[firebase] Shop: no data');
  }
}, (errorObject) => {
  console.log('[firebase] Shop: read failed: ' + errorObject.name);
});
*/

/*
// 叫號機資料
var callerData = null;
callerDB.ref('/').once('value', (snapshot) => {
  if (snapshot.exists()) {
    callerData = snapshot.val();
    //console.log('[firebase] Caller:', callerData);
  } else {
    console.log('[firebase] Caller: no data');
  }
}, (errorObject) => {
  console.log('[firebase] Caller: read failed: ' + errorObject.name);
});
*/

function isObject(val) {
  return val != null && typeof val === 'object' && Array.isArray(val) === false;
};

// 取得 詢問訊息陣列 
function get_query_msgs(shop_data) {
  // 取得 所屬店家
  let owner_obj = {};
  for (let shop_id in shop_data) {
    for (let caller_id in shop_data[shop_id].callers) {
      owner_obj[caller_id] = shop_id;
    }
  }

  // 從 caller_id 取出 c_shop_id
  let caller_id_arr = Object.keys(owner_obj);
  let c_shop_id_arr = caller_id_arr.map(function(caller_id){
    let split_arr = caller_id.split('-');
    return split_arr[0];
  });
  
  let shop_id_arr = [...new Set(c_shop_id_arr)];
  let remainder = shop_id_arr.length%20;
  let send_times = (shop_id_arr.length-remainder)/20;
  let msg_arr = [];
  
  // 每20個店家，組成傳送訊息
  for (let i=0; i<send_times; i++) {
    let start = i*20;
    let end = (i+1)*20
    let msg = "";
    for (let j=start; j<end; j++) {
      msg += shop_id_arr[j]+",";
    }
    msg = msg.slice(0, -1);
    msg_arr.push(msg);
  }
  
  // 最後剩下的店家，組成傳送訊息
  if (remainder != 0) {
    let start = send_times*20;
    let end = start + remainder;
    let msg = "";
    for (let j=start; j<end; j++) {
      msg += shop_id_arr[j]+",";
    }
    msg = msg.slice(0, -1);
    msg_arr.push(msg);
  }

  // 儲存到全域變數
  belong_shops = owner_obj;
  query_msgs = msg_arr;
}

function NewSocket(i) {
  try {
    let ws_protocol = "wss";
    ws[i] = new WebSocket(ws_protocol + "://www.mainpi.com/.ws_mainpi/");
    ws[i].onopen = ws_onopen;
    ws[i].onclose = ws_onclose;
    ws[i].onerror = ws_onerror;
    ws[i].onmessage = ws_onmessage;
  }
  catch (e) {
    console.log("websoket "+i+" error:" + e.message);
  }
  return;
}

/*
function QueryCaller() {
  let msg = '';
  for (let k in shopData) {
    //if (k == "1337") continue;
    msg += `${k},`;
  }
  msg = msg.slice(0, -1);
  console.log('[WebSocket] Send data', JSON.stringify({ type: "query", text: msg, }));
  ws.send(JSON.stringify({ type: "query", text: msg, }));
}
*/

function QueryCaller(i) {
  // 傳送訊息
  console.log('[WebSocket '+i+'] Send data', JSON.stringify({ type: "query", text: query_msgs[i], }));
  ws[i].send(JSON.stringify({ type: "query", text: query_msgs[i], }));
}

function ws_onopen(e) {
  console.log('[WebSocket] Open!');
  //QueryCaller();  //無法執行 (因開啟多連線)
}

function ws_onclose(e) {
  console.log('[WebSocket] Close', e);
  //ws = null;  //無法執行 (因開啟多連線)
  }

function ws_onerror(e) {
  console.log('[WebSocket] Error', e);
  //ws = null;  //無法執行 (因開啟多連線)
}

function ws_onmessage(e) {  
  try {
    let date_obj = new Date();
    let now_str = "" + date_obj.getTime();
    let year = date_obj.getFullYear();
    let month = ("00"+(date_obj.getMonth()+1)).substr(-2);
    let day = ("00"+date_obj.getDate()).substr(-2);
    let hour = ("00"+date_obj.getHours()).substr(-2);
    let minute = ("00"+date_obj.getMinutes()).substr(-2);
    let second = ("00"+date_obj.getSeconds()).substr(-2);
    
    const message = e.data;
    // console.log('[WebSocket] Receive Data', message);
    
    const d = JSON.parse(message);
    // console.log('[WebSocket] Parse Data', d);

    if (!Array.isArray(d) || (d.length<=0) || !isObject(d[0])) {
      console.log('message format error!!');
      return;
    }    

    // console.log('[WebSocket] Receive Data', message);
    if (d[0].hasOwnProperty('change') && d[0].change) console.log('[WebSocket] Receive Data', message);
    
    /*
    // d 是陣列資料
    // d[0].change: 表示是否叫號有變
    // d[0].call_nums: 目前叫號A~D排，一般使用A排
    // d[0].last_update: 上次更新，0表示連線中即時更新，當 >1 表示最後更新時間，例如:3，表示3分鐘前更新  (此值為10，表示已斷線)
    */
    for (i = 0; i < d.length; i++) {
      // 張國榮 及 陳献明 資料異常 (call_nums='', ticket_nums='', last_update=-1)
      // if (d[i].id==2163 || d[i].id==2391) console.log(d[i]);
      // if (d[i].id==2364) console.log(d[i]); //科安 作為對比
      
      if (d[i].call_nums != null) {
        if ('queue' in d[i]) delete d[i].queue;
        if ('ticket_nums' in d[i]) delete d[i].ticket_nums;
        
        // 張國榮 及 陳献明 資料異常 (call_nums='', ticket_nums='', last_update=-1)
        if (d[i].call_nums == '') d[i].call_nums = '[0,0,0,0]';
        //if (d[i].ticket_nums == '') d[i].ticket_nums = '[0,0,0,0]';
        
        // 轉成 JSON 格式，再取出 value 陣列
        d[i].call_nums = Object.values(JSON.parse(d[i].call_nums));
        //d[i].ticket_nums = Object.values(JSON.parse(d[i].ticket_nums));
        
        // 加入店家名稱
        // d[i].name = shopData[d[i].id].name;
        
        // 資料庫中此 caller 的資料是否存在
        let caller_data_exist = callerData.hasOwnProperty(d[i].id);
        
        // 取得 old_change_times
        let old_change_times = [];
        if (caller_data_exist && callerData[d[i].id].hasOwnProperty('change_times')) {
          //old_change_times = Object.values(callerData[d[i].id].change_times);
          old_change_times = callerData[d[i].id].change_times;
          for (let j=0; j<old_change_times.length; j++) {
            if (old_change_times[j]=='') old_change_times[j]=now_str;
          }
        }
        else {
          old_change_times = [now_str,now_str,now_str,now_str];
        }
          
        
        // 取得 old_change_times 及 儲存 "跳號記錄"
        let new_change_times = [];
        if (caller_data_exist && d[i].change && d[i].last_update==0) {

          //console.log("before:\n"+JSON.stringify(callerData[d[i].id]));
          
          //let old_nums = Object.values(callerData[d[i].id].call_nums);
          //let new_nums = Object.values(d[i].call_nums);
          let old_nums = callerData[d[i].id].call_nums;
          let new_nums = d[i].call_nums;

          for (let k=0; k<new_nums.length; k++) {
            if (k < old_nums.length) {
              if (new_nums[k] != old_nums[k]) {
                new_change_times[k]=now_str;
                // 儲存跳號記錄
                if ((d[i].id+"-"+k) in belong_shops) {
                  numlogDB.ref(`/${d[i].id}-${k}/${year}${month}/${day}/${hour}:${minute}:${second}`).set({
                    'call_num':new_nums[k], 
                    'timestamp':new_change_times[k], 
                    'time_diff':new_change_times[k]-old_change_times[k]
                  });
                }
                /*
                console.log(`/${d[i].id}/${k}/${year}/${month}/${day}/${now_str}`);
                console.log(JSON.stringify({
                  'call_num':new_nums[k], 
                  'duration':new_change_times[k]-old_change_times[k]
                }));
                */
              }
              else new_change_times[k]= (k<old_change_times.length)? old_change_times[k]:now_str;
            }
            else {
              new_change_times[k]=now_str;
              // 儲存跳號記錄
              if ((d[i].id+"-"+k) in belong_shops) {
                numlogDB.ref(`/${d[i].id}-${k}/${year}${month}/${day}/${hour}:${minute}:${second}`).set({
                  'call_num':new_nums[k], 
                  'timestamp':new_change_times[k], 
                  'time_diff':new_change_times[k]-old_change_times[k]
                });
              }            }
          }
          
          /*
          console.log("old_nums: "+JSON.stringify(old_nums)); 
          console.log("new_nums: "+JSON.stringify(new_nums)); 
          console.log("old_change_times: "+JSON.stringify(old_change_times));
          console.log("new_change_times: "+JSON.stringify(new_change_times)); 
          */
        }
        else {
          new_change_times = old_change_times;
        }
        
        // 收到 叫號機訊息 的時間.
        d[i].update_time = now_str;
        
        /*
        // 加入跳號更新時間.
        let obj_change_times = {};
        for (let i=0; i<new_change_times.length; i++) {
          obj_change_times[i] = (new_change_times[i]==null)? "":new_change_times[i];
        }      
        d[i].change_times = obj_change_times;
        */

        // 更新 跳號時間.
        for (let i=0; i<new_change_times.length; i++) {
          if (new_change_times[i]==null) new_change_times[i]="";
        }      
        d[i].change_times = new_change_times;
        
        // 張國榮 及 陳献明 資料異常 (call_nums='', ticket_nums='', last_update=-1)
        // if (d[i].id==2163 || d[i].id==2391) console.log(d[i]);
        // if (d[i].id==2364) console.log(d[i]); //科安 作為對比

        // 直接更新 callerData，不必從 firebase 重複讀取
        callerData[d[i].id] = {...d[i]};
        //console.log("after:\n"+JSON.stringify(callerData[d[i].id]));

        // 寫入 firebase
        callerDB.ref(d[i].id).set({...d[i]});      
      }
    }  
  } catch (err) {
    return console.error(err); 
  }
}

// sleep m_sec millisecond
function sleep(m_sec){
 return new Promise((resolve,reject)=>{
  setTimeout(()=>resolve(),m_sec)
 })
}

// 詢問免排叫號資料
async function query_mainpi() {
  let msg_arr = query_msgs;

  for (let i=0; i<msg_arr.length; i++) {
    // 每發送 10次 Query, 暫停 5秒
    if (i!=0 && i%10==0) await sleep(5000);
    
    if ((i>=ws.length) || (ws[i] === null) || (ws[i].readyState === WebSocket.CLOSED)) {
      NewSocket(i);
    }else if (ws[i].readyState === WebSocket.OPEN) {
      QueryCaller(i);
    }
  }
}

// 移除過期資料 及 產生店家活躍度排行
async function del_exp_data() {
  let date_obj = new Date();
  let hour = ("00"+date_obj.getHours()).substr(-2);
  if (hour == "05") {
    // 計算 webhook-events 過期日期
    let exp_date_obj = new Date();
    exp_date_obj.setDate(date_obj.getDate()-14);
    let exp_year = exp_date_obj.getFullYear();
    let exp_month = ("00"+(exp_date_obj.getMonth()+1)).substr(-2);
    let exp_day = ("00"+exp_date_obj.getDate()).substr(-2);
    let exp_str = `${exp_year}${exp_month}${exp_day}`;
    
    // 移除 webhook-events 過期資料
    let webhook_snapshot = await webhookDB.ref('/').once('value');
    if (webhook_snapshot.exists()) {
      let webhook_data = webhook_snapshot.val();
      for (let date in webhook_data) {
        if (date < exp_str) {
          await webhookDB.ref(`${date}`).remove();
          console.log(`remove webhook data: ${date}`);
        }
      }
    }
    
    // 計算 call-num-log 過期月份
    exp_date_obj = new Date();
    exp_date_obj.setMonth(date_obj.getMonth()-3);
    exp_year = exp_date_obj.getFullYear();
    exp_month = ("00"+(exp_date_obj.getMonth()+1)).substr(-2);
    exp_str = `${exp_year}${exp_month}`;

    // 移除 call-num-log 過期資料
    let numlog_snapshot = await numlogDB.ref('/').once('value');
    if (numlog_snapshot.exists()) {
      let numlog_data = numlog_snapshot.val();
      for (let caller_id in numlog_data) {
        for (let month in numlog_data[`${caller_id}`]) {
          if (month < exp_str) {
            await numlogDB.ref(`${caller_id}/${month}`).remove();
            console.log(`remove numlog data: ${caller_id}/${month}`);
          }
        }
      }
    }

    /*
    // 計算 店家活躍度排行 起迄日期
    let start_date_obj = new Date();
    start_date_obj.setDate(date_obj.getDate()-7);
    let start_year = start_date_obj.getFullYear();
    let start_month = ("00"+(start_date_obj.getMonth()+1)).substr(-2);
    let start_day = ("00"+start_date_obj.getDate()).substr(-2);
    let start_str = `${start_year}${start_month}${start_day}`;
    
    let end_date_obj = new Date();
    end_date_obj.setDate(date_obj.getDate()-1);
    let end_year = end_date_obj.getFullYear();
    let end_month = ("00"+(end_date_obj.getMonth()+1)).substr(-2);
    let end_day = ("00"+end_date_obj.getDate()).substr(-2);
    let end_str = `${end_year}${end_month}${end_day}`;
 
    // 產生 店家活躍度排行
    let shops_ranking = {};
    if (numlog_snapshot.exists()) {
      let numlog_data = numlog_snapshot.val();
      for (let shop_id in shopData) {
        let shop_name = shopData[shop_id].name;
        let customer_count = 0;
        for (let caller_id in shopData[shop_id].callers) {
          if (caller_id in numlog_data) {
            for (let month in numlog_data[caller_id]) {
              for (let day in numlog_data[caller_id][month]) {
                let ymd = `${month}${day}`;
                if (ymd >= start_str && ymd <= end_str) {
                  customer_count += Object.keys(numlog_data[caller_id][month][day]).length;
                }
              }
            }
          }
        }
        shops_ranking[shop_id].name = shop_name;
        shops_ranking[shop_id].customer_count = customer_count;        
      }
      shops_ranking = shops_ranking.sort(function (a, b) {
        return a.customer_count > b.customer_count ? 1 : -1;
      });
    }
    */
  }
}

async function main() {
/* 暫時註解  
  // 讀取店家資料
  let shop_file = await fs.readFileSync('../common_data/shop_data.json', 'utf8');
  shopData = await JSON.parse(shop_file);
  console.log('shop count:', Object.keys(shopData).length);
  get_query_msgs(shopData);

  // 即時更新店家資料
  chokidar.watch('../common_data/shop_data.json').on('change', (path, stats) => {
    //console.log(path, stats);
    read_new_shop_data();
  });

  async function read_new_shop_data() {
    let new_shop_file = await fs.readFileSync('../common_data/shop_data.json', 'utf8');
    let new_shopData = await JSON.parse(new_shop_file);
    shopData = new_shopData;
    console.log('shop count:', Object.keys(shopData).length);
    get_query_msgs(shopData);    
  }  
  
  // 等待讀取 shop 及 caller 資料
//  while (query_msgs.length==0 || callerData==null) {
  while (query_msgs.length==0) {
    await sleep(5000);
  }
*/
  for (let i=1; i<2705; i++) {
    await numlogDB.ref(`${i}-0`).remove();
    await numlogDB.ref(`${i}-1`).remove();
    await numlogDB.ref(`${i}-2`).remove();
    await numlogDB.ref(`${i}-3`).remove();
    console.log("remove call_num_log "+i);
  }

  /*
  console.log('1');
  await numlogDB.ref('1003-1/202309').remove();
  console.log('2');
  await numlogDB.ref('1003-2/202310').remove();  
  console.log('3');
  await numlogDB.ref('1003-3/202311').remove();  
  console.log('4');
  */
  
  process.exit();

  /*
  // 移除過期資料
  del_exp_data();
  setInterval(del_exp_data, 60*60*1000);  

  // 詢問免排叫號資料
  query_mainpi();
  setInterval(query_mainpi, 50000);  
  */
}

main();


/*
// 主迴圈
setInterval(async () => {
  let msg_arr = query_msgs;

  for (let i=0; i<msg_arr.length; i++) {
    if (i!=0 && i%5==0) await sleep(5000);
    
    if ((i>=ws.length) || (ws[i] === null) || (ws[i].readyState === WebSocket.CLOSED)) {
      NewSocket(i);
    }else if (ws[i].readyState === WebSocket.OPEN) {
      QueryCaller(i);
    }
  }
}, 30000);
*/

/*
ws.on('open', () => {
  console.log('[WebSocket] Open!');
});
ws.on('error', (e) => {
  console.log('[WebSocket] Error', e);
  ws = null;
});
ws.on('close', (code, data) => {
  console.log('[WebSocket] Close', code, data);
  ws = null;
});

ws.on('message', (data, isBinary) => {
  const message = isBinary ? data : data.toString();
  console.log('[WebSocket] Receive Data', message);
  const d = JSON.parse(message);
  console.log('[WebSocket] Parse Data', d);
  // d 是陣列資料
  // d[0].change: 表示是否叫號有變
  // d[0].call_nums: 目前叫號A~D排，一般使用A排
  // d[0].last_update: 上次更新，0表示連線中即時更新，當 >1 表示最後更新時間，例如:3，表示3分鐘前更新
  for (i = 0; i < d.length; i++) {
    if (d[i].call_nums != '') {
      d[i].call_nums = JSON.parse(d[i].call_nums);
      d[i].ticket_nums = JSON.parse(d[i].ticket_nums);
      callerDB.ref(d[i].id).set({ ...d[i], name: shopData[d[i].id].name });
    }
  }
});
*/

/*
setInterval(() => {
  // shopData 取得編號列表  
  // 填入診所ID, 如果一次要查詢多個叫號機可以用逗號隔開，例如： "3,4,5"
  // text: "2391,2378,2364,2354,2353,2339,2301,2291,2289,2285,2274,2250,2203,2175,2168,2163,2160,2142,2106,2099"
  let msg = '';
  for (let k in shopData) {
  msg += `${k},`;
  }
  msg = msg.slice(0, -1);
  console.log('[WebSocket] Send data', JSON.stringify({ type: "query", text: msg, }));
  ws.send(JSON.stringify({ type: "query", text: msg, }));
}, 30000);
*/
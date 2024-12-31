import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import qs from 'qs';
import fs from 'fs/promises';
import colors from 'colors';
import line from '@line/bot-sdk';
import admin from 'firebase-admin';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import querystring from 'querystring';
import chokidar from 'chokidar';
import liff from '@line/liff';

/*
var liff_ready = false;
liff.init({
  liffId: '2003918297-RwqPbwG5',
})
.then(() => {
  liff_ready = true;
})
.catch((err) => {
  console.log(err);
});
*/
 
import * as reply_msg from './reply_msg.js';
 
// 判斷是否為數字
function isNum(val) {
  return !isNaN(val);
}

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

// 搜尋店家
function search_shop(shop_data, query_str, fuzzy, max_num) {
  if (!shop_data) {
    console.error("Shop data is undefined or null");
    return {};
  }

  let result_obj = {};
  for (let shop_id in shop_data) {
    if (shop_data[shop_id] && shop_data[shop_id].name && ((fuzzy)? shop_data[shop_id].name.includes(query_str):(shop_data[shop_id].name==query_str))) {
      result_obj[shop_id] = shop_data[shop_id].name;
      if (fuzzy) {
        if (Object.keys(result_obj).length > max_num) break;
      }
      else {
        if (Object.keys(result_obj).length == 1) break;
      }
    }
  }
  
  return result_obj;
}

// 搜尋叫號機
function search_caller(callers, query_str) {
  if (!callers) {
    console.error("callers data is undefined or null");
    return {};
  }

  let result_obj = {};
  for (let caller_id in callers) {
    if (callers[caller_id] && callers[caller_id].includes(query_str)) {
      result_obj[caller_id] = callers[caller_id];
    }
  }
  
  return result_obj;
}

// 是否存在 match 的店家
function exist_match_shop(shop_data, test_str) {
  let b_found = false;
  for (let shop_id in shop_data) {
    if (shop_data[shop_id] && shop_data[shop_id].name && shop_data[shop_id].name.includes(test_str)) {
      b_found = true;
      break;
    }
  }  
  return b_found;
}

// 是否存在 match 的叫號機
function exist_match_caller(callers, test_str) {
  let b_found = false;
  for (let caller_id in callers) {
    //console.log(test_str);
    //console.log(callers[caller_id]);
    if (callers[caller_id] && callers[caller_id].includes(test_str)) {
      b_found = true;
      break;
    }
  }  
  return b_found;
}

// 進階搜尋店家
function adv_search_shop(shop_data, query_str, fuzzy, max_num) {
  let adv_obj = {};

  // 取得 adv_shop_str
  let adv_shop_str = query_str;
  let adv_caller_str = "";
  for (let i=1; i<=query_str.length; i++) {
    // test_str 逐次遞增長度
    let test_str = query_str.substr(0,i);   
    // 找到 與店家match的 最長 test_str，即為 adv_shop_str
    if (!exist_match_shop(shop_data, test_str)) {
      adv_shop_str = query_str.substr(0,i-1);
      console.log(adv_shop_str);
      adv_caller_str = query_str.substr(i-1);
      console.log(adv_caller_str);
      break;
    }
  }
  
  if (adv_shop_str.length!=0) { // 有找到店家
    adv_obj.result_obj = search_shop(shop_data, adv_shop_str, fuzzy, max_num);
    adv_obj.adv_caller_str = adv_caller_str;
  }
  
  return adv_obj;
}


// 進階搜尋叫號機
function adv_search_caller(callers, query_str) {
  let adv_obj = {};
  let adv_caller_str;
  let adv_number_str="";
  
  // 尋找 query_str 有效的開始位置
  let b_found = false;
  for (let i=0; i<query_str.length; i++) {
    let test_str = query_str.substr(i,1);
    //console.log(test_str);
    if (exist_match_caller(callers, test_str)) {
      console.log("80");
      b_found = true;
      query_str = query_str.substr(i);
      break;
    }
  }
  
  if (!b_found) { // 未找到有效的開始位置
    console.log("81");
    adv_caller_str = "";
    adv_number_str = query_str;
  }
  else {
    console.log("82");
    adv_caller_str = query_str;
    adv_number_str = "";
    for (let i=1; i<=query_str.length; i++) {
      // test_str 逐次遞增長度
      let test_str = query_str.substr(0,i);   
      // 找到與叫號機 match 的最長 test_str，即為 adv_caller_str
      if (!exist_match_caller(callers, test_str)) {
        console.log("83");
        adv_caller_str = query_str.substr(0,i-1);
        adv_number_str = query_str.substr(i-1);
        break;
      }
    }
  }
  
  if (adv_caller_str.length!=0) { // 有找到有效的 adv_caller_str
    console.log("84");
    adv_obj.result_obj = search_caller(callers, adv_caller_str);
    adv_obj.adv_number_str = adv_number_str;
  }
  
  return adv_obj;
}


// 搜尋末尾的額外數字 (店家)
function extra_search_shop(shop_data, query_str, fuzzy, max_num) {
  let extra_obj = {};

  //let reg = /\d+$/;
  let reg = /(No|No.| |　)*\d+( |　|號|号)*$/;
  let arr = query_str.match(reg); // 尋找字串末尾的數字
  if (arr != null) {
    extra_obj.extra_number = arr[0].match(/\d+/);
    query_str = query_str.replace(reg,'').trim();  // 移除字串末尾的數字
    //console.log(query_str);
    extra_obj.result_obj = search_shop(shop_data, query_str, fuzzy, max_num);
    let resultCount = Object.keys(extra_obj.result_obj).length;
    if (resultCount < 1) {  // 仍未找到店家
      /*
      reg = /,+| +|;+|:+|，+|　+|；+|：+$/;
      while(true) {
        let old_length = query_str.length;
        query_str = query_str.replace(reg,'').trim();  // 移除字串末尾的分隔字元
        if (query_str.length == old_length) break;
      }
      */
      
      reg = /(,| |;|:|，|　|；|：)*$/;
      query_str = query_str.replace(reg,'').trim();  // 移除字串末尾的分隔字元
      console.log(query_str+"$");

      extra_obj.result_obj = search_shop(shop_data, query_str, fuzzy, max_num);
    }
  }
  
  return extra_obj;
}

// 搜尋末尾的額外數字 (叫號機)
function extra_search_caller(callers, query_str) {
  let extra_obj = {};

  //let reg = /\d+$/;
  let reg = /(No|No.| |　)*\d+( |　|號|号)*$/;
  let arr = query_str.match(reg); // 尋找字串末尾的數字
  if (arr != null) {
    extra_obj.extra_number = arr[0].match(/\d+/);
    query_str = query_str.replace(reg,'').trim();  // 移除字串末尾的數字
    //console.log(query_str);
    
    // 搜尋叫號機 id
    extra_obj.caller_id = "";
    for (let id in callers) {
      if (callers[id] == query_str) {
        extra_obj.caller_id = id;
        break;
      }
    }
    
    if (extra_obj.caller_id == "") {  // 仍未找到叫號機
      /*
      reg = /,+| +|;+|:+|，+|　+|；+|：+$/;
      while(true) {
        let old_length = query_str.length;
        query_str = query_str.replace(reg,'').trim();  // 移除字串末尾的分隔字元
        if (query_str.length == old_length) break;
      }
      */

      reg = /(,| |;|:|，|　|；|：)*$/;
      query_str = query_str.replace(reg,'').trim();  // 移除字串末尾的分隔字元
      console.log(query_str+"$");

      for (let id in callers) {
        if (callers[id] == query_str) {
          extra_obj.caller_id = id;
          break;
        }
      }
    }
    
    // 最終搜尋字串即為 caller_name
    extra_obj.caller_name = query_str;    
  }
  
  return extra_obj;
}

function get_caller_list(callers, caller_id_arr, caller_name_arr) {
  for (let caller_id in callers) {
    let caller_name = callers[caller_id];
    
    if (caller_name != "") {
      caller_id_arr.push(caller_id);
      caller_name_arr.push(caller_name);

      /*
      // 取得 c_shop_id, c_room_id
      let split_arr = caller_id.split('-');
      let c_shop_id = split_arr[0];
      let c_room_id = split_arr[1];
      
      // 取得 caller 資訊.
      let curr_num = "0";
      let last_update = "0";
      let caller_snapshot = await shopCallerDB.ref(c_shop_id).once('value');
      if (caller_snapshot.exists()) {
        let caller_data = caller_snapshot.val();
        curr_num = caller_data.call_nums[c_room_id];
        last_update = caller_data.last_update;
      }
      
      // 判斷是否休診中
      let rest_str = (last_update==10 || last_update==-1)? " 休診中":"";

      caller_id_arr.push(caller_id);
      caller_name_arr.push(`${caller_name}  (${curr_num}號${rest_str})`);
      */
    }
    else {
      caller_id_arr.push(caller_id);
      caller_name_arr.push("(無名稱)-"+caller_id);
    }
  }
}

async function main() {
    let rawDataLineConfig = await fs.readFile('./data/lineConfig.json', 'utf8');
    let config = JSON.parse(rawDataLineConfig);

    let line_client = new line.Client(config);

    let rawDataFirebaseKey = await fs.readFile('./data/callme-398802-firebase-adminsdk-ssdcq-ea20cbbfd7.json', 'utf8');
    let serviceAccountKey = JSON.parse(rawDataFirebaseKey);

    let webhookEventsApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        databaseURL: 'https://webhook-events-callme-398802.asia-southeast1.firebasedatabase.app'
    }, 'webhookEventsApp');

    let lineUserMsgApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        databaseURL: 'https://line-user-msg-callme-398802.asia-southeast1.firebasedatabase.app'
    }, 'lineUserMsgApp');

    let shopListApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountKey),
        databaseURL: 'https://shop-list-callme-398802.asia-southeast1.firebasedatabase.app'
    }, 'shopListApp');
  
    let shopCallerApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      databaseURL: 'https://shop-caller-callme-398802.asia-southeast1.firebasedatabase.app/'
    }, 'shopCallerApp');

    let userEventApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountKey),
      databaseURL: 'https://user-event-callme-398802.asia-southeast1.firebasedatabase.app/'
    }, 'userEventApp');

    let webhookEventsDB = webhookEventsApp.database();
    let lineUserMsgDB = lineUserMsgApp.database();
    // let lineEventQueueDB = lineEventQueueApp.database();
    let shopListDB = shopListApp.database();
    let shopCallerDB = shopCallerApp.database();
    let userEventDB = userEventApp.database();

    // 讀取店家資料
    let shop_file = await fs.readFile('../common_data/shop_data.json', 'utf8');
    let shopData = await JSON.parse(shop_file);
    console.log('shop count:', Object.keys(shopData).length);

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
    }

    /*
    // 讀取店家資料
    let shopData = null;
    await shopListDB.ref('/').once('value', (snapshot) => {
      if (snapshot.exists()) {
        shopData = snapshot.val();
        //console.log('[firebase] Shop:', shopData);
      } else {
        console.log('[firebase] Shop: no data');
      }
    }, (errorObject) => {
      console.log('[firebase] Shop: read failed: ' + errorObject.name);
    });
    
    // 即時更新店家資料
    shopListDB.ref('/').on('value', (snapshot) => {
      if (snapshot.exists()) {
        shopData = snapshot.val();
      } else {
        console.log('[firebase] Shop: no data');
      }
    }, (errorObject) => {
      console.log('[firebase] Shop: read failed: ' + errorObject.name);
    });
    */

    // let webhookEventsRef = webhookEventsApp.ref("webhookEvents"); // 這將會創建一個名為 "webhookEvents" 的節點

    // // 監聽資料變化
    // webhookEventsRef.on('value', (snapshot) => {
    //     // console.log('Data changed:', snapshot.val());
    // });

    // // 監聽子節點新增
    // webhookEventsRef.on('child_added', (snapshot) => {
    //     // console.log('Child added:', snapshot.key, snapshot.val());
    // });

    async function handleEvent(event) {
        let event_type = event.type;
        let event_message = event.message;
        let event_postback = event.postback;
        let replyToken = event.replyToken;
        let user_id = (event.source)? event.source.userId:null;
        let userMsg="";
        let msgType="";
        let post_msg={}; 
        let replyMsgs = [];

        // 回覆請選擇叫號機
        async function reply_select_caller(shop_id, adv_number_str) {
          let shop_data = shopData;

          if (shop_id in shop_data) {
            let shop_name = shop_data[shop_id].name;
            if ('callers' in shop_data[shop_id]) {
              let callers = shop_data[shop_id].callers;

              // 取得叫號機列表
              let caller_id_arr = [];
              let caller_name_arr = [];
              get_caller_list(callers, caller_id_arr, caller_name_arr);
              
              if (caller_id_arr.length != 0) {
                // 更新 focusCaller
                let focus_caller = {};
                focus_caller["shop_id"] = shop_id;
                focus_caller["caller_id"] = "";
                // 若 adv_number_str 有值，則進行儲存，待使用者選完叫號機後繼續進行
                if (adv_number_str != "") focus_caller["adv_number_str"] = adv_number_str;
                let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                await userRef.child('focusCaller').set(focus_caller);

                // 請使用者選擇叫號機
                //console.log(JSON.stringify(reply_msg.select_caller(shop_id,shop_name,caller_id_arr,caller_name_arr,20)));    
                replyMsgs.push(reply_msg.select_caller(shop_id,shop_name,caller_id_arr,caller_name_arr,20));
              }
              else {
                replyMsgs.push({
                  type: 'text',
                  text: `沒有叫號機資料...`
                });
              }
            }
            else {
              replyMsgs.push({
                type: 'text',
                text: `系統錯誤，叫號機資料不存在...`
              });
            }
          }
          else {
            replyMsgs.push({
                type: 'text',
                text: `查無此店家...(店家代碼：${shop_id})`
            });                        
          }
          
          return Promise.resolve(null);
        }

        // 儲存及回覆訊息
        async function save_and_reply(shop_id, caller_id, input_num) {
          // let b_success = false;
          let shop_data = shopData;
          
          if (shop_id in shop_data) {
            // 取得店家資訊
            let shop_name = shop_data[shop_id].name;
            if ('callers' in shop_data[shop_id]) {
              let callers = shop_data[shop_id].callers;
              
              if (caller_id in callers) {
                if (input_num == "") {  // 若有輸入號碼，表示設定通知號碼，不需更新 focusCaller
                  // 更新 focusCaller
                  let focus_caller = {};
                  focus_caller['shop_id'] = shop_id;
                  focus_caller['caller_id'] = caller_id;
                  let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                  await userRef.child('focusCaller').set(focus_caller);
                }

                // 若是多叫號機，要取得叫號機名稱                          
                let b_multi_caller = shop_data[shop_id].isMultiCaller;
                let caller_name = "";
                if (b_multi_caller) {
                  caller_name = callers[caller_id];
                  if (caller_name == "") caller_name = "(無名稱)-"+caller_id;
                }                            
                
                // 取得 c_shop_id, c_room_id
                let split_arr = caller_id.split('-');
                let c_shop_id = split_arr[0];
                let c_room_id = split_arr[1];
                
                // 取得 caller 資訊.
                let curr_num = "0";
                let prev_num = "";
                let change_time = "0秒前";
                let update_time = "0秒前";
                let last_update = "0";
                let caller_snapshot = await shopCallerDB.ref(c_shop_id).once('value');
                if (caller_snapshot.exists()) {
                  let caller_data = caller_snapshot.val();
                  curr_num = caller_data.call_nums[c_room_id];
                  prev_num = caller_data.prev_nums[c_room_id];
                  change_time = relative_time(Math.floor((Date.now()-caller_data.change_times[c_room_id])/1000));
                  update_time = relative_time(Math.floor((Date.now()-caller_data.update_time)/1000));
                  last_update = caller_data.last_update;
                }
                
                let user_num = "";
                let notify_num = "";
                // 有使用者輸入號碼
                if (input_num != "") {  
                  user_num = input_num;
                  notify_num = input_num;
                  // 通知號碼大於當前號碼，進行儲存
                  if (notify_num > curr_num) {
                    let userEventRef = userEventDB.ref(`${c_shop_id}/${c_room_id}/${user_id}`);
                    await userEventRef.set({
                        "user_num": user_num,
                        "notify_num": notify_num,
                        "notified": false,
                        "timestamp": admin.database.ServerValue.TIMESTAMP
                    }); 
                  }
                  else {  // 已到號或已過號，刪除記錄
                    console.log("58");
                    let userEventRef = userEventDB.ref(`${c_shop_id}/${c_room_id}/${user_id}`);
                    userEventRef.remove();
                  }
                }
                else {  // 無使用者輸入號碼，需從資料庫取得 user_num, notify_num
                  let event_snapshot = await userEventDB.ref(`${c_shop_id}/${c_room_id}/${user_id}`).once('value');
                  if (event_snapshot.exists()) {
                    let event_data = event_snapshot.val();
                    user_num = event_data['user_num'];
                    notify_num = event_data['notify_num'];
                  }
                }
                
                // 已設定叫號，顯示叫號機資訊，及通知號碼(或到號/過號訊息)
                if (notify_num != "") {
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, caller_name, curr_num, prev_num, change_time, update_time, last_update, user_num, notify_num));
                }
                else {  // 尚未設定叫號，只顯示叫號機資訊
                  replyMsgs.push(reply_msg.caller_info(shop_id, caller_id, shop_name, caller_name, curr_num, prev_num, change_time, update_time, last_update));
                  replyMsgs.push({
                    type: 'text',
                    //text: `請輸入你的號碼...`
                    text: `到幾號要叫你呢？`
                  });
                }
              }
              else {
                replyMsgs.push({
                    type: 'text',
                    text: `查無此叫號機...(叫號機代碼：${caller_id})`
                });                        
              }
            }
            else {
              replyMsgs.push({
                type: 'text',
                text: `系統錯誤，叫號機資料不存在...`
              });
            }
          }
          else {
            replyMsgs.push({
                type: 'text',
                text: `查無此店家...(店家代碼：${shop_id})`
            });                        
          }
          
          /*
          b_success = true;
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              b_success? resolve(true):reject(false);
            }, 1000);
          });
          */
          
          return Promise.resolve(null);
        }
        
        // 沒有 user_id，無法進行處理
        if (user_id==null || user_id=="") return Promise.resolve(null);
       
        // 只處理 postback 事件，或 text 類型的 message 事件 
        if (event_type=='postback' || (event_type=='message' && event_message.type=='text')) {

            if (event_type=='postback') {
              userMsg = event_postback.data.trim();
              console.log(userMsg);

              post_msg = querystring.parse(userMsg);
              post_msg = JSON.parse(JSON.stringify(post_msg));
              if ('action' in post_msg) { // postback 有 action 參數，則 msgType = 'action'
                console.log(post_msg);
                console.log("1");
                msgType = 'action';
              }
            }
            else {
              userMsg = event_message.text.trim();
              /*
              if (userMsg.includes(";")) {    // 掃描 QR-Code (含叫號機)
                msgType = 'action';
                post_msg.action = '搜尋叫號機';
                let split_arr = userMsg.split(';');
                post_msg.shop_name = split_arr[0];
                post_msg.caller_name = split_arr[1];
              }
              */
              
              let sep_pos = userMsg.indexOf(";;");
              if (sep_pos != -1) { // 有找到 ";;"
                // 確認只有兩個分號(;), 且 ";;" 右側不是數字 (排除 extra_number 的可能性)
                if (userMsg.length>sep_pos && userMsg.substr(sep_pos+2,1)!=";" && !(/^\d+$/.test(userMsg.substr(sep_pos+2).trim()))) {
                  // 確定為掃描 QR-Code (含叫號機)
                  msgType = 'action';
                  post_msg.action = '搜尋叫號機';
                  post_msg.shop_name = userMsg.substr(0,sep_pos).trim();
                  let caller_msg = userMsg.substr(sep_pos+2).trim();
                  // 判斷 caller_msg 是否為 caller_id
                  let msg_arr = caller_msg.split('-');
                  if (msg_arr.length==2 && isNum(msg_arr[0]) && isNum(msg_arr[1])){
                    post_msg.caller_id = caller_msg;
                    post_msg.caller_name = "";
                  }
                  else {
                    post_msg.caller_id = "";
                    post_msg.caller_name = caller_msg;
                  }
                }
              }              
            }
            // 儲存原始 userMsg
            let origin_userMsg = userMsg;

            if (msgType != 'action') {
              // 檢查使用者的輸入是否為數字(可為 No.32 No32 32號 32号等形式)
              //if (/^\d+$/.test(userMsg)) {
              let reg = /^(No|No.| |　)*\d+( |　|號|号)*$/;
              if (reg.test(userMsg)) { 
                  msgType = 'number';
                  reg = /\d+/;
                  userMsg = userMsg.match(reg)[0];
              } else {
                  msgType = 'text';
              }
            }
            // 儲存原始 msgType
            let origin_msgType = msgType;

            let b_adv_search = false; // 是否需要進階搜尋
            let adv_obj_s = {};       // 進階搜尋店家的結果
            let adv_caller_str = "";  // 進階搜尋的 caller 搜尋字串
            let adv_number_str = "";  // 進階搜尋的 number 搜尋字串
            let b_done = false;
            while (!b_done) {
              b_done = true;
              switch (msgType) {
                  case 'text':
                      console.log("20");
                      let shop_data = shopData;
                      let result_obj;
                      let resultCount;
                      
                      // postback event, 此為使用者選擇店家之結果，故使用精確搜尋
                      if (event_type=='postback') {
                        console.log("21");
                        result_obj = search_shop(shop_data, userMsg, false, 1);   // 精確搜尋
                        resultCount = Object.keys(result_obj).length;
                        
                        // 讀取資料庫，查看是否有待處理的進階搜尋(adv_caller_str)
                        let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                        let focus_snapshot = await userRef.child('focusCaller').once('value');
                        if (focus_snapshot.exists()) {
                          let focus_caller = focus_snapshot.val();
                          if (('adv_caller_str' in focus_caller) && focus_caller.adv_caller_str!="") {
                            adv_caller_str = focus_caller.adv_caller_str;
                            b_adv_search = true;
                          }
                        }
                      }
                      else {  // 此為"使用者"輸入字串搜尋，故使用模糊搜尋
                        console.log("22");
                        result_obj = search_shop(shop_data, userMsg, true, 10);    // 模糊搜尋
                        resultCount = Object.keys(result_obj).length;

                        // 未找到店家，檢查輸入字串末尾是否有"額外數字"
                        if (resultCount < 1) {
                          let extra_obj = extra_search_shop(shop_data, userMsg, true, 10);
                          if (Object.keys(extra_obj).length != 0) {
                            let extra_number = extra_obj.extra_number;
                            result_obj = extra_obj.result_obj;
                            resultCount = Object.keys(result_obj).length;
                            if (resultCount == 1) {   // 找到單一店家
                              let shop_id = Object.keys(result_obj)[0];
                              if (!shopData[shop_id].isMultiCaller) {   // 單一叫號機
                                let callers = shopData[shop_id].callers;
                                let caller_id = Object.keys(callers)[0];

                                // 更新 focusCaller
                                let focus_caller = {};
                                focus_caller["shop_id"] = shop_id;
                                focus_caller["caller_id"] = caller_id;
                                let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                                await userRef.child('focusCaller').set(focus_caller);
                              
                                // 進行額外事件 
                                msgType = 'number';
                                userMsg = extra_number;
                                b_done = false;
                                break;  // 離開 switch case
                              }
                              else b_adv_search = true; // 多個叫號機, 改用進階店家搜尋
                            }
                            else b_adv_search = true; // 找到多個店家, 改用進階店家搜尋
                          }
                          else b_adv_search = true; // 未找到店家, 改用進階店家搜尋
                        }
                      }
                      
                      // 未找到店家，改用進階店家搜尋 (或有待處理的進階搜尋)
                      if (b_adv_search) {
                        //if (user_id=="U95547b7b9b1226f08563825c7f8db533") {
                          // 有待處理的進階搜尋(adv_caller_str)
                          if (adv_caller_str != "") {
                            adv_obj_s.result_obj = result_obj;
                            adv_obj_s.adv_caller_str = adv_caller_str;
                          }
                          else {
                            adv_obj_s = adv_search_shop(shop_data, userMsg, true, 10);
                          }
                          
                          if (Object.keys(adv_obj_s).length != 0) {   // 有找到店家
                            console.log("70");
                            adv_caller_str = adv_obj_s.adv_caller_str;
                            result_obj = adv_obj_s.result_obj;
                            resultCount = Object.keys(result_obj).length;
                            if (resultCount > 1) {  // 找到多個店家，將 adv_caller_str 儲存到資料庫，待使用者選完店家後繼續進行
                              // 儲存 adv_caller_str, 請見以下 "多個店家" 的程式碼
                            }
                            else if (resultCount == 1) { // 找到單一店家
                              console.log("72");
                              let shop_id = Object.keys(result_obj)[0];
                              let caller_id = "";
                              
                              // 若有多個叫號機，使用 adv_caller_str 繼續搜尋
                              if (shopData[shop_id].isMultiCaller) {
                                console.log("73");
                                let callers = shopData[shop_id].callers;
                                // 進階搜尋店家的結果 adv_obj_c
                                let adv_obj_c = adv_search_caller(callers, adv_caller_str);
                                if (Object.keys(adv_obj_c).length != 0) {   // 有找到叫號機
                                  console.log("74");
                                  adv_number_str = adv_obj_c.adv_number_str;
                                  let result_obj_c = adv_obj_c.result_obj;
                                  let resultCount_c = Object.keys(result_obj_c).length;
                                  if (resultCount_c == 1) {  // 找到單一叫號機
                                    console.log("76");
                                    caller_id = Object.keys(result_obj_c)[0];
                                  }
                                  else {  // 找到多個叫號機，將 adv_number_str 儲存到資料庫，待使用者選完叫號機後繼續進行
                                    // 儲存 adv_number_str, 請見以下 "多個叫號機" 的程式碼
                                  }
                                }
                                else {  // 未找到叫號機，將 adv_number_str 儲存到資料庫，待使用者選完叫號機後繼續進行
                                  // 儲存 adv_number_str, 請見以下 "多個叫號機" 的程式碼
                                  adv_number_str = adv_caller_str;
                                }
                              }
                              else {  // 單一叫號機
                                console.log("77");
                                adv_number_str = adv_caller_str;
                                let callers = shopData[shop_id].callers;
                                caller_id = Object.keys(callers)[0];
                              }
                              
                              // 已確定叫號機，可繼續進行末尾數字搜尋
                              if (caller_id != "") {
                                console.log("78");
                                // 尋找字串末尾的數字 
                                let reg = /(No|No.| |　)*\d+( |　|號|号)*$/;
                                let arr = adv_number_str.match(reg);
                                if (arr != null) {  // 有找到數字，直接跳到 "叫號設定" 的事件
                                  let match_str = arr[0];
                                  let match_number = match_str.match(/\d+/)[0];

                                  // 更新 focusCaller
                                  let focus_caller = {};
                                  focus_caller["shop_id"] = shop_id;
                                  focus_caller["caller_id"] = caller_id;
                                  let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                                  await userRef.child('focusCaller').set(focus_caller);
                                
                                  // 進行額外事件 
                                  msgType = 'number';
                                  userMsg = match_number;
                                  b_done = false;
                                  break;  // 離開 switch case
                                }
                                else {  // 沒找到數字，直接跳到 '選取叫號機' 的事件
                                  console.log("79");
                                  msgType = 'action';
                                  post_msg.action = '選取叫號機';
                                  post_msg.shop_id = shop_id;
                                  post_msg.caller_id = caller_id;
                                  b_done = false;
                                  break;  // 離開 switch case
                                }                                
                              }
                            }
                          }
                        //}
                      }
                      
                      if (resultCount > 1) {    // 找到多個店家
                          // 將 adv_caller_str 儲存到資料庫，待使用者選完店家後繼續進行
                          console.log("71");
                          if (adv_caller_str != "") {
                            let focus_caller = {};
                            focus_caller["shop_id"] = "";
                            focus_caller["caller_id"] = "";
                            focus_caller["adv_caller_str"] = adv_caller_str;
                            let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                            await userRef.child('focusCaller').set(focus_caller);
                          }
                          
                          // 請使用者選擇店家
                          console.log("23");
                          let shop_arr = [];
                          for (let shop_id in result_obj) {
                            let shop_name = result_obj[shop_id];
                            shop_arr.push(shop_name);
                          }                        
                          replyMsgs.push(reply_msg.select_shop(shop_arr,10));
                      }
                      else if (resultCount == 1) {  // 找到單一店家
                          console.log("24");

                          // 取得店家資訊
                          let shop_id = Object.keys(result_obj)[0];

                          // 取得叫號機資訊
                          console.log("30");
                          let callers = shopData[shop_id].callers;
                          let b_multi_caller = shopData[shop_id].isMultiCaller;
                          // 多個叫號機
                          if (b_multi_caller) {   
                            console.log("31");
                            // 回覆請選擇叫號機
                            await reply_select_caller(shop_id, adv_number_str);
                          }
                          else {  // 單一叫號機
                            console.log("39");
                            let caller_id = Object.keys(callers)[0];
                            // 儲存及回覆訊息
                            await save_and_reply(shop_id, caller_id, "");
                          }
                      }
                      else {
                          console.log("27");
                          replyMsgs.push({
                            type: 'text',
                            text: `沒找到 ${userMsg}，要搜尋店家，請輸入部分名稱...`
                          });
                      }
                      break;
                  case 'number':
                      console.log("50");
                      let user_num = userMsg-0;
                      let notify_num = userMsg-0;                        
                      // 無效的號碼
                      if (notify_num>999 || notify_num<0) {
                        replyMsgs.push({
                            type: 'text',
                            text: `😩`
                        });
                        break;
                      }

                      console.log("51");
                      let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                      let focus_snapshot = await userRef.child('focusCaller').once('value');
                      if (!focus_snapshot.exists()) {
                        replyMsgs.push({
                            type: 'text',
                            text: `請先搜尋店家(輸入部分名稱)...`
                        });                        
                      }
                      else {
                        console.log("52");
                        // 取得 focus caller 資訊.
                        let focus_caller = focus_snapshot.val();
                        let shop_id = focus_caller.shop_id;
                        let caller_id = focus_caller.caller_id;

                        if (shop_id=="") {
                          replyMsgs.push({
                              type: 'text',
                              text: `請先搜尋店家(輸入部分名稱)...`
                          });                        
                        }
                        else {
                          // 已選擇叫號機 (或單一叫號機)
                          if (caller_id != "") {  
                            console.log("53");
                            // 儲存及回覆訊息
                            await save_and_reply(shop_id, caller_id, notify_num);
                          }
                          else {  // 尚未選擇叫號機
                            console.log("54");
                            // 請先選擇叫號機
                            replyMsgs.push({
                                type: 'text',
                                text: `請先選擇叫號機...`
                            });                        
                            // 回覆請選擇叫號機
                            await reply_select_caller(shop_id, "");
                          }
                        }
                      }
                      break;
                  case 'action':
                      console.log("2");
                      
                      // 若為舊版本，顯示版本不符
                      if ('room_id' in post_msg) {
                        replyMsgs.push({
                          type: 'text',
                          text: `版本不符...`
                        });
                        break;
                      }
                      
                      let action = post_msg.action;
                      if (action == '叫號查詢') {
                        console.log("3");
                        let shop_id = post_msg.shop_id;
                        let caller_id = post_msg.caller_id;
                        // 儲存及回覆訊息
                        await save_and_reply(shop_id, caller_id, "");
                      }
                      else if (action == '取消通知') {
                        console.log("11");
                        let shop_id = post_msg.shop_id;
                        let caller_id = post_msg.caller_id;

                        if (shop_id in shopData) {
                          // 取得店家資訊
                          console.log("12");
                          let shop_name = shopData[shop_id].name;
                          let callers = shopData[shop_id].callers;
                          
                          // 若是多叫號機，要取得叫號機名稱                          
                          let b_multi_caller = shopData[shop_id].isMultiCaller;
                          //let caller_name = (b_multi_caller)? callers[caller_id]:"";
                          let caller_name = "";
                          if (b_multi_caller) {
                            caller_name = callers[caller_id];
                            if (caller_name == "") caller_name = "(無名稱)-"+caller_id;
                          }                            
                          
                          // 取得 c_shop_id, c_room_id
                          let split_arr = caller_id.split('-');
                          let c_shop_id = split_arr[0];
                          let c_room_id = split_arr[1];
                        
                          // 取消通知
                          let event_snapshot = await userEventDB.ref(`${c_shop_id}/${c_room_id}/${user_id}`).once('value');
                          if (event_snapshot.exists()) {
                            console.log("13");
                            await userEventDB.ref(`${c_shop_id}/${c_room_id}`).child(`${user_id}`).remove();
                            let target = (caller_name=="")? shop_name:(shop_name+" "+caller_name);
                            replyMsgs.push({
                                type: 'text',
                                text: `${target} 已取消通知!!`
                            });                        
                          }
                          else {
                            console.log("14");
                            let target = (caller_name=="")? shop_name:(shop_name+" "+caller_name);
                            replyMsgs.push({
                                type: 'text',
                                text: `${target} 尚未設定叫號...`
                            });                        
                          }
                        }
                        else {
                          replyMsgs.push({
                              type: 'text',
                              text: `查無此店家...(店家代碼：${shop_id})`
                          });                        
                        }
                      }
                      else if (action == '選取叫號機') {   //點選 叫號機 列表
                        console.log("40");
                        let shop_id = post_msg.shop_id;
                        let caller_id = post_msg.caller_id;

                        // 讀取資料庫，查看是否有待處理的進階搜尋(adv_number_str)
                        let adv_number_str = "";
                        let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                        let focus_snapshot = await userRef.child('focusCaller').once('value');
                        if (focus_snapshot.exists()) {
                          let focus_caller = focus_snapshot.val();
                          if ('adv_number_str' in focus_caller) {
                            if (shop_id==focus_caller.shop_id && focus_caller.adv_number_str!="") {
                              adv_number_str = focus_caller.adv_number_str;
                            }
                          }
                        }
                        
                        // 若有待處理的進階搜尋(adv_number_str)
                        if (adv_number_str != "") {
                          // 尋找字串末尾的數字 
                          let reg = /(No|No.| |　)*\d+( |　|號|号)*$/;
                          let arr = adv_number_str.match(reg);
                          if (arr != null) {  // 有找到數字，直接跳到 "叫號設定" 的事件
                            let match_str = arr[0];
                            let match_number = match_str.match(/\d+/)[0];

                            // 更新 focusCaller
                            let focus_caller = {};
                            focus_caller["shop_id"] = shop_id;
                            focus_caller["caller_id"] = caller_id;
                            let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                            await userRef.child('focusCaller').set(focus_caller);
                          
                            // 進行額外事件 
                            msgType = 'number';
                            userMsg = match_number;
                            b_done = false;
                            break;  // 離開 switch case
                          }
                        }
                        
                        // 儲存及回覆訊息
                        await save_and_reply(shop_id, caller_id, "");
                      }
                      else if (action == '搜尋叫號機') {   //掃描 QR-Code (含叫號機)
                        console.log("44");
                        let p_shop_name = post_msg.shop_name;
                        let caller_id = post_msg.caller_id;                          
                        let caller_name = post_msg.caller_name;
                        
                        // 搜尋店家
                        let shop_data = shopData;
                        let result_obj = search_shop(shop_data, p_shop_name, true, 10);   // 模糊搜尋
                        let resultCount = Object.keys(result_obj).length;

                        // 未找到單一店家，使用 msgType = 'text' 重新搜尋
                        if (resultCount != 1) {  
                          // 進行額外事件
                          msgType = 'text';
                          userMsg = p_shop_name+";"+caller_name;
                          b_done = false;
                          break;  // 離開 switch case
                        }
                        else {  // 搜尋叫號機
                          // 取得店家資訊
                          console.log("45");
                          let shop_id = Object.keys(result_obj)[0];
                          let shop_name = Object.values(result_obj)[0];

                          let callers = shopData[shop_id].callers;
                          let b_multi_caller = shopData[shop_id].isMultiCaller;

                          let b_found = true; // 是否找到 叫號機
                          
                          if (!b_multi_caller) {  // 單一叫號機
                            caller_id = Object.keys(callers)[0];
                            caller_name = ""; // 單一叫號機, 不顯示叫號機名稱
                          }
                          else {
                            // 如果 QR-Code 訊息為 caller_name, 搜尋 caller_id
                            if (caller_id == "") {
                              // 搜尋叫號機 id
                              for (let id in callers) {
                                if (callers[id] == caller_name) {
                                  caller_id = id;
                                  break;
                                }
                              }
                              
                              // 未找到叫號機，檢查輸入字串末尾是否有"額外數字"
                              if (caller_id == "") {
                                let extra_obj = extra_search_caller(callers, caller_name);
                                if (Object.keys(extra_obj).length != 0) {
                                  let extra_number = extra_obj.extra_number;
                                  caller_id = extra_obj.caller_id;
                                  caller_name = extra_obj.caller_name;

                                  // 仍未找到叫號機，使用 msgType = 'text' 重新搜尋
                                  if (caller_id == "") {  
                                    // 進行額外事件
                                    msgType = 'text';
                                    userMsg = p_shop_name+";"+caller_name+extra_number;
                                    console.log(userMsg);
                                    b_done = false;
                                    break;  // 離開 switch case
                                  }
                                  else {  // 有找到叫號機，接著設定額外號碼
                                    // 更新 focusCaller
                                    let focus_caller = {};
                                    focus_caller["shop_id"] = shop_id;
                                    focus_caller["caller_id"] = caller_id;
                                    let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                                    await userRef.child('focusCaller').set(focus_caller);
                                
                                    // 進行額外事件 
                                    msgType = 'number';
                                    userMsg = extra_number;
                                    b_done = false;
                                    break;  // 離開 switch case
                                  }
                                }
                              }
                              
                              // 仍未找到叫號機，使用 msgType = 'text' 重新搜尋
                              if (caller_id == "") {  
                                // 進行額外事件
                                msgType = 'text';
                                userMsg = p_shop_name+";"+caller_name;
                                console.log(userMsg);
                                b_done = false;
                                break;  // 離開 switch case
                              }
                            }
                            else {  // 如果 QR-Code 訊息為 caller_id, 搜尋 caller_name
                              if (caller_id in callers) {
                                // 取得叫號機名稱
                                caller_name = callers[caller_id];
                              }
                              else {  // 未找到叫號機
                                b_found = false;
                              }
                            }
                          }
                          
                          if (b_found) {
                            console.log("47");
                            // 儲存及回覆訊息
                            await save_and_reply(shop_id, caller_id, "");
                          }
                          else {
                            console.log("48");
                            // 回覆請選擇叫號機
                            await reply_select_caller(shop_id, "");
                          }
                        }
                      }
                      else if (action == '換叫號機') {
                        let shop_id = post_msg.shop_id;
                        // 回覆請選擇叫號機
                        await reply_select_caller(shop_id, "");
                      }                      
                      break;
                  default:
                      break;
              }
            }

            // 將使用者的訊息保存到 lineUserMsgDB
            console.log("7");
            let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
            let msgQueueSnapshot = await userRef.child('msgQueue').once('value');
            let msgQueue = msgQueueSnapshot.val();

            console.log("8");
            // 如果 msgQueue 中已經有 10 條訊息，則刪除最早的一條
            if (msgQueue && Object.keys(msgQueue).length >= 10) {
                let oldestKey = Object.keys(msgQueue)[0];
                await userRef.child(`msgQueue/${oldestKey}`).remove();
            }

            console.log("9");
            await userRef.child('msgQueue').push({
                request: {
                    message: origin_userMsg,
                    type: origin_msgType,
                    timestamp: admin.database.ServerValue.TIMESTAMP
                },
                response: {
                    message: (replyMsgs.length > 0)? replyMsgs:"",
                    timestamp: admin.database.ServerValue.TIMESTAMP
                }
            });

            // 回覆訊息
            console.log("10");
            //console.log(replyMsgs);
            if (replyMsgs.length > 0) return line_client.replyMessage(replyToken, replyMsgs);
            else return Promise.resolve(null);
        } else {
            return Promise.resolve(null);
        }
    }

    // (未採用) for line liff
    async function reply_qr_code(user_id, shop_name, caller_name) {
      // 沒有 user_id，無法進行處理
      if (user_id==null || user_id=="") return;

      console.log("60");
      let notify_Msgs = [];

      // 搜尋店家
      let shop_data = shopData;
      let result_obj = search_shop(shop_data, shop_name, false, 1);   // 精確搜尋
      let resultCount = Object.keys(result_obj).length;

      if (resultCount < 1) {  // 未找到店家
        notify_Msgs.push({
          type: 'text',
          text: `沒找到 ${shop_name}，請再確認一下...`
        });
      }
      else {
        // 取得店家資訊
        console.log("61");
        let shop_id = Object.keys(result_obj)[0];
        let callers = shop_data[shop_id].callers;
        let b_multi_caller = shop_data[shop_id].isMultiCaller;
        let caller_id = "";

        if (caller_name=="") {  // QR-Code 只包含店家名稱
          if (b_multi_caller) {   // 多個叫號機
            console.log("62");
            // 回覆請選擇叫號機
            await reply_select_caller(shop_id, "");
          }
          else {   // 單一叫號機
            console.log("63");
            caller_id = Object.keys(callers)[0];
            // 儲存及回覆訊息
            await save_and_reply(shop_id, caller_id, "");
          }
        }          
        else {  // QR-Code 包含 店家名稱 及 叫號機名稱
          console.log("64");
          // 搜尋叫號機
          for (let id in callers) {
            if (callers[id] == caller_name) {
              caller_id = id;
              break;
            }
          }
          
          if (caller_id == "") {  // 未找到叫號機
            notify_Msgs.push({
              type: 'text',
              text: `沒找到叫號機 ${caller_name}，請再確認一下...`
            });
          }
          else {  // 有找到叫號機
            console.log("65");
            // 儲存及回覆訊息
            await save_and_reply(shop_id, caller_id, "");
          }
        }
      }
      
      // 送出訊息
      if (notify_Msgs.length > 0) line_client.pushMessage(user_id, notify_Msgs);
    }

    let app = express();

    // app.post('/webhook', line.middleware(config), (req, res) => {
    //     Promise
    //         .all(req.body.events.map(handleEvent))
    //         .then((result) => res.json(result))
    //         .catch((err) => {
    //             console.error(err);
    //             res.status(500).end();
    //         });
    // });

/*
    app.post('/webhook', line.middleware(config), async (req, res) => {
        try {
            // 取得今天日期
            let date_obj = new Date();
            let timestamp = date_obj.getTime();
            let year = date_obj.getFullYear();
            let month = ("00"+(date_obj.getMonth()+1)).substr(-2);
            let day = ("00"+date_obj.getDate()).substr(-2);
            
            // 處理事件 (例如回覆訊息)
            await Promise.all(req.body.events.map(handleEvent));

            // 將 webhook 資料存入 Firebase
            for (let event of req.body.events) {
                if (event.webhookEventId) { // 確保 eventId 存在
                    //let eventRef = webhookEventsDB.ref(`webhookEvents/${event.webhookEventId}`);
                    let eventRef = webhookEventsDB.ref(`/${year}${month}${day}/${event.webhookEventId}`);
                    await eventRef.set(event);
                }
            }

            res.json({ success: true });
        } catch (err) {
            console.error(err.red);
            res.status(500).end();
        }
    });
*/

    app.get('/status', (req, res) => {
        res.send('Server is running');
    });

    // (未採用) 圖文選單 "搜尋店家" 
    app.get('/shops', (req, res) => {
        res.sendFile(path.join(__dirname, '/data/shops.html'));
    });

/*
    // (未採用) for line liff 
    app.get('/search', async (req, res) => {
      console.log(req.query);
      
      let user_id = req.query.user_id;
      let shop_name = req.query.shop_name;
      let caller_name = req.query.caller_name;
      
      await reply_qr_code(user_id, shop_name, caller_name);      
            
      res.redirect('https://line.me/R/oaMessage/@callmeback');
    });
*/
    
    app.listen(6000, () => {
        console.log('Listening on port 6000');
    });
}

main();


// let message1 = {
//     type: 'text',
//     text: '這是一個傳送廣播的訊息'
// };

// line_client.broadcast(message1)
//     .then(() => {
//         console.log('Broadcast message was sent successfully.');
//     })
//     .catch((err) => {
//         console.error('Failed to send broadcast message:', err);
//     });


// let userId = 'U24d1247f009c10eca6f5e43528d21fee'; // 小cow
// // let userId = 'U4ff89af2e41ae0e61f24725ad18d8407'; // Seal
// // let userId = 'U64f9d58abe88e55f7fbc237d0e729dc0'; // 王ivy
// // let userId = 'Ufcfced248b19df7602a5b5184ff37966'; // Wilson
// // let userId = 'U2000345be58fc017dd6a55b35e07f797';

// let message2 = {
//     type: 'text',
//     text: '這是一個傳送給指定 USER 的訊息'
// };

// line_client.pushMessage(userId, message2)
//     .then(() => {
//         console.log('Message was sent successfully.');
//     })
//     .catch((err) => {
//         console.error('Failed to send message:', err);
//     });


// let userIds = ['U24d1247f009c10eca6f5e43528d21fee', 'U4ff89af2e41ae0e61f24725ad18d8407', 'U64f9d58abe88e55f7fbc237d0e729dc0', 'Ufcfced248b19df7602a5b5184ff37966']; // 要發送訊息的使用者ID清單

// let message3 = {
//     type: 'text',
//     text: '這是一個傳送給多個 USER 的訊息'
// };

// line_client.multicast(userIds, message3)
//     .then(() => {
//         console.log('Message was sent successfully.');
//     })
//     .catch((err) => {
//         console.error('Failed to send message:', err);
//     });
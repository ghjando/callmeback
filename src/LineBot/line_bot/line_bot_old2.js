import fs from 'fs';
import fsPromises from 'fs/promises';
import express from 'express';
import * as line from '@line/bot-sdk';
import admin from 'firebase-admin';
import md5 from 'md5';

import path from 'path';
import querystring from 'querystring';
import chokidar from 'chokidar';

import Pinyin from "./node_modules/pinyin/lib/pinyin.js";

// for CloudRun
import {Storage} from '@google-cloud/storage';
import {execSync, exec} from 'child_process';

// reply_msg.js
import * as reply_msg from './reply_msg.js';

/*
// (未採用) for line liff
import liff from '@line/liff';

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

/*
// 搜尋店家 (Old, 未排序)
function search_shop(shop_data, query_str, fuzzy, max_num) {
  if (!shop_data) {
    console.log("Shop data is undefined or null");
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
*/

// 搜尋店家
function search_shop(shop_data, query_str, fuzzy, max_num) {
  let search_obj = {};
  let result_obj = {};  //店家搜尋結果
  let index_arr = [];
  let order_arr = [];   //店家排序陣列

  if (!shop_data) {
    console.log("Shop data is undefined or null");
    search_obj.result_obj = result_obj;
    search_obj.order_arr = order_arr;  
    return search_obj;
  }
  
  // 如果搜尋字串長度小於 2，放棄搜尋
  if (query_str.length < 2) {
    search_obj.result_obj = result_obj;
    search_obj.order_arr = order_arr;  
    return search_obj;
  }
  
  for (let shop_id in shop_data) {
    if (shop_data[shop_id] && shop_data[shop_id].name) {
      if (fuzzy) {
        // 取得 query_str 在 shop_name 中的位置 index
        let index = shop_data[shop_id].name.indexOf(query_str);
        if (index != -1) {
          result_obj[shop_id] = shop_data[shop_id].name;
          index_arr.push({'index':index, 'shop_id':shop_id});
        }
      }
      else {
        if (shop_data[shop_id].name==query_str) {
          result_obj[shop_id] = shop_data[shop_id].name;
          index_arr.push({'index':0, 'shop_id':shop_id});
        }
      }
      
      if (!fuzzy) {
        if (Object.keys(result_obj).length == 1) break;
      }
    }
  }

  // 搜尋字串與店家名稱完全相同，移到首位
  if (index_arr.length > 1) {
    for (let i=0; i<index_arr.length; i++) {
      if (index_arr[i].index > 0) continue;
      
      // query_str 在 shop_name 中的 index 為 0
      if (index_arr[i].index == 0) {
        let shop_name = shop_data[index_arr[i].shop_id].name;
        // 測試(將"樂昕中醫診所" 改成 "樂"，使其與搜尋字串"樂"全長相同)
        // if (shop_name=="樂昕中醫診所") shop_name="樂"; 
        if (shop_name == query_str) {
          let first_item = index_arr[i];
          index_arr.splice(i,1);
          index_arr.splice(0,0,first_item);
        }
      }
    }
  }
  
  // 搜尋結果數量大於 max_num, 依 index 排序，並從中取得 max_num 個結果
  if (index_arr.length > max_num) {
    let sort_arr = [];
    let sort_result = {};
    let sort_index=0;
    while(true) {
      for (let i=0; i<index_arr.length; i++) {
        if (index_arr[i].index == sort_index) {
          sort_arr.push(index_arr[i]);
          sort_result[index_arr[i].shop_id] = result_obj[index_arr[i].shop_id];
          if (sort_arr.length > max_num) break;
        }
      }
      if (sort_arr.length > max_num) break;
      sort_index++;
    }
    index_arr = sort_arr;
    result_obj = sort_result;
  }
  else if (index_arr.length > 1) {
    // 依照 index 排序店家
    index_arr = index_arr.sort(function(a, b){
      return a.index - b.index;
    });
  }
  
  // 取得 order_arr (店家排序陣列)
  for (let i=0; i<index_arr.length; i++) {
    order_arr[i] = index_arr[i].shop_id;
  }
  
  search_obj.result_obj = result_obj;
  search_obj.order_arr = order_arr;
  
  return search_obj;
}

/*
// (Old)拼音搜尋店家
function search_shop_by_pinyin(shop_data, query_str) {
  if (!shop_data) {
    console.log("Shop data is undefined or null");
    return {};
  }

  // 取得 query_pinyin;
  let pinyin_arr = Pinyin.pinyin(query_str,{compact:true})[0];
  let query_pinyin = "";
  for (let i=0; i<pinyin_arr.length; i++) {
    query_pinyin += pinyin_arr[i] + " "; 
  }
  query_pinyin = query_pinyin.substr(0, query_pinyin.length-1);
  console.log(query_pinyin);

  // 搜尋店家
  let result_obj = {};
  for (let shop_id in shop_data) {
    if (shop_data[shop_id] && shop_data[shop_id].pinyin && shop_data[shop_id].pinyin.includes(query_pinyin)) {
      result_obj[shop_id] = shop_data[shop_id].name;
    }
  }
  
  return result_obj;
}
*/

// 拼音搜尋店家
function search_shop_by_pinyin(shop_data, query_str, max_num) {
  let pinyin_obj = {};
  let result_obj = {};  //店家搜尋結果
  let index_arr = [];
  let order_arr = [];   //店家排序陣列

  if (!shop_data) {
    console.log("Shop data is undefined or null");
    pinyin_obj.result_obj = result_obj;
    pinyin_obj.order_arr = order_arr;  
    return pinyin_obj;
  }

  // 如果搜尋字串長度小於 2，放棄搜尋
  if (query_str.length < 2) {
    pinyin_obj.result_obj = result_obj;
    pinyin_obj.order_arr = order_arr;  
    return pinyin_obj;
  }

  // 取得 query_pinyin 搜尋字串
  let pinyin_arr = Pinyin.pinyin(query_str,{compact:true})[0];
  let query_pinyin = "";
  for (let i=0; i<pinyin_arr.length; i++) {
    query_pinyin += pinyin_arr[i] + " "; 
  }
  query_pinyin = query_pinyin.substr(0, query_pinyin.length-1);
  console.log(query_pinyin);

  // 用拼音搜尋店家
  for (let shop_id in shop_data) {
    if (shop_data[shop_id] && shop_data[shop_id].name && shop_data[shop_id].pinyin) {
      let shop_name = shop_data[shop_id].name;
      let shop_pinyin = shop_data[shop_id].pinyin;
      
      //同音搜尋
      let index = shop_pinyin.indexOf(query_pinyin);
      if (index != -1) {
        result_obj[shop_id] = shop_name;
        
        //取得 shop_name 與 query_str 的同音起始位置 c_index
        let pinyin_before_index = shop_pinyin.substr(0, index);
        let split_arr = pinyin_before_index.split(" ");
        let c_index = 0;
        for (let i=0; i<split_arr.length; i++) {
          if (shop_name.indexOf(split_arr[i]) == -1) c_index++;   // 找不到，表示 split_arr[i] 為拼音字串，僅代表一個中文字，index 以 1 計算
          else c_index = c_index + split_arr[i].length;   //在 shop_name 有找到 split_arr[i]，表示此非拼音，而是 "英數" 字串，index 以 字串長度 計算
        }
        
        //取得 shop_name 與 query_str 同音的中文字串 match_str
        let match_str = shop_name.substr(c_index,query_str.length);       
        console.log("match_str: "+match_str);
        
        //取得 same_word_index (query_str 與 match_str 第一同字的位置)
        //let same_word_index = -1; 不適用
        let same_word_index = match_str.length; //沒有相同的字，預設 same_word_index 為最大值+1
        for (let i=0; i<match_str.length; i++) {
          if (match_str.substr(i,1)==query_str.substr(i,1)) {
            same_word_index = i;
            break;
          }
        }
        console.log("same_word_index: "+same_word_index);
        
        index_arr.push({'index':c_index, 'same_word_index':same_word_index, 'shop_id':shop_id});
      }
    }
  }

  // 將拼音全等的店家，移到首位 (可能有多個)
  let equal_arr = [];  // 拼音全等店家陣列  
  if (index_arr.length > 1) {
    for (let i=0; i<index_arr.length; i++) {
      if (index_arr[i].index > 0) continue;
      if (index_arr[i].index == 0) {
        let shop_pinyin = shop_data[index_arr[i].shop_id].pinyin;
        // 測試(將"樂昕中醫診所"拼音 改成 "lè"，使其與搜尋字串"樂"全長同音)
        // if (shop_pinyin=="lè xīn zhōng yī zhěn suǒ") shop_pinyin="lè"; 
        if (shop_pinyin == query_pinyin) {
          let first_item = index_arr[i];
          index_arr.splice(i,1);
          index_arr.splice(0,0,first_item);
          equal_arr.push(first_item);
        }
      }
    }
  }
  
  // 將拼音全等的店家，依 same_word_index 排序
  equal_arr = equal_arr.sort(function(a, b){
    return a.same_word_index - b.same_word_index;
  });
  for (let i=0; i<equal_arr.length; i++) {
    index_arr.splice(i,1, equal_arr[i]);    
  }  

  // 搜尋結果數量大於 max_num, 依 index 及 same_word_index 排序，並從中取得 max_num 個結果
  if (index_arr.length > max_num) {
    let whole_sort_arr = [];
    let whole_sort_result = {};
    let sort_index=0;
    while(true) {
      // 取得 index 等於 sort_index 的店家, sort_index 從 0 開始遞增
      let sort_arr = [];
      for (let i=0; i<index_arr.length; i++) {
        if (index_arr[i].index == sort_index) {
          sort_arr.push(index_arr[i]);
        }
      }

      /* 顯示排序前的資料
      console.log("sort_arr before: ");
      for (let i=0; i<sort_arr.length; i++) {
        if (i > max_num) break;
        let shop_id = sort_arr[i].shop_id;
        console.log(shop_data[shop_id].name);
      }
      */
      
      // 將 sort_arr，依 same_word_index 排序
      sort_arr = sort_arr.sort(function(a, b){
        return a.same_word_index - b.same_word_index;
      });

      /* 顯示排序後的資料
      console.log("sort_arr after: ");
      for (let i=0; i<sort_arr.length; i++) {
        if (i > max_num) break;
        let shop_id = sort_arr[i].shop_id;
        console.log(shop_data[shop_id].name);
      }
      */
      
      // 依序加入 whole_sort_arr
      for (let i=0; i<sort_arr.length; i++) {
        whole_sort_arr.push(sort_arr[i]);
        if (whole_sort_arr.length > max_num) break;
      }
      if (whole_sort_arr.length > max_num) break;
      
      sort_index++;
    }
    
    // 取得 whole_sort_result
    for (let i=0; i<whole_sort_arr.length; i++) {
      let shop_id = whole_sort_arr[i].shop_id;
      whole_sort_result[shop_id] = result_obj[shop_id];
    }
    
    index_arr = whole_sort_arr;
    result_obj = whole_sort_result;
  }
  else if (index_arr.length > 1) {
    // 依照 index 排序店家
    index_arr = index_arr.sort(function(a, b){
      return a.index - b.index;
    });
  }
  
  // 取得 order_arr (店家排序陣列)
  for (let i=0; i<index_arr.length; i++) {
    order_arr[i] = index_arr[i].shop_id;
  }
  
  pinyin_obj.result_obj = result_obj;
  pinyin_obj.order_arr = order_arr;
  
  return pinyin_obj;
}

// 搜尋叫號機
function search_caller(callers, query_str) {
  if (!callers) {
    console.log("callers data is undefined or null");
    return {};
  }

  // 如果搜尋字串長度小於 2，放棄搜尋
  if (query_str.length < 2) {
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
function adv_search_shop(shop_data, query_str, max_num) {
  let adv_obj = {};

  // 取得 adv_shop_str
  let adv_shop_str = query_str;
  let adv_caller_str = "";
  // 搜尋字串至少需 2 個字
  for (let i=2; i<=query_str.length; i++) {
    // test_str 逐次遞增長度
    let test_str = query_str.substr(0,i);   
    // 找到 與店家match的 最長 test_str，即為 adv_shop_str
    if (!exist_match_shop(shop_data, test_str)) {
      if (i==2) {
        adv_shop_str = "";
        adv_caller_str = query_str;
      }
      else {
        adv_shop_str = query_str.substr(0,i-1);
        adv_caller_str = query_str.substr(i-1);
      }
      break;
    }
  }
  console.log("adv_shop_str: "+adv_shop_str);
  console.log("adv_caller_str: "+adv_caller_str);
  
  // 搜尋含有 adv_shop_str 的店家
  let s_result = {};
  let s_order_arr = [];
  if (adv_shop_str.length >= 2) { // 搜尋字串至少需 2 個字
    let s_search_obj = search_shop(shop_data, adv_shop_str, true, max_num);
    s_result = s_search_obj.result_obj; //店家搜尋結果
    s_order_arr = s_search_obj.order_arr; //店家排序陣列

    // debug info
    console.log("同字搜尋："+adv_shop_str);
    for (let j=0; j<s_order_arr.length; j++) {
      let shop_id = s_order_arr[j];
      console.log(s_result[shop_id]);
    }
  }
  
  // 搜尋拼音相同店家 (比 adv_shop_str 長的字串)
  let pinyin_obj = {};
  let order_obj = {};
  let p_min_key = 0;
  let p_max_key = 0;
  for (let i=1; i<=adv_caller_str.length; i++) {
    let p_query_str_len = adv_shop_str.length+i;
    if (p_query_str_len < 2) continue; // 若長度小於 2， 不進行拼音搜尋
    let p_query_str = query_str.substr(0,p_query_str_len);
    let p_search_obj = search_shop_by_pinyin(shop_data, p_query_str, 10);
    let p_result = p_search_obj.result_obj; //店家搜尋結果
    let p_order_arr = p_search_obj.order_arr; //店家排序陣列
    
    // debug info
    console.log("同音搜尋："+p_query_str);
    for (let j=0; j<p_order_arr.length; j++) {
      let shop_id = p_order_arr[j];
      console.log(p_result[shop_id]);
    }
    
    let p_resultCount = Object.keys(p_result).length;
    if (p_resultCount == 0) break;
    else {
      pinyin_obj[i] = p_result;
      order_obj[i] = p_order_arr;
      if (p_min_key == 0) p_min_key = i;  // 取得 key 最小值
      p_max_key = i;  // 取得 key 最大值
    }
  }
  
  // 整合 s_result 及 pinyin_obj
  let w_result = {};  // whole result
  let shop_order_arr = []; // 店家排序陣列 
  let caller_str_len_obj = {}; // adv_caller_str 長度陣列
  // 先加入 pinyin_obj
  if (p_max_key > 0) {
    for (let i=p_max_key; i>=p_min_key; i--) {
      let p_result = pinyin_obj[i];
      let p_order_arr = order_obj[i];
      for (let j=0; j<p_order_arr.length; j++) {
        let shop_id = p_order_arr[j];
        if (shop_id in w_result) continue;  // 重覆店家不加入
        w_result[shop_id] = p_result[shop_id];
        shop_order_arr.push(shop_id);
        caller_str_len_obj[shop_id] = adv_caller_str.length-i;
        if (Object.keys(w_result).length > max_num) break;
      }
      if (Object.keys(w_result).length > max_num) break;
    }
  }
  
  // 再加入 s_result
  if (Object.keys(w_result).length <= max_num) {
    for (let j=0; j<s_order_arr.length; j++) {
      let shop_id = s_order_arr[j];
      if (shop_id in w_result) continue;  // 重覆店家不加入
      w_result[shop_id] = s_result[shop_id];
      shop_order_arr.push(shop_id);
      caller_str_len_obj[shop_id] = adv_caller_str.length;
      if (Object.keys(w_result).length > max_num) break;
    }
  }
  
  // debug info
  console.log("全部店家：");
  for (let j=0; j<shop_order_arr.length; j++) {
    let shop_id = shop_order_arr[j];
    console.log(w_result[shop_id]);
  }
  
  if (Object.keys(w_result).length > 0) { // 有找到店家
    adv_obj.result_obj = w_result;
    adv_obj.adv_caller_str = adv_caller_str;
    adv_obj.shop_order_arr = shop_order_arr;
    adv_obj.caller_str_len_obj = caller_str_len_obj;
    
    // 搜尋結果 "只有一個" 且是 "同字搜尋"，則不用選擇店家
    if ((shop_order_arr.length == 1) && (shop_order_arr[0] in s_result)) adv_obj.b_select_shop = false;
    else adv_obj.b_select_shop = true;
    
    /*
    // debug info
    let shop_id = adv_obj.shop_order_arr[0];
    console.log(shop_id);
    console.log(adv_obj.result_obj[shop_id]);
    console.log(adv_obj.adv_caller_str);
    console.log(adv_obj.caller_str_len_obj[shop_id]);
    */
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
  for (let i=0; i<query_str.length-1; i++) {
    // 搜尋字串至少需 2 個字
    let test_str = query_str.substr(i,2);
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
    // 搜尋字串至少需 2 個字
    for (let i=2; i<=query_str.length; i++) {
      // test_str 逐次遞增長度
      let test_str = query_str.substr(0,i);   
      // 找到與叫號機 match 的最長 test_str，即為 adv_caller_str
      if (!exist_match_caller(callers, test_str)) {
        console.log("83");
        if (i==2) {
          adv_caller_str = "";
          adv_number_str = query_str;
        }
        else {
          adv_caller_str = query_str.substr(0,i-1);
          adv_number_str = query_str.substr(i-1);
        }
        break;
      }
    }
  }
  console.log("adv_caller_str: "+adv_caller_str);
  console.log("adv_number_str: "+adv_number_str);
  
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
  extra_obj.extra_number = "";
  extra_obj.result_obj = {};

  //let reg = /\d+$/;
  let reg = /(No|No.| |　)*\d+( |　|號|号)*$/;
  let arr = query_str.match(reg); // 尋找字串末尾的數字
  if (arr != null) {
    extra_obj.extra_number = arr[0].match(/\d+/);
    query_str = query_str.replace(reg,'').trim();  // 移除字串末尾的數字
    
    if (query_str.length >= 2) {  // 搜尋字串至少需 2 個字
      extra_obj.result_obj = search_shop(shop_data, query_str, fuzzy, max_num).result_obj;
      let resultCount = Object.keys(extra_obj.result_obj).length;
      if (resultCount < 1) {  // 仍未找到店家
        /* 
        // (Old)移除字串末尾的分隔字元
        reg = /,+| +|;+|:+|，+|　+|；+|：+$/;
        while(true) {
          let old_length = query_str.length;
          query_str = query_str.replace(reg,'').trim(); 
          if (query_str.length == old_length) break;
        }
        */
        
        // 移除字串末尾的分隔字元
        reg = /(,| |;|:|，|　|；|：)*$/;
        query_str = query_str.replace(reg,'').trim();  
        console.log(query_str+"$");

        if (query_str.length >= 2) {  // 搜尋字串至少需 2 個字
          extra_obj.result_obj = search_shop(shop_data, query_str, fuzzy, max_num).result_obj;
        }
      }
    }
  }
  
  return extra_obj;
}

// 搜尋末尾的額外數字 (叫號機)
function extra_search_caller(callers, query_str) {
  let extra_obj = {};
  extra_obj.caller_id = "";
  extra_obj.caller_name = query_str;
  extra_obj.extra_number = "";  

  //let reg = /\d+$/;
  let reg = /(No|No.| |　)*\d+( |　|號|号)*$/;
  let arr = query_str.match(reg); // 尋找字串末尾的數字
  if (arr != null) {
    extra_obj.extra_number = arr[0].match(/\d+/);
    query_str = query_str.replace(reg,'').trim();  // 移除字串末尾的數字
    //console.log(query_str);
    
    // 搜尋叫號機 id
    if (query_str.length >= 2) {  // 搜尋字串至少需 2 個字
      for (let id in callers) {
        if (callers[id] == query_str) {
          extra_obj.caller_id = id;
          extra_obj.caller_name = query_str;
          break;
        }
      }
    
      if (extra_obj.caller_id == "") {  // 仍未找到叫號機
        /*
        // (Old)移除字串末尾的分隔字元
        reg = /,+| +|;+|:+|，+|　+|；+|：+$/;
        while(true) {
          let old_length = query_str.length;
          query_str = query_str.replace(reg,'').trim();  
          if (query_str.length == old_length) break;
        }
        */

        // 移除字串末尾的分隔字元
        reg = /(,| |;|:|，|　|；|：)*$/;
        query_str = query_str.replace(reg,'').trim();  
        console.log(query_str+"$");

        if (query_str.length >= 2) {  // 搜尋字串至少需 2 個字
          for (let id in callers) {
            if (callers[id] == query_str) {
              extra_obj.caller_id = id;
              extra_obj.caller_name = query_str;
              break;
            }
          }
        }
      }
    }
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
  // shop_data.json 檔案路徑  
  let shop_file_path = path.join(process.cwd(), '../common_data/shop_data.json');
  console.log(shop_file_path);

  // Creates a Cloud Storage client
  let storage;
  if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
    let storage_key_file = await fsPromises.readFile(`./data/${project_id}/storage_service_account_key.json`, 'utf8');
    let storage_key = JSON.parse(storage_key_file);
    storage = new Storage({
      projectId: project_id,
      credentials: storage_key
    });
  }
  
  // 從 Cloud Storage 下載 shop_data.json
  async function download_shop_file(target_path) {
    let fileName = 'shop_data.json';
    
    // Downloads the file
    const options = {
      destination: target_path
    };

    try {
      await storage.bucket(bucketName).file(fileName).download(options);
      console.log(`gs://${bucketName}/${fileName} downloaded to ${target_path}`);
    }
    catch (err) {
      console.log(`error: failed to download gs://${bucketName}/${fileName}`);
      console.log(err.message);
      log_file.write(`error: failed to download gs://${bucketName}/${fileName}\n`);
      log_file.write(err.message+"\n");
    }
    
    return Promise.resolve(null);
  }

  // 上傳 usage_log 到 Cloud Storage
  async function upload_usage_file(file_name) {
    const options = {
      destination: "usage_log/"+file_name
    };
    let file_path = path.join(process.cwd(), '../common_data/usage_log/'+file_name);
    
    try {
      await storage.bucket(bucketName).upload(file_path, options);
      console.log(`gs://${bucketName}/usage_log/${file_name} uploaded`);
    }
    catch (err) {
      console.log(`error: failed to upload gs://${bucketName}/usage_log/${file_name}`);
      console.log(err.message);
      log_file.write(`error: failed to upload gs://${bucketName}/usage_log/${file_name}\n`);
      log_file.write(err.message+"\n");
    }
    
    return Promise.resolve(null);
  }

  // 移除 Cloud Storage 過期的 usage_log 
  async function delete_expired_usage_files(exp_ymd) {
    const listOptions = {
      prefix: "usage_log/"
    };

    // Lists files in the bucket, filtered by a prefix
    const [files] = await storage.bucket(bucketName).getFiles(listOptions);
    let filenames = [];
    files.forEach(file => {
      filenames.push(file.name);
    });      
    
    for (let i=0; i<filenames.length; i++) {
      let fname = path.parse(filenames[i]).name;
      if (fname <= exp_ymd) {
        const deleteOptions = {};
        try {
          await storage.bucket(bucketName).file(filenames[i]).delete(deleteOptions);
          console.log(`gs://${bucketName}/${filenames[i]} deleted`);
        } 
        catch (err) {
          console.log(`error: failed to delete gs://${bucketName}/${filenames[i]}`);
          console.log(err.message);
          log_file.write(`error: failed to delete gs://${bucketName}/${filenames[i]}\n`);
          log_file.write(err.message+"\n");
        }
      }
    }
    
    return Promise.resolve(null);
  }

  // 若是 Cloud Run，先從 Cloud Storage 下載 shop_data.js
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
  let line_client = new line.Client(line_config);

  let firebase_key_file = await fsPromises.readFile(`./data/${project_id}/firebase_service_account_key.json`, 'utf8');
  let firebase_key = JSON.parse(firebase_key_file);

  let firebase_config_file = await fsPromises.readFile(`./data/${project_id}/firebaseConfig.json`, 'utf8');
  let firebase_config = JSON.parse(firebase_config_file);
  let db_str = firebase_config.db_str;

  let webhookEventsApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://webhook-events-' + db_str
  }, 'webhookEventsApp');

  let lineUserMsgApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://line-user-msg-' + db_str
  }, 'lineUserMsgApp');

  /*
  let shopListApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://shop-list-' + db_str
  }, 'shopListApp');
  */

  let usageLogApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://usage-log-' + db_str
  }, 'usageLogApp');

  let shopCallerApp = admin.initializeApp({
    credential: admin.credential.cert(firebase_key),
    databaseURL: 'https://shop-caller-' + db_str
  }, 'shopCallerApp');

  let userEventApp = admin.initializeApp({
    credential: admin.credential.cert(firebase_key),
    databaseURL: 'https://user-event-' + db_str
  }, 'userEventApp');

  let bookingApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://user-booking-' + db_str
  }, 'bookingApp');

  let bookingTempApp = admin.initializeApp({
      credential: admin.credential.cert(firebase_key),
      databaseURL: 'https://user-booking-temp-' + db_str
  }, 'bookingTempApp');

  let webhookEventsDB = webhookEventsApp.database();
  let lineUserMsgDB = lineUserMsgApp.database();
  // let shopListDB = shopListApp.database();
  let usageLogDB = usageLogApp.database();
  let shopCallerDB = shopCallerApp.database();
  let userEventDB = userEventApp.database();
  let bookingDB = bookingApp.database();
  let bookingTempDB = bookingTempApp.database();

  // 讀取店家資料
  let shop_file = await fsPromises.readFile(shop_file_path, 'utf8');
  let shopData = await JSON.parse(shop_file);
  console.log('shop count:', Object.keys(shopData).length);

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
  }

  /*
  // (firebase)讀取店家資料
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
  
  // (firebase)即時更新店家資料
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

  /*
  // let webhookEventsRef = webhookEventsApp.ref("webhookEvents"); // 這將會創建一個名為 "webhookEvents" 的節點

  // // 監聽資料變化
  // webhookEventsRef.on('value', (snapshot) => {
  //     // console.log('Data changed:', snapshot.val());
  // });

  // // 監聽子節點新增
  // webhookEventsRef.on('child_added', (snapshot) => {
  //     // console.log('Child added:', snapshot.key, snapshot.val());
  // });
  */

  // 使用記錄 (記憶體)
  let usageLogData = {};
  
  // 保留使用記錄
  async function keep_usage_log(shop_id, caller_id, user_id, action) {
    // 將 "新使用者預約" 延遲記錄，以避免與 "查詢" 記錄互相覆蓋
    if (action == "新使用者預約") await sleep(2000);
    
    let date_obj = new Date();
    let year = date_obj.getFullYear();
    let month = ("00"+(date_obj.getMonth()+1)).substr(-2);
    let day = ("00"+date_obj.getDate()).substr(-2);
    let hour = ("00"+date_obj.getHours()).substr(-2);
    let minute = ("00"+date_obj.getMinutes()).substr(-2);
    let second = ("00"+date_obj.getSeconds()).substr(-2);
    let date = `${year}${month}${day}`;
    let time = `${hour}:${minute}:${second}`;

    // 顯示 action 訊息
    let shop_data = shopData;
    if (shop_id in shop_data) {
      let target_name = shop_data[shop_id].name;
      let isMultiCaller = shop_data[shop_id].isMultiCaller;
      if (isMultiCaller && (caller_id in shop_data[shop_id].callers)) target_name += ` ${shop_data[shop_id].callers[caller_id]}`;
      console.log(`${user_id}\n${action}：${target_name}`);
    }

    // 儲存到 firebase
    usageLogDB.ref(`/${date}/${shop_id}/${user_id}/${time}`).set({
      'action': action, 
      'caller_id':caller_id
    });

    // 儲存到 usageLogData (記憶體)
    if (!(date in usageLogData)) usageLogData[date] = {};
    if (!(shop_id in usageLogData[date])) usageLogData[date][shop_id] = {};
    if (!(user_id in usageLogData[date][shop_id])) usageLogData[date][shop_id][user_id] = {};
    usageLogData[date][shop_id][user_id][time] = {
      'action': action, 
      'caller_id':caller_id
    };
  }    
  
  // 設定 focusCaller
  async function set_focus_caller(user_id, focus_caller) {
    let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
    await userRef.child('focusCaller').set(focus_caller);
    
    // 保留使用記錄
    let shop_id = focus_caller.shop_id;
    let caller_id = focus_caller.caller_id;
    if (shop_id!="" && caller_id!="") {
      keep_usage_log(shop_id, caller_id, user_id, '查詢');
    }
    
    return Promise.resolve(null);
  }
  
  // 儲存 usage_log 至檔案, 並清除過期資料 (包含 webhook-events)
  async function save_usage_log() {
    // 每天 4:00 ~ 5:00 執行
    let date_obj = new Date();
    let hour = ("00"+date_obj.getHours()).substr(-2);
    //(for 測試 )if (parseInt(hour,10) > 12) {
    if (hour == "04") {
      // 儲存前一天的 usage_log 至檔案
      let log_date_obj = new Date(Date.now()-1000*60*60*24*1);
      let log_ymd = get_ymd(log_date_obj);
      
      // 取得 usageLogData 的日期陣列，並依大小排列
      let date_arr = Object.keys(usageLogData);
      date_arr = date_arr.sort(function (a, b) {
        return a - b;
      });

      /*
      // 測試資料
      usageLogData['20240921']=
      {
        "2799": {
          "Ude7b0895e2c554b6c7743339f865e3b6": {
            "10:17:52": {
              "action": "查詢",
              "caller_id": "2799-0"
            }
          }
        }
      };
      usageLogData['20240922']=
      {
        "2799": {
          "Ude7b0895e2c554b6c7743339f865e3b6": {
            "10:17:52": {
              "action": "查詢",
              "caller_id": "2799-0"
            }
          }
        },
        "3016": {
          "U041a4eb9c9a1bac8e9ca6da133b6fc75": {
            "15:15:42": {
              "action": "查詢",
              "caller_id": "3016-0"
            },
            "15:15:48": {
              "action": "設定號碼",
              "caller_id": "3016-0"
            }
          },
          "U08d5d7931dc65f2977afa0a6dc897ae1": {
            "14:29:32": {
              "action": "查詢",
              "caller_id": "3016-0"
            }
          }
        }
      };
      */
      
      let save_data = {};
      // 假如 usageLogData (記憶體) 有前一天的完整資料，則使用 usageLogData
      if ((log_ymd in usageLogData) && (log_ymd!=date_arr[0])) {
        save_data = usageLogData[log_ymd];
      }
      else {  // 否則需從 firebase 的 usageLogDB 取得 前一天 的資料
        let log_ymd_snapshot = await usageLogDB.ref(`/${log_ymd}`).once('value');
        if (log_ymd_snapshot.exists()) {
          save_data = log_ymd_snapshot.val();
        }
        else {
          console.log('[firebase] usage_log: no data');
        }
      }

      if (Object.keys(save_data).length > 0) {
        let path = `../common_data/usage_log/${log_ymd}.json`;
        let data = JSON.stringify(save_data, null, 2);

        // 儲存 usage_log 到 json 檔
        let save_OK = false;
        try {
          
          /*
          // 測試資料
          fs.writeFileSync('../common_data/usage_log/20240602.json', data);
          fs.writeFileSync('../common_data/usage_log/20240614.json', data);
          */
          
          fs.writeFileSync(path, data);
          console.log(`usage_log ${log_ymd}.json saved`);
          save_OK = true;
        }
        catch (err) {
          console.log(`error: failed to save usage_log ${log_ymd}.json`);
          console.log(err.message);
          log_file.write(`error: failed to save usage_log ${log_ymd}.json\n`);
          log_file.write(err.message+"\n");
        }

        // 上傳 usage_log 到 Cloud Storage
        if (save_OK && (deploy_type == "cloud_run" || deploy_type == "docker_run")) {
          await upload_usage_file(`${log_ymd}.json`);
        }          
      }

      // 計算 usageLogData 過期日期 (保留一週)
      let exp_date_obj = new Date(Date.now()-1000*60*60*24*8);
      let exp_ymd = get_ymd(exp_date_obj);
      console.log("usageLogData 過期日期："+exp_ymd);
      log_file.write("usageLogData 過期日期："+exp_ymd+"\n");

      // 刪除 Object usageLogData 過期資料
      for (let log_date in usageLogData) {
        if (log_date <= exp_ymd) {
          delete usageLogData[log_date];
          console.log(`delete usageLogData: ${log_date}`);
        }
      }
      
      // 計算 usage_log 過期日期 (保留100天)
      exp_date_obj = new Date(Date.now()-1000*60*60*24*101);
      exp_ymd = get_ymd(exp_date_obj);
      console.log("usage_log 過期日期："+exp_ymd);
      log_file.write("usage_log 過期日期："+exp_ymd+"\n");

      // (Cloud Storage) 移除 usage_log 過期 json 檔
      if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
        await delete_expired_usage_files(exp_ymd);
      }

      // (Local) 移除 usage_log 過期 json 檔
      if (deploy_type == "cloud_run" || deploy_type == "docker_run") { // 若是 CloudRun, Local檔案只保留一週          
        exp_date_obj = new Date(Date.now()-1000*60*60*24*8);
        exp_ymd = get_ymd(exp_date_obj);
      }
      let filenames = fs.readdirSync("../common_data/usage_log");
      for (let i=0; i<filenames.length; i++) {
        let fname = path.parse(filenames[i]).name;
        if (fname <= exp_ymd) {
          let path = `../common_data/usage_log/${filenames[i]}`;
          try {
            fs.unlinkSync(path);
            console.log(`usage_log ${filenames[i]} deleted`);
          }
          catch (err) {
            console.log(`error: failed to delete usage_log ${filenames[i]}`);
            console.log(err.message);
            log_file.write(`error: failed to delete usage_log ${filenames[i]}\n`);
            log_file.write(err.message+"\n");
          }
        }
      }
      if (deploy_type == "cloud_run" || deploy_type == "docker_run") { // 恢復原本過期日期
        exp_date_obj = new Date(Date.now()-1000*60*60*24*101);
        exp_ymd = get_ymd(exp_date_obj);
      }

      // (Firebase) 移除 usage_log 過期資料 
      usageLogDB.ref(`/${exp_ymd}`).remove();
      console.log(`[firebase] remove usage_log data: ${exp_ymd}`);
      log_file.write(`[firebase] remove usage_log data: ${exp_ymd}\n`);

      let usage_snapshot = await usageLogDB.ref('/').orderByKey().endBefore(`${exp_ymd}`).limitToFirst(1).once('value');
      if (usage_snapshot.exists()) {
        // 取得過期資料最早的日期
        let first_key = Object.keys(usage_snapshot.val())[0];
        while(true){
          exp_date_obj = new Date(exp_date_obj.valueOf()-1000*60*60*24*1); // 往前一天
          exp_ymd = get_ymd(exp_date_obj);
          if (exp_ymd < first_key) break;
          
          usageLogDB.ref(`/${exp_ymd}`).remove();
          console.log(`[firebase] remove usage_log data: ${exp_ymd}`);
          log_file.write(`[firebase] remove usage_log data: ${exp_ymd}\n`);
        }
      }
      
      // 計算 webhook-events 過期日期 (保留14天)
      exp_date_obj = new Date(Date.now()-1000*60*60*24*15);
      exp_ymd = get_ymd(exp_date_obj);
      console.log("webhook-events 過期日期："+exp_ymd);
      log_file.write("webhook-events 過期日期："+exp_ymd+"\n");
      
      // 移除 webhook-events 過期資料
      webhookEventsDB.ref(`/${exp_ymd}`).remove();
      console.log(`[firebase] remove webhook data: ${exp_ymd}`);
      log_file.write(`[firebase] remove webhook data: ${exp_ymd}\n`);

      let webhook_snapshot = await webhookEventsDB.ref('/').orderByKey().endBefore(`${exp_ymd}`).limitToFirst(1).once('value');
      if (webhook_snapshot.exists()) {
        // 取得過期資料最早的日期
        let first_key = Object.keys(webhook_snapshot.val())[0];
        while(true){
          exp_date_obj = new Date(exp_date_obj.valueOf()-1000*60*60*24*1); // 往前一天
          exp_ymd = get_ymd(exp_date_obj);
          if (exp_ymd < first_key) break;
          
          webhookEventsDB.ref(`/${exp_ymd}`).remove();
          console.log(`[firebase] remove webhook data: ${exp_ymd}`);
          log_file.write(`[firebase] remove webhook data: ${exp_ymd}\n`);
        }
      }
    }
  }

  // 取得 booking data (for "立即預約")
  function get_booking_data(shop_id, user_id) {
    let shop_data = shopData;

    let booking_url = "";
    let booking_phone = "";
    let booking_phone_hint = "";
    if ('booking' in shop_data[shop_id]) {
      if ('url' in shop_data[shop_id]['booking']) booking_url = shop_data[shop_id]['booking'].url;
      if ('phone' in shop_data[shop_id]['booking']) booking_phone = shop_data[shop_id]['booking'].phone;
      if ('phone_hint' in shop_data[shop_id]['booking']) booking_phone_hint = shop_data[shop_id]['booking'].phone_hint;
    }
    else {
      if ('booking_url' in shop_data[shop_id]) booking_url = shop_data[shop_id].booking_url;
      if ('booking_phone' in shop_data[shop_id]) booking_phone = shop_data[shop_id].booking_phone;
      if ('booking_phone_hint' in shop_data[shop_id]) booking_phone_hint = shop_data[shop_id].booking_phone_hint;
    }

    // booking_url 加上 "user_id" parameter
    if (booking_url != "") {
      let user_id_base64 = Buffer.from(user_id).toString('base64');
      let index = booking_url.indexOf("?");
      if (index == -1) booking_url += `?callme_id=${user_id_base64}`;
      else if (index == booking_url.length-1) booking_url += `cal lme_id=${user_id_base64}`;
      else booking_url += `&callme_id=${user_id_base64}`;
    }
    
    // 檢查 booking_phone 格式，並加上 "tel:" 前綴
    booking_phone = booking_phone.trim();
    if (booking_phone != "") {
      let reg = /^\d{2,3}-?\d{7,8}$/;
      if (!reg.test(booking_phone)) booking_phone = "";
      else {
        //舊版-直接撥打電話
        //booking_phone = "tel:" + booking_phone;
        
        let shop_name = shop_data[shop_id].name;
        booking_phone = `${shop_name}\n預約電話：${booking_phone}\n${booking_phone_hint}`;
      }
    }
    
    let booking_obj = {
      "booking_url": booking_url,
      "booking_phone": booking_phone
    };
    
    return booking_obj;
  }

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
            await set_focus_caller(user_id, focus_caller);

            // 取得 booking data (for "立即預約")
            let booking_obj = get_booking_data(shop_id, user_id);
            let booking_url = booking_obj.booking_url;
            let booking_phone = booking_obj.booking_phone;

            // 請使用者選擇叫號機
            //console.log(JSON.stringify(reply_msg.select_caller(shop_id, shop_name, caller_id_arr, caller_name_arr, 20, booking_url, booking_phone)));    
            replyMsgs.push(reply_msg.select_caller(shop_id,shop_name,caller_id_arr,caller_name_arr,20,booking_url,booking_phone));
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
        let address = shop_data[shop_id].address;
        let zone = "";
        if ('zone' in shop_data[shop_id]) zone = shop_data[shop_id].zone;
        let g_address = "";
        if ('google_map' in shop_data[shop_id] && 'address' in shop_data[shop_id].google_map) {
          g_address = shop_data[shop_id].google_map.address;
          //console.log("g_address: "+g_address);
        }
        
        // 取得 address_fix (地址顯示字串)
        let address_fix = "";
        if (address != "") address_fix = address;
        else if (g_address != "") address_fix = g_address;
        else address_fix = zone;
        //console.log("address_fix: "+address_fix);
        
        /*
        // 測試資料
        shop_data['2391']['booking']['url'] = "https://www.mainpi.com/bookingmake?id=94";
        shop_data['2391']['booking']['phone'] = "02-22492039";
        shop_data['2391']['booking']['phone_hint'] = "";
        
        shop_data['1474']['booking']['url'] = "https://www.mainpi.com/bookingmake?id=94";
        shop_data['1474']['booking']['phone'] = "02-22492039";
        shop_data['1474']['booking']['phone_hint'] = "";
        */

        // 取得 booking data (for "立即預約")
        let booking_obj = get_booking_data(shop_id, user_id);
        let booking_url = booking_obj.booking_url;
        let booking_phone = booking_obj.booking_phone;
        
        if ('callers' in shop_data[shop_id]) {
          let callers = shop_data[shop_id].callers;
          
          if (caller_id in callers) {
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

            let b_num_set = false;    // 是否已設定通知
            let b_suggested = false;  // 是否已被建議到現場等待
            
            // 從資料庫讀取 notify_num, 若存在表示已設定通知
            let notify_num = "";
            let notify_num_snapshot = await userEventDB.ref(`${c_shop_id}/${c_room_id}/${user_id}/notify_num`).once('value');
            if (notify_num_snapshot.exists()) {
              notify_num = notify_num_snapshot.val();
              b_num_set = true;
            }
            
            // 有使用者輸入號碼
            if (input_num !== "") {  
              // 檢查是否已輸入過號碼，但被建議到現場等待
              let suggested_snapshot = await lineUserMsgDB.ref(`lineUserMsg/${user_id}/focusCaller/suggested`).once('value');
              if (suggested_snapshot.exists()) b_suggested = true;

              if (b_num_set || b_suggested) notify_num = input_num;   // 修改號碼 或 推翻建議
              else notify_num = input_num - 5;  // 第一次設定號碼，提前 5 號通知
              
              // 通知號碼大於當前號碼，進行儲存
              if (notify_num > curr_num) {
                let userEventRef = userEventDB.ref(`${c_shop_id}/${c_room_id}/${user_id}`);
                /*
                await userEventRef.set({
                    "notify_num": notify_num,
                    "notified": false,
                    "timestamp": admin.database.ServerValue.TIMESTAMP
                }); 
                */
                userEventRef.set({
                    "notify_num": notify_num,
                    "notified": false,
                    "timestamp": admin.database.ServerValue.TIMESTAMP
                }); 
              }
              else {  // 已到號或已過號，只告知，不刪除記錄
                /*  
                console.log("58");
                let userEventRef = userEventDB.ref(`${c_shop_id}/${c_room_id}/${user_id}`);
                userEventRef.remove();
                */
              }
              
              // 保留使用記錄
              keep_usage_log(shop_id, caller_id, user_id, '設定號碼');
            }
            else {  // 若無使用者輸入號碼，表示是查詢，故需要更新 focusCaller
              // 更新 focusCaller
              let focus_caller = {};
              focus_caller['shop_id'] = shop_id;
              focus_caller['caller_id'] = caller_id;
              //await set_focus_caller(user_id, focus_caller);
              set_focus_caller(user_id, focus_caller);
            }
            
            // 已設定叫號，顯示叫號機資訊，及通知號碼(或到號/過號訊息)
            if (notify_num !== "") {
              if (b_num_set || b_suggested) { // 修改號碼 或 推翻建議
                if (notify_num > curr_num) {
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, "將通知", notify_num));
                }
                else if (notify_num == curr_num) {
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, "已到號", notify_num));
                }
                else if (notify_num < curr_num) {
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, "已過號", notify_num));
                }
              }
              else {  // 第一次設定號碼，提前 5 號通知
                if (notify_num > curr_num) {
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, "將通知", notify_num));
                  replyMsgs.push({
                      type: 'text',
                      text: `系統將提前於"${notify_num}號"通知你，若要修改，請直接輸入號碼`
                  });                        
                }
                else if (notify_num <= curr_num && input_num > curr_num) {  // 即將到號，建議到現場等待
                  // 更新 focusCaller, 設定 suggested = true
                  await lineUserMsgDB.ref(`lineUserMsg/${user_id}/focusCaller/suggested`).set(true);
                  
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, "即將到號", notify_num));
                  replyMsgs.push({
                      type: 'text',
                      text: `若仍要系統通知，請輸入希望通知的號碼`
                  });                        
                }
                else if (input_num == curr_num) {
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, "已到號", notify_num));
                }
                else if (input_num < curr_num) {
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, "已過號", notify_num));
                }
              }
            }
            else {  // 尚未設定叫號，只顯示叫號機資訊
              let booking_hint = (booking_url=="" && booking_phone=="")? '':'\n(若尚未預約，可使用左下方的"立即預約"功能)';
              replyMsgs.push(reply_msg.caller_info(shop_id, caller_id, shop_name, address_fix, caller_name, curr_num, prev_num, change_time, update_time, last_update, booking_url, booking_phone));
              replyMsgs.push({
                type: 'text',
                //(Old)text: `請輸入你的號碼...`
                //(Old)text: `到幾號要叫你呢？\n(為避免過號，請輸入您希望提前通知的號碼)`
                text: `你幾號呢？${booking_hint}`
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
        console.log(userMsg);
        
        /*
        // 免排網頁預約資料
        let msg_obj = querystring.parse(userMsg);
        if ('source_id' in msg_obj && 'action' in msg_obj && msg_obj.action=="預約") {
          msgType = 'action';
          post_msg.action = '新使用者預約';
          post_msg.msg_obj = msg_obj;
        }
        else if ('來源代碼' in msg_obj && '動作' in msg_obj && msg_obj.動作=="預約") {
          msgType = 'action';
          post_msg.action = '新使用者預約';
          post_msg.msg_obj = msg_obj;
        }
        */
        // 免排網頁預約資料
        if (userMsg.substr(0,5)=="預約提醒:") {
          msgType = 'action';
          post_msg.action = '新使用者預約';
        }          
        else {
          // 檢查是否為 掃描 QR-Code (含叫號機)
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
      }
      // 儲存原始 userMsg
      let origin_userMsg = userMsg;

      if (msgType != 'action') {
        // 檢查使用者的輸入是否為數字(可為 No.32 No32 32號 32号等形式)
        //(Old)if (/^\d+$/.test(userMsg)) {
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

      let b_adv_search = false;   // 是否需要進階搜尋
      let adv_obj_s = {};         // 進階搜尋店家的結果
      let shop_order_arr =[];     // 店家列表的排序陣列
      let caller_str_len_obj = {};// 店家 adv_caller_str 的長度
      let adv_caller_str = "";    // 進階搜尋的 caller 搜尋字串
      let adv_number_str = "";    // 進階搜尋的 number 搜尋字串
      let b_select_shop = false;  // 進階搜尋結果是否需選擇店家
      let b_done = false;
      while (!b_done) {
        b_done = true;
        switch (msgType) {
          case 'text':
            console.log("20");
            
            // 搜尋字串至少需 2 個字
            if (userMsg.length < 2) {
              replyMsgs.push({
                type: 'text',
                text: `要搜尋店家，請輸入部分名稱(至少二個字)...`
              });
              break;
            }
            
            let shop_data = shopData;
            let result_obj = {};
            let resultCount;
            
            // postback event, 此為使用者選擇店家之結果，故使用精確搜尋
            if (event_type=='postback') {
              console.log("21");
              result_obj = search_shop(shop_data, userMsg, false, 1).result_obj;   // 精確搜尋
              resultCount = Object.keys(result_obj).length;
              
              // 讀取資料庫，查看是否有待處理的進階搜尋(adv_caller_str)
              let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
              let focus_snapshot = await userRef.child('focusCaller').once('value');
              if (focus_snapshot.exists()) {
                console.log("22");
                let focus_caller = focus_snapshot.val();
                if (('adv_caller_str' in focus_caller) && focus_caller.adv_caller_str!="") {
                  console.log("23");
                  // 取得 adv_caller_str 長度列表
                  let str_len_obj = {};
                  if ('caller_str_len_obj' in focus_caller) {
                    console.log("24");
                    str_len_obj = focus_caller.caller_str_len_obj;
                  }
                  // 取得 adv_caller_str 真正長度
                  if (Object.keys(str_len_obj).length > 0) {
                    console.log("25");
                    let shop_id = Object.keys(result_obj)[0];
                    //console.log(shop_id);
                    let str_len = str_len_obj[shop_id];
                    //console.log(str_len);
                    if (str_len <= 0) adv_caller_str = "";
                    else {
                      let start_pos = adv_caller_str.length - str_len;
                      adv_caller_str = focus_caller.adv_caller_str.substr(start_pos);
                    }
                    //console.log(adv_caller_str);
                    b_adv_search = true;
                  }
                }
              }
            }
            else {  // 此為"使用者"輸入字串搜尋，故使用模糊搜尋
              console.log("26");
              let search_obj = {};
              /*
              //測試資料 (用 "耳鼻喉" 進行同字搜尋)
              if (user_id=="U95547b7b9b1226f08563825c7f8db533") {
                shop_data['8001'] = {'name':"耳鼻喉", 'pinyin': "ěr bí hóu"};
                search_obj = search_shop(shop_data, userMsg, true, 10);   // 模糊搜尋
                delete shop_data['8001'];
              }
              else {
              */
                search_obj = search_shop(shop_data, userMsg, true, 10);   // 模糊搜尋
              //}
              result_obj = search_obj.result_obj;
              shop_order_arr = search_obj.order_arr;
              resultCount = Object.keys(result_obj).length;

              // 未找到店家，檢查輸入字串末尾是否有"額外數字"
              if (resultCount < 1) {
                let extra_obj = extra_search_shop(shop_data, userMsg, true, 10);
                //if (Object.keys(extra_obj).length != 0) {
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
                      await set_focus_caller(user_id, focus_caller);
                    
                      // 進行額外事件 
                      msgType = 'number';
                      userMsg = extra_number;
                      b_done = false;
                      break;  // 離開 switch case
                    }
                    else b_adv_search = true; // 多個叫號機, 改用進階店家搜尋
                  }
                  else b_adv_search = true; // 未找到店家 或 找到多個店家, 改用進階店家搜尋
                //}
                //else b_adv_search = true; // 未找到店家, 改用進階店家搜尋
              }
            }
            
            // 未找到店家，改用進階店家搜尋 (或有待處理的進階搜尋)
            if (b_adv_search) {
              //if (user_id=="U95547b7b9b1226f08563825c7f8db533") {
                // (postback)已選取店家，但有待處理的進階搜尋(adv_caller_str)
                if (adv_caller_str != "") {
                  adv_obj_s.result_obj = result_obj;
                  adv_obj_s.adv_caller_str = adv_caller_str;
                  let shop_id = Object.keys(result_obj)[0];
                  adv_obj_s.shop_order_arr = [];
                  adv_obj_s.shop_order_arr.push(shop_id);
                  adv_obj_s.caller_str_len_obj = {};
                  adv_obj_s.caller_str_len_obj[shop_id] = adv_caller_str.length;
                  adv_obj_s.b_select_shop = false;
                }
                else {
                  /*
                  //測試資料 (用 "疲夫柯" 進行同音搜尋)
                  if (user_id=="U95547b7b9b1226f08563825c7f8db533") {
                    shop_data['9001'] = {'name':"皮膚科", 'pinyin': "pí fū kē"};
                    shop_data['9002'] = {'name':"皮膚柯", 'pinyin': "pí fū kē"};
                    shop_data['9003'] = {'name':"疲膚科", 'pinyin': "pí fū kē"};
                    shop_data['9004'] = {'name':"皮夫科", 'pinyin': "pí fū kē"};
                    shop_data['9005'] = {'name':"林皮膚柯", 'pinyin': "lín pí fū kē"};
                    shop_data['9006'] = {'name':"林疲膚科", 'pinyin': "lín pí fū kē"};
                    shop_data['9007'] = {'name':"林皮夫科", 'pinyin': "lín pí fū kē"};
                    adv_obj_s = adv_search_shop(shop_data, userMsg, 10);
                    delete shop_data['9001'];
                    delete shop_data['9002'];
                    delete shop_data['9003'];
                    delete shop_data['9004'];
                    delete shop_data['9005'];
                    delete shop_data['9006'];
                    delete shop_data['9007'];
                  }
                  else {
                  */
                    adv_obj_s = adv_search_shop(shop_data, userMsg, 10);
                  //}
                }
                
                if (Object.keys(adv_obj_s).length != 0) {   // 有找到店家
                  console.log("70");
                  adv_caller_str = adv_obj_s.adv_caller_str;
                  shop_order_arr = adv_obj_s.shop_order_arr;
                  caller_str_len_obj = adv_obj_s.caller_str_len_obj;
                  b_select_shop = adv_obj_s.b_select_shop;
                  result_obj = adv_obj_s.result_obj;
                  resultCount = Object.keys(result_obj).length;
                  if (resultCount > 1 || b_select_shop) {  // 找到多個店家 或 結果是同音搜尋，將 adv_caller_str 儲存到資料庫，待使用者選完店家後繼續進行
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
                        await set_focus_caller(user_id, focus_caller);
                      
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
            
            if (resultCount > 1 || b_select_shop) { // 找到多個店家 或 結果是同音搜尋
                // 進階搜尋的結果, 需要進行排序
                if (adv_caller_str != "") {
                  // 將 adv_caller_str 儲存到資料庫，待使用者選完店家後繼續進行
                  let focus_caller = {};
                  focus_caller["shop_id"] = "";
                  focus_caller["caller_id"] = "";
                  focus_caller["adv_caller_str"] = adv_caller_str;
                  focus_caller["caller_str_len_obj"] = caller_str_len_obj;
                  await set_focus_caller(user_id, focus_caller);
                  
                  // 請使用者選擇店家 (店家先進行排序)
                  console.log("27");
                  let shop_arr = [];
                  for (let i=0; i<shop_order_arr.length; i++){
                    let shop_id = shop_order_arr[i];
                    let shop_name = result_obj[shop_id];
                    shop_arr.push(shop_name);
                  }
                  replyMsgs.push(reply_msg.select_shop(shop_arr,10));
                }
                else {  //一般搜尋的結果
                  // 請使用者選擇店家
                  console.log("28");
                  let shop_arr = [];
                  for (let i=0; i<shop_order_arr.length; i++){
                    let shop_id = shop_order_arr[i];
                    let shop_name = result_obj[shop_id];
                    shop_arr.push(shop_name);
                  }                        
                  replyMsgs.push(reply_msg.select_shop(shop_arr,10));
                }
                
            }
            else if (resultCount == 1) {  // 找到單一店家
                console.log("29");

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
                replyMsgs.push({
                  type: 'text',
                  text: `沒找到 ${userMsg}，要搜尋店家，請輸入部分名稱(至少二個字)...`
                });
            }
            break;
          case 'number':
            console.log("50");
            let notify_num = userMsg-0;                        
            // 無效的號碼
            if (notify_num>999 || notify_num<0) {
              replyMsgs.push({
                  type: 'text',
                  text: `😩無效的號碼`
              });
              break;
            }

            console.log("51");
            let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
            let focus_snapshot = await userRef.child('focusCaller').once('value');
            if (!focus_snapshot.exists()) {
              replyMsgs.push({
                  type: 'text',
                  text: `請先搜尋店家(輸入部分名稱，至少二個字)...`
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
                    text: `請先搜尋店家(輸入部分名稱，至少二個字)...`
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
                      text: `請先選擇叫號機，然後再輸入號碼...`
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
                  await set_focus_caller(user_id, focus_caller);
                
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
              let result_obj = search_shop(shop_data, p_shop_name, true, 10).result_obj;   // 模糊搜尋
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
                      let caller_query_str = caller_name;
                      let extra_obj = extra_search_caller(callers, caller_query_str);
                      //if (Object.keys(extra_obj).length != 0) {
                        let extra_number = extra_obj.extra_number;
                        caller_id = extra_obj.caller_id;
                        caller_name = extra_obj.caller_name;

                        // 仍未找到叫號機，使用 msgType = 'text' 重新搜尋
                        if (caller_id == "") {  
                          // 進行額外事件
                          msgType = 'text';
                          userMsg = p_shop_name+";"+caller_query_str;
                          console.log(userMsg);
                          b_done = false;
                          break;  // 離開 switch case
                        }
                        else {  // 有找到叫號機，接著設定額外號碼
                          console.log("46");
                          // 更新 focusCaller
                          let focus_caller = {};
                          focus_caller["shop_id"] = shop_id;
                          focus_caller["caller_id"] = caller_id;
                          await set_focus_caller(user_id, focus_caller);
                      
                          // 進行額外事件 
                          msgType = 'number';
                          userMsg = extra_number;
                          b_done = false;
                          break;  // 離開 switch case
                        }
                      //}
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
            else if (action == '電話預約') {
              // 回覆電話號碼及備註
              replyMsgs.push({
                  type: 'text',
                  text: post_msg.booking_phone
              });                        
            }
            else if (action == '選擇預約方式') {
              replyMsgs.push(reply_msg.select_booking_type(post_msg));
            }                      
            else if (action == '新使用者預約') {
              // 讀取 使用者名稱
              let bracket_index = userMsg.indexOf("(");
              let user_name = userMsg.substr(5,bracket_index-5).trim();

              // 讀取 日期 時間
              let month_str = userMsg.match(/\d{1,2}月/)[0];
              let booking_month = ("00"+month_str.match(/\d{1,2}/)[0]).substr(-2);
              let day_str = userMsg.match(/\d{1,2}日/)[0];
              let booking_day = ("00"+day_str.match(/\d{1,2}/)[0]).substr(-2);
              let booking_time = userMsg.match(/\d{2}:\d{2}/)[0];
              
              // 取得 booking_year
              let booking_year = "";
              let date_obj = new Date();
              let year = date_obj.getFullYear();
              let month = ("00"+(date_obj.getMonth()+1)).substr(-2);
              if (booking_month < month) booking_year = year + 1;
              else booking_year = year;
              
              // 取得 date_key
              let date_key = `${booking_year}${booking_month}${booking_day}`;
              console.log(`date_key: ${date_key}`);
              console.log(`user_name: ${user_name}`);
              console.log(`booking_time: ${booking_time}`);
              
              // 讀取 預約暫存資料
              let booking_obj = {};	
              await bookingTempDB.ref(`${date_key}/${user_name}/${booking_time}`).once('value', (snapshot) => {
                if (snapshot.exists() && (snapshot!=null)) {
                  booking_obj = snapshot.val();      
                  if (Object.keys(booking_obj).length == 0) {
                    console.log('booking data not exist!');
                    replyMsgs.push({type: 'text', text: '預約資料不存在'});                                              
                  }
                }
                else {
                  if (!snapshot.exists()) console.log('booking data not exist!');
                  if (snapshot == null) console.log('booking data is null!');
                  replyMsgs.push({type: 'text', text: '預約資料不存在'});
                }
              }, (errorObject) => {
                console.log('[firebase] booking data read failed: ' + errorObject.name);
                replyMsgs.push({type: 'text', text: '讀取預約資料失敗'});
              });
              
              if (Object.keys(booking_obj).length > 0) {
                // 補上 user_id
                booking_obj['user_id'] = user_id;
                
                // 寫入 預約資料
                let booking_time_id = booking_obj.booking_time_id
                bookingDB.ref(`${date_key}/${user_id}/${booking_time_id}`).set(booking_obj);
                
                // 刪除 預約暫存資料
                bookingTempDB.ref(`${date_key}/${user_name}/${booking_time}`).remove();

                // 準備通知訊息
                let target_name = booking_obj.shop_name+" "+booking_obj.booking_name;
                let booking_date = booking_obj.booking_date;
                // 取得 Week Day
                let week_day = get_week_day(new Date(booking_date));
                let number = booking_obj.booking_num;

                let msg = "已收到預約資訊：";
                msg += `\n${target_name}`;
                msg += `\n姓名：${user_name}`;
                msg += `\n日期：${booking_date} (${week_day})`;
                if (booking_time != "") msg += `\n時間：${booking_time}`;
                if (number!="" && number!="-1") msg += `\n號碼：${number}`;
                msg += "\n\n將於預約日前一天☀️𝟵:𝟬𝟬提醒您";
                msg += "\n(逾上述時間後預約，將不再提醒)";

                // 傳送通知訊息
                if (msg != "") {
                  replyMsgs.push({type:'text', text:msg});
                  
                  // 顯示店家資訊及說明
                  let shop_id = booking_obj.shop_id;
                  let caller_name = booking_obj.booking_name;
                  let caller_id = "";
                  if (shop_id in shopData) {
                    let callers = shopData[shop_id].callers;
                    caller_id = Object.keys(callers)[0];
                    for (let id in callers) {
                      if (callers[id] == caller_name) {
                        caller_id = id;
                        break;
                      }
                    }
                    //if (shopData[shop_id].isMultiCaller) await reply_select_caller(shop_id, "");
                    //else await save_and_reply(shop_id, caller_id, "");
                    await save_and_reply(shop_id, caller_id, "");
                    replyMsgs.splice(-1,1);
                    replyMsgs.push({type:'text',text:'輸入(部分)名稱，即可查詢即時資訊如上'});
                  }
                  
                  // 保留使用記錄
                  keep_usage_log(shop_id, caller_id, user_id, "新使用者預約");               
                }
              }
            }
            break;
          default:
            break;
        }
      }

      // 將使用者的訊息保存到 lineUserMsgDB
      // console.log("7");
      let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
      let msgQueueSnapshot = await userRef.child('msgQueue').once('value');
      let msgQueue = msgQueueSnapshot.val();

      // console.log("8");
      // 如果 msgQueue 中已經有 10 條訊息，則刪除最早的一條
      if (msgQueue && Object.keys(msgQueue).length >= 10) {
        let oldestKey = Object.keys(msgQueue)[0];
        await userRef.child(`msgQueue/${oldestKey}`).remove();
      }

      // console.log("9");
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
      // console.log("10");
      // console.log(replyMsgs);
      // console.log(JSON.stringify(replyMsgs[0]));
      if (replyMsgs.length > 0) return line_client.replyMessage(replyToken, replyMsgs);
      else return Promise.resolve(null);
    } else {
      return Promise.resolve(null);
    }
  }

  /*
  // (未採用) for line liff
  async function reply_qr_code(user_id, shop_name, caller_name) {
    // 沒有 user_id，無法進行處理
    if (user_id==null || user_id=="") return;

    console.log("60");
    let notify_Msgs = [];

    // 搜尋店家
    let shop_data = shopData;
    let result_obj = search_shop(shop_data, shop_name, false, 1).result_obj;   // 精確搜尋
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
  */
  
  let app = express();
  //app.use(express.json());

  /*
  // app.post('/webhook', line.middleware(line_config), (req, res) => {
  //     Promise
  //         .all(req.body.events.map(handleEvent))
  //         .then((result) => res.json(result))
  //         .catch((err) => {
  //             console.log(err);
  //             res.status(500).end();
  //         });
  // });
  */

  app.post('/webhook', line.middleware(line_config), async (req, res) => {
    try {
      // 取得今天日期
      let date_obj = new Date();
      let start_time = date_obj.getTime();
      let year = date_obj.getFullYear();
      let month = ("00"+(date_obj.getMonth()+1)).substr(-2);
      let day = ("00"+date_obj.getDate()).substr(-2);
      
      // 處理事件 (例如回覆訊息)
      await Promise.all(req.body.events.map(handleEvent));

      // 將 webhook 資料存入 Firebase
      for (let event of req.body.events) {
        if (event.webhookEventId) { // 確保 eventId 存在
          let eventRef = webhookEventsDB.ref(`/${year}${month}${day}/${event.webhookEventId}`);
          // await eventRef.set(event);
          eventRef.set(event);
        }
      }
      
      // 計算 執行過程花費時間
      let end_time = Date.now();
      console.log('執行時間：'+(end_time-start_time)/1000+"秒");

      res.json({ success: true });
    } catch (err) {
      console.log(err);
      res.status(500).end();
    }
  });

  app.get('/status', (req, res) => {
    res.send('Server is running');
  });

  if (deploy_type == "cloud_run") {
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
  }

  // 店家資料更新時間
  app.get('/shop_data', (req, res) => {
    let stat = fs.statSync(shop_file_path);
    let date_obj=new Date(Math.floor(stat.mtimeMs));
    
    let year = date_obj.getFullYear();
    let month = ("00"+(date_obj.getMonth()+1)).substr(-2);
    let day = ("00"+date_obj.getDate()).substr(-2);
    let hour = ("00"+date_obj.getHours()).substr(-2);
    let minute = ("00"+date_obj.getMinutes()).substr(-2);
    let second = ("00"+date_obj.getSeconds()).substr(-2);
    
    res.send(`${year}/${month}/${day} ${hour}:${minute}:${second}`);
  });

  // liff 轉址 (透過 liff 使用內部流灠器)
  app.get('/redirect', async (req, res) => {
    //console.log(req.query);
    let param_str = req.query['liff.state'].substr(1);
    //console.log(param_str);
    let param_obj = querystring.parse(param_str);    
    let url = decodeURIComponent(param_obj.url);
    console.log(url);
    res.redirect(url);
  });

  // 立即預約 (利用轉址時，記錄 usage_log)
  app.get('/booking', async (req, res) => {
    //console.log(req.query);
    let param_obj = JSON.parse(JSON.stringify(req.query));

    let url = "";
    if ('booking_phone' in param_obj) {
      url = decodeURIComponent(param_obj.booking_phone);
    }
    else if ('booking_url' in param_obj){
      url = decodeURIComponent(param_obj.booking_url);
    }
    
    //console.log(url);
    if (url != "") res.redirect(url);
    
    //return res.sendStatus(200);
  });

  /* 
  // (未採用) 圖文選單 "搜尋店家" 
  app.get('/shops', (req, res) => {
    res.sendFile(path.join(__dirname, '/data/shops.html'));
  });
  */

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
  
  app.listen(3000, () => {
    console.log('Listening on port 3000');
  });

  // 儲存每日 usage_log 到檔案
  if (deploy_type == "cloud_run") {
    // 接收 cloud schedule 的 job_1h trigger
    app.get('/job_1h', (req, res) => {
      save_usage_log();        
      res.send('job_1h OK');
    });
  }
  else {
    save_usage_log();
    setInterval(save_usage_log, 1000*60*60);
  }
}

// 建立 log 檔
const log_file = fs.createWriteStream('./log.txt');

main();

/*
// let message1 = {
//     type: 'text',
//     text: '這是一個傳送廣播的訊息'
// };

// line_client.broadcast(message1)
//     .then(() => {
//         console.log('Broadcast message was sent successfully.');
//     })
//     .catch((err) => {
//         console.log('Failed to send broadcast message:', err);
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
//         console.log('Failed to send message:', err);
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
//         console.log('Failed to send message:', err);
//     });
*/

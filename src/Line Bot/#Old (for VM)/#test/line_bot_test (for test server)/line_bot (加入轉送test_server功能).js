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

import Pinyin from "./node_modules/pinyin/lib/pinyin.js";

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

/*
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
*/

// 搜尋店家
function search_shop(shop_data, query_str, fuzzy, max_num) {
  let search_obj = {};
  let result_obj = {};  //店家搜尋結果
  let index_arr = [];
  let order_arr = [];   //店家排序陣列

  if (!shop_data) {
    console.error("Shop data is undefined or null");
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

  // 搜尋字串與店家名稱全長相同，移到首位
  if (index_arr.length > 1) {
    for (let i=0; i<index_arr.length; i++) {
      if (index_arr[i].index > 0) continue;
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
      return a.index > b.index ? 1 : -1;
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
// 拼音搜尋店家
function search_shop_by_pinyin(shop_data, query_str) {
  if (!shop_data) {
    console.error("Shop data is undefined or null");
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
    console.error("Shop data is undefined or null");
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
      
      /*
      let reg = new RegExp(query_pinyin);
      let arr = shop_pinyin.match(reg);
      if (arr != null) {
        //console.log('query_pinyin: '+arr[0]);
        //console.log('index: '+arr['index']);
        let index = arr['index'];
        
      }
      */
      
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
        
        index_arr.push({'index':c_index, 'match_str':match_str, 'shop_id':shop_id});
      }
    }
  }

  // 搜尋字串與店家拼音全長相同，移到首位
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
      return a.index > b.index ? 1 : -1;
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
    console.error("callers data is undefined or null");
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
            let address = shop_data[shop_id].address;
            if ('callers' in shop_data[shop_id]) {
              let callers = shop_data[shop_id].callers;
              
              if (caller_id in callers) {
                if (input_num == "") {  // 若有輸入號碼，表示設定通知號碼，不需更新 focusCaller
                  // 更新 focusCaller
                  let focus_caller = {};
                  focus_caller['shop_id'] = shop_id;
                  focus_caller['caller_id'] = caller_id;
                  let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                  //await userRef.child('focusCaller').set(focus_caller);
                  userRef.child('focusCaller').set(focus_caller);
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
                    /*
                    await userEventRef.set({
                        "user_num": user_num,
                        "notify_num": notify_num,
                        "notified": false,
                        "timestamp": admin.database.ServerValue.TIMESTAMP
                    }); 
                    */
                    userEventRef.set({
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
                  replyMsgs.push(reply_msg.query_num('reply', shop_id, caller_id, shop_name, address, caller_name, curr_num, prev_num, change_time, update_time, last_update, user_num, notify_num));
                }
                else {  // 尚未設定叫號，只顯示叫號機資訊
                  replyMsgs.push(reply_msg.caller_info(shop_id, caller_id, shop_name, address, caller_name, curr_num, prev_num, change_time, update_time, last_update));
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
                        let search_obj = search_shop(shop_data, userMsg, true, 10);   // 模糊搜尋
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
                            adv_obj_s = adv_search_shop(shop_data, userMsg, 10);
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
                      
                      if (resultCount > 1 || b_select_shop) { // 找到多個店家 或 結果是同音搜尋
                          // 進階搜尋的結果, 需要進行排序
                          if (adv_caller_str != "") {
                            // 將 adv_caller_str 儲存到資料庫，待使用者選完店家後繼續進行
                            let focus_caller = {};
                            focus_caller["shop_id"] = "";
                            focus_caller["caller_id"] = "";
                            focus_caller["adv_caller_str"] = adv_caller_str;
                            focus_caller["caller_str_len_obj"] = caller_str_len_obj;
                            let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                            await userRef.child('focusCaller').set(focus_caller);
                            
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
                                    let userRef = lineUserMsgDB.ref(`lineUserMsg/${user_id}`);
                                    await userRef.child('focusCaller').set(focus_caller);
                                
                                    // 進行額外事件 
                                    msgType = 'number';
                                    userMsg = extra_number;
                                    b_done = false;
                                    break;  // 離開 switch case
                                  }
                                //}
                              }
                              
                              /*
                              // 仍未找到叫號機，使用 msgType = 'text' 重新搜尋
                              if (caller_id == "") {  
                                // 進行額外事件
                                msgType = 'text';
                                userMsg = p_shop_name+";"+caller_name;
                                console.log(userMsg);
                                b_done = false;
                                break;  // 離開 switch case
                              }
                              */
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
            //console.log(JSON.stringify(replyMsgs[0]));
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

    app.get('/status', (req, res) => {
        res.send('Server is running');
    });

    // (未採用) 圖文選單 "搜尋店家" 
    app.get('/shops', (req, res) => {
        res.sendFile(path.join(__dirname, '/data/shops.html'));
    });

    let LineConfig_test = await fs.readFile('./data/lineConfig_test.json', 'utf8');
    let config_test = JSON.parse(LineConfig_test);

    /*
    // 轉送到 測試伺服器
    app.post('/test_server', line.middleware(config_test), async (req, res) => {

      console.log("[test_server]");      

      for (let event of req.body.events) {
        let user_id = (event.source)? event.source.userId:"";
        let user_msg = (event.message)? event.message.text:"";
        console.log("user_id: "+user_id);
        console.log("user_msg: "+user_msg);
      }
      
      res.redirect(307, 'http://35.201.187.91:3600/webhook');
      console.log("redirect to test_server");      
    });
    */

    app.post('/test_server', (req, res) => {

      console.log("[test_server]");      

      console.log("req: "+req);

      /*
      for (let event of req.body.events) {
        let user_id = (event.source)? event.source.userId:"";
        let user_msg = (event.message)? event.message.text:"";
        console.log("user_id: "+user_id);
        console.log("user_msg: "+user_msg);
      }
      */
      
      res.redirect(307, 'http://35.201.187.91:3600/webhook');
      console.log("redirect to test_server");      
    });


    // (未採用) for line liff 
    app.get('/search', async (req, res) => {
      console.log(req.query);
      
      let user_id = req.query.user_id;
      let shop_name = req.query.shop_name;
      let caller_name = req.query.caller_name;
      
      await reply_qr_code(user_id, shop_name, caller_name);      
            
      res.redirect('https://line.me/R/oaMessage/@callmeback');
    });
    
    app.listen(3000, () => {
        console.log('Listening on port 3000');
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
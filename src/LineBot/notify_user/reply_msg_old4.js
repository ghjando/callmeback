// 叫號機資訊
export function caller_info(shop_id, caller_id, shop_name, address, caller_name, curr_num, prev_num, change_time, update_time, last_update, booking_url, booking_phone) {

  /*
  // 如果地址長度小於 6，不搜尋 Google Map
  let b_google_map = true;
  if (address_fix.length <= 6) b_google_map = false;
  */

  // 判斷是否可使用 Google Map 搜尋
  let b_google_map = false;
  let address_fix = address;  
  // 尋找地址中最後的 "號" 或 "号" (若有英文地址，需另行修改)
  let reg = /\d+( |　)*(號|号)/g;
  let arr;
  let lastIndex = -1;
  while ((arr = reg.exec(address)) !== null) {
    //console.log(`Found ${arr[0]}. Next starts at ${reg.lastIndex}.`);
    lastIndex = reg.lastIndex;  // 相符字串 "下一個字 的 index"
  }
  //console.log("lastIndex: "+lastIndex);
  if (lastIndex != -1) {
    // 地址有 "號" 或 "号"，才進行 Google Map 搜尋
    b_google_map = true;
    // address 移除 "號" 後面的文字 (配合 Google Map 搜尋)
    address_fix = address.substr(0,lastIndex);
  }

  // 資料更新時間
  let update_time_text = "資料更新於"+update_time;
  let update_time_color = "#999999";
  
  // 離線或休息中
  if (last_update==10 || last_update==-1) {
    update_time_text = "目前離線或休息中";
    update_time_color = "#FF0000";
  }
  else if (last_update>=1 && last_update<=9) {
    update_time_text = "已離線"+last_update+"分鐘";
    update_time_color = "#FF0000";
  }    

  // liff 網址
  let shop_name_url = encodeURIComponent(`https://www.mainpi.com/query?i=${shop_id}`);
  let shop_name_liff = `https://liff.line.me/2003918297-RwqPbwG5?url=${shop_name_url}`;
  let address_url = encodeURIComponent(`https://www.google.com/maps/search/?api=1&query=${address_fix} ${shop_name}`);
  let address_liff = `https://liff.line.me/2003918297-RwqPbwG5?url=${address_url}`;
  //let booking_url_encoded = encodeURIComponent(booking_url);
  //let booking_liff = `https://liff.line.me/2003918297-RwqPbwG5?url=${booking_url_encoded}`;
  
  // 免排預約網頁 需使用外部流灠器
  let booking_external = `${booking_url}&openExternalBrowser=1`;
  
  /*
  // 測試資料
  if (shop_id == "2391") {
    if (booking_url != "" && booking_phone == "") {
      let booking_url_encoded = encodeURIComponent(booking_url);
      booking_external = `https://trial.callmeback.com.tw/booking?booking_url=${booking_url_encoded}&openExternalBrowser=1`;
    }
    if (booking_url == "" && booking_phone != "") {
      let booking_phone_encoded = encodeURIComponent(booking_phone);
      booking_phone = `https://trial.callmeback.com.tw/booking?booking_phone=${booking_phone_encoded}`;
    }
  }
  */
  
  let msg_obj =
  {
    "type": "flex",
    "altText": shop_name+" "+caller_name,
    "contents":{
      "type": "bubble",
      "size": "kilo",
      "body": {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "10px",
        "contents": [
          {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "box",
                    "layout": "horizontal",
                    "contents": [
                      {
                        "type": "text",
                        "text": ""+shop_name,
                        "weight": "bold",
                        "size": "lg",
                        "color": "#609040",
                        "flex": 0,
                        "decoration": "underline"
                      }
                    ],
                    "flex": 0,
                    "action": {
                      "type": "uri",
                      "label": "action",
                      //"uri": "https://line.me/R/oaMessage/@callmeback/?"+encodeURIComponent(shop_name)
                      //"uri": "https://www.mainpi.com/query?i="+shop_id
                      "uri": shop_name_liff
                    }
                  }
                ],
                "paddingEnd": "7px"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": (address=="")? " ":address,
                    "color": "#999999",
                    "size": "sm",
                    "weight": "bold",
                    "decoration": "underline",
                    "action": {
                      "type": "uri",
                      "label": "action",
                      //"uri": "http://www.google.com.tw/maps/place/"+encodeURIComponent(address_fix)
                      //"uri": "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address_fix+" "+shop_name)
                      "uri": address_liff
                    }
                  }
                ],
                "paddingEnd": "7px"
              },          
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "box",
                    "layout": "baseline",
                    "contents": [
                      {
                        "type": "icon",
                        //"url": "https://i.ibb.co/0JDVfcr/list-box-svgrepo-com.png",
                        "url": "https://storage.googleapis.com/callme-398802_linebot_data/icons/list-box-svgrepo-com.png",
                        "size": "24px",
                        "offsetTop": "1px"
                      }
                    ],
                    "action": {
                      "type": "postback",
                      "label": "換叫號機",
                      "data": `action=換叫號機&shop_id=${shop_id}`
                    },
                    "height": "24px",
                    "width": "24px"
                  },
                  {
                    "type": "box",
                    "layout": "horizontal",
                    "contents": [
                      {
                        "type": "text",
                        "text": ""+caller_name,
                        "weight": "bold",
                        "size": "lg",
                        "color": "#306090",
                        "flex": 0
                      }
                    ],
                    "flex": 0,
                    "action": {
                      "type": "postback",
                      "label": "換叫號機",
                      "data": `action=換叫號機&shop_id=${shop_id}`
                    }
                  }
                ],
                "paddingEnd": "7px",
                "offsetStart": "-2px"
              }
            ]
          },
          {
            "type": "separator",
            "margin": "xl",
            "color": "#FFFFFF"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": "當前號碼",
                "size": "md",
                "weight": "bold",
                "flex": 0
              },
              {
                "type": "text",
                "text": curr_num + "號",
                "color": "#FF0000",
                "size": "md",
                "weight": "bold",
                "margin": "lg"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": "叫號查詢",
                    "size": "sm",
                    "weight": "bold",
                    "contents": [],
                    "color": "#FFFFFF",
                    "align": "center"
                  }
                ],
                "backgroundColor": "#6C757D",
                "cornerRadius": "md",
                "action": {
                  "type": "postback",
                  "label": "叫號查詢",
                  "data": `action=叫號查詢&shop_id=${shop_id}&caller_id=${caller_id}`
                },
                "width": "72px",
                "paddingAll": "xs"
              }
            ],
            "paddingEnd": "7px"
          },
          {
            "type": "separator",
            "margin": "xs",
            "color": "#FFFFFF"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": "上次號碼",
                "size": "md",
                "weight": "bold",
                "flex": 0
              },
              {
                "type": "text",
                "text": (prev_num!="")? (prev_num+"號 - "+change_time):change_time,
                "color": "#999999",
                "size": "md",
                "weight": "bold",
                "margin": "lg"
              }
            ]
          },
          {
            "type": "separator",
            "margin": "sm",
            "color": "#FFFFFF"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": "立即預約",
                "color": "#0D6EFD",
                "size": "sm",
                "weight": "bold",
                "align": "start",
                "decoration": "underline",
                "action": {
                  "type": "uri",
                  "label": "action",
                  //"uri": booking_url
                  //"uri": booking_liff
                  "uri": booking_external
                },
                "flex": 0
              },
              {
                "type": "text",
                "text": update_time_text,
                "color": update_time_color,
                "size": "sm",
                "weight": "bold",
                "align": "end"
              }
            ],
            "margin": "xl"
          }
        ]
      }
    }
  };

  // 刪除不使用的項目 (先刪除"後面"的項目)
  
  // 動態調整 "立即預約" 內容
  if (booking_url == "" && booking_phone == "") {         // 移除 "立即預約"
    msg_obj["contents"]["body"]["contents"][6]["contents"].splice(0,1);
  }
  else if (booking_url == "" && booking_phone != "") {    // 改成 "電話預約"
    //舊版-直接撥打電話
    //msg_obj["contents"]["body"]["contents"][6]["contents"][0]["action"]["uri"] = booking_phone;
    
    msg_obj["contents"]["body"]["contents"][6]["contents"][0]["action"] = {"type":"postback", "label":"action", "data":`action=電話預約&booking_phone=${booking_phone}`};
  }
  else if (booking_url != "" && booking_phone != "") {    // 選擇預約方式
    msg_obj["contents"]["body"]["contents"][6]["contents"][0]["action"] = {"type":"postback", "label":"action", "data":`action=選擇預約方式&booking_url=${booking_url}&booking_phone=${booking_phone}`};
  }

  // 移除 "叫號機名稱"
  if (caller_name == "") {
    msg_obj["contents"]["body"]["contents"][0]["contents"].splice(2,1);
  }
  
  // 不使用 Google Map 搜尋，移除 action
  if (!b_google_map) {
    //delete msg_obj["contents"]["body"]["contents"][0]["contents"][1]["contents"][0].action;
    //delete msg_obj["contents"]["body"]["contents"][0]["contents"][1]["contents"][0].decoration;
  }
  
  return msg_obj; 
}


// 選擇店家
export function select_shop(shop_arr, max_num) {
  let content_arr = 
  [
    {
      "type": "text",
      "text": "請選擇店家：(直接點選)"
      //"wrap": true
    }
  ];
  
  for (let i=0; i<shop_arr.length; i++) {
    if (i == max_num) break;
    
    let item_obj =
    {
      "type": "separator",
      "margin": (i==0)? "lg":"md",
      "color": "#FFFFFF"      
    }
    content_arr.push(item_obj);
    
    item_obj =
    {
      "type": "text",
      "text": shop_arr[i],
      "action": {
        "type": "postback",
        "label": shop_arr[i].substr(0,40),
        "data": shop_arr[i]
      },
      "color": "#406898"
    }    
    content_arr.push(item_obj);
  }

  if (shop_arr.length > max_num) {
    content_arr.push({
      "type": "text",
      "text": "......"
    });      
    content_arr.push({
      "type": "text",
      "text": `有太多符合的資料\n請輸入更詳細的名稱重新搜尋`,
      "wrap": true
    });
  }
  
  let msg_obj =
  {
    "type": "flex",
    "altText": "請選擇店家：(直接點選)",
    "contents":{
      "type": "bubble",
      "size": "kilo",
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": content_arr
      }
    }
  }

  return msg_obj;   
}

// 選擇叫號機
export function select_caller(shop_id, shop_name, caller_id_arr, caller_name_arr, max_num, booking_url, booking_phone) {
  // liff 網址
  // let booking_url_encoded = encodeURIComponent(booking_url);
  // let booking_liff = `https://liff.line.me/2003918297-RwqPbwG5?url=${booking_url_encoded}`;

  // 免排預約網頁 需使用外部流灠器
  let booking_external = `${booking_url}&openExternalBrowser=1`;

  /*
  // 測試資料
  if (shop_id == "2391") {
    if (booking_url != "" && booking_phone == "") {
      let booking_url_encoded = encodeURIComponent(booking_url);
      booking_external = `https://trial.callmeback.com.tw/booking?booking_url=${booking_url_encoded}&openExternalBrowser=1`;
    }
    if (booking_url == "" && booking_phone != "") {
      let booking_phone_encoded = encodeURIComponent(booking_phone);
      booking_phone = `https://trial.callmeback.com.tw/booking?booking_phone=${booking_phone_encoded}`;
    }
  }
  */

  let content_arr = 
  [
    {
      "type": "text",
      "text": shop_name + "\n請選擇叫號機：(直接點選)",
      "wrap": true
    }
  ];
  
  for (let i=0; i<caller_name_arr.length; i++) {
    if (i == max_num) break;
    
    let item_obj =
    {
      "type": "separator",
      "margin": (i==0)? "lg":"md",
      "color": "#FFFFFF"      
    }
    content_arr.push(item_obj);
    
    // 如果是最後一項，要加上 "立即預約"
    if (i==max_num-1 || i==caller_name_arr.length-1) {
      item_obj =
      {
        "type": "box",
        "layout": "horizontal",
        "contents": [
          {
            "type": "text",
            "text": caller_name_arr[i],
            "action": {
              "type": "postback",
              "label": caller_name_arr[i].substr(0,40),
              "data": `action=選取叫號機&shop_id=${shop_id}&caller_id=${caller_id_arr[i]}`
            },
            "color": "#406898"
          },
          {
            "type": "text",
            "text": "立即預約",
            "color": "#0D6EFD",
            "size": "sm",
            "weight": "bold",
            "decoration": "underline",
            "action": {
              "type": "uri",
              "label": "action",
              //"uri": booking_liff
              "uri": booking_external
            },
            "flex": 0,
            "gravity": "bottom",
            "margin": "lg"
          }
        ]
      }
      
      // 動態調整 "立即預約" 內容
      if (booking_url == "" && booking_phone == "") {         // 移除 "立即預約"
        item_obj["contents"].splice(1,1);
      }
      else if (booking_url == "" && booking_phone != "") {    // 改成 "電話預約"
        //舊版-直接撥打電話
        //item_obj["contents"][1]["action"]["uri"] = booking_phone;
        
        item_obj["contents"][1]["action"] = {"type":"postback", "label":"action", "data":`action=電話預約&booking_phone=${booking_phone}`};
      }
      else if (booking_url != "" && booking_phone != "") {    // 選擇預約方式
        item_obj["contents"][1]["action"] = {"type":"postback", "label":"action", "data":`action=選擇預約方式&booking_url=${booking_url}&booking_phone=${booking_phone}`};
      }
    }
    else {
      item_obj =
      {
        "type": "text",
        "text": caller_name_arr[i],
        "action": {
          "type": "postback",
          "label": caller_name_arr[i].substr(0,40),
          "data": `action=選取叫號機&shop_id=${shop_id}&caller_id=${caller_id_arr[i]}`
        },
        "color": "#406898"
      }
    }
      
    content_arr.push(item_obj);
  }

  if (caller_name_arr.length > max_num) {
    content_arr.push({
      "type": "text",
      "text": "......"
    });      
    content_arr.push({
      "type": "text",
      "text": `叫號機數量過多，無法全部顯示\n`,
      "wrap": true
    });
  }
  
  let msg_obj =
  {
    "type": "flex",
    "altText": shop_name + "\n請選擇叫號機：(直接點選)",
    "contents":{
      "type": "bubble",
      "size": "kilo",
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": content_arr
      }
    }
  }

  return msg_obj;   
}

// 選擇預約方式
export function select_booking_type(post_msg) {
  // liff 網址
  // let booking_url_encoded = encodeURIComponent(post_msg.booking_url);
  // let booking_liff = `https://liff.line.me/2003918297-RwqPbwG5?url=${booking_url_encoded}`;
    
  // 免排預約網頁 需使用外部流灠器
  let booking_external = `${post_msg.booking_url}&openExternalBrowser=1`;

  /*
  // 測試資料
  if (shop_id == "2391") {
    if (booking_url != "") {
      let booking_url_encoded = encodeURIComponent(booking_url);
      booking_external = `https://trial.callmeback.com.tw/booking?booking_url=${booking_url_encoded}&openExternalBrowser=1`;
    }
    if (booking_phone != "") {
      let booking_phone_encoded = encodeURIComponent(booking_phone);
      booking_phone = `https://trial.callmeback.com.tw/booking?booking_phone=${booking_phone_encoded}`;
    }
  }
  */

  let content_arr = 
  [
    {
      "type": "text",
      "text": "請選擇預約方式："
    }
  ];
  
  let item_obj =
  {
    "type": "separator",
    "margin": "lg",
    "color": "#FFFFFF"      
  }
  content_arr.push(item_obj);
  
  // 加入 "網路預約" 項目
  item_obj =
  {
    "type": "text",
    "text": "網路預約",
    "action": {
      "type": "uri",
      "label": "action",
      //"uri": booking_liff
      "uri": booking_external
    },
    "color": "#406898",
    "decoration": "underline"
  }    
  content_arr.push(item_obj);

  item_obj =
  {
    "type": "separator",
    "margin": "md",
    "color": "#FFFFFF"      
  }
  content_arr.push(item_obj);
  
  // 加入 "電話預約" 項目
  item_obj =
  {
    "type": "text",
    "text": "電話預約",
    
    /*
    //舊版-直接撥打電話
    "action": {
      "type": "uri",
      "label": "action",
      "uri": `${post_msg.booking_phone}`
    },
    */
    
    "action": {
      "type": "postback",
      "label": "action",
      "data": `action=電話預約&booking_phone=${post_msg.booking_phone}`
    },
    
    "color": "#406898",
    "decoration": "underline"
  }    
  content_arr.push(item_obj);

  let msg_obj =
  {
    "type": "flex",
    "altText": "請選擇預約方式：",
    "contents":{
      "type": "bubble",
      "size": "kilo",
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": content_arr
      }
    }
  }

  return msg_obj;   
}

// 叫號查詢
export function query_num(msg_type, shop_id, caller_id, shop_name, address, caller_name, curr_num, prev_num, change_time, update_time, last_update, reply_type, notify_num) {
  
  /*
  // 如果地址長度小於 6，不搜尋 Google Map
  let b_google_map = true;
  if (address_fix.length <= 6) b_google_map = false;
  */

  // 判斷是否可使用 Google Map 搜尋
  let b_google_map = false;
  let address_fix = address;  
  // 尋找地址中最後的 "號" 或 "号" (若有英文地址，需另行修改)
  let reg = /\d+( |　)*(號|号)/g;
  let arr;
  let lastIndex = -1;
  while ((arr = reg.exec(address)) !== null) {
    //console.log(`Found ${arr[0]}. Next starts at ${reg.lastIndex}.`);
    lastIndex = reg.lastIndex;  // 相符字串 "下一個字 的 index"
  }
  //console.log("lastIndex: "+lastIndex);
  if (lastIndex != -1) {
    // 地址有 "號" 或 "号"，才進行 Google Map 搜尋
    b_google_map = true;
    // address 移除 "號" 後面的文字 (配合 Google Map 搜尋)
    address_fix = address.substr(0,lastIndex);
  }

  // 資料更新時間
  let update_time_text = "資料更新於"+update_time;
  let update_time_color = "#999999";
  
  // 離線或休息中
  if (last_update==10 || last_update==-1) {
    update_time_text = "目前離線或休息中";
    update_time_color = "#FF0000";
  }
  else if (last_update>=1 && last_update<=9) {
    update_time_text = "已離線"+last_update+"分鐘";
    update_time_color = "#FF0000";
  }    

  // liff 網址
  let shop_name_url = encodeURIComponent(`https://www.mainpi.com/query?i=${shop_id}`);
  let shop_name_liff = `https://liff.line.me/2003918297-RwqPbwG5?url=${shop_name_url}`;
  let address_url = encodeURIComponent(`https://www.google.com/maps/search/?api=1&query=${address_fix} ${shop_name}`);
  let address_liff = `https://liff.line.me/2003918297-RwqPbwG5?url=${address_url}`;
    
  let msg_obj =
  {
    "type": "flex",
    "altText": "將於"+notify_num+"號通知你",
    "contents":{
      "type": "bubble",
      "size": "kilo",
      "body": {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "10px",
        "contents": [
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "contents": [
                  {
                    "type": "icon",
                    //"url": "https://i.ibb.co/SXHT0tW/circle-info-solid.png",
                    "url": "https://storage.googleapis.com/callme-398802_linebot_data/icons/circle-info-solid.png",
                    "size": "md",
                    "offsetTop": "xs"
                  }
                ],
                "width": "18px"
              },
              {
                "type": "text",
                "text": "將於",
                "color": "#052C65",
                "size": "md",
                "weight": "bold",
                "flex": 0
              },
              {
                "type": "text",
                "text": ""+notify_num,
                "color": "#FF0000",
                "size": "md",
                "weight": "bold",
                "flex": 0
              },
              {
                "type": "text",
                "text": "號通知你",
                "color": "#052C65",
                "size": "md",
                "weight": "bold"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": "取消通知",
                    "size": "sm",
                    "weight": "bold",
                    "contents": [],
                    "color": "#FFFFFF",
                    "align": "center"
                  }
                ],
                "backgroundColor": "#0D6EFD",
                "cornerRadius": "md",
                "paddingAll": "xs",
                "action": {
                  "type": "postback",
                  "label": "取消通知",
                  "data": `action=取消通知&shop_id=${shop_id}&caller_id=${caller_id}`
                },
                "width": "72px"
              }
            ],
            "backgroundColor": "#CFE2FF",
            "cornerRadius": "md",
            "paddingAll": "7px"
          },
          {
            "type": "separator",
            "margin": "xxl",
            "color": "#FFFFFF"
          },
          {
            "type": "box",
            "layout": "vertical",
            "contents": [
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "box",
                    "layout": "horizontal",
                    "contents": [
                      {
                        "type": "text",
                        "text": ""+shop_name,
                        "weight": "bold",
                        "size": "lg",
                        "color": "#609040",
                        "flex": 0,
                        "decoration": "underline"
                      }
                    ],
                    "flex": 0,
                    "action": {
                      "type": "uri",
                      "label": "action",
                      //"uri": "https://line.me/R/oaMessage/@callmeback/?"+encodeURIComponent(shop_name)
                      //"uri": "https://www.mainpi.com/query?i="+shop_id
                      "uri": shop_name_liff
                    }
                  }
                ],
                "paddingEnd": "7px"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": (address=="")? " ":address,
                    "color": "#999999",
                    "size": "sm",
                    "weight": "bold",
                    "decoration": "underline",
                    "action": {
                      "type": "uri",
                      "label": "action",
                      //"uri": "http://www.google.com.tw/maps/place/"+encodeURIComponent(address_fix)
                      //"uri": "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address_fix+" "+shop_name)
                      "uri": address_liff
                    }
                  }
                ],
                "paddingEnd": "7px"
              },          
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "box",
                    "layout": "baseline",
                    "contents": [
                      {
                        "type": "icon",
                        //"url": "https://i.ibb.co/0JDVfcr/list-box-svgrepo-com.png",
                        "url": "https://storage.googleapis.com/callme-398802_linebot_data/icons/list-box-svgrepo-com.png",
                        "size": "24px",
                        "offsetTop": "1px"
                      }
                    ],
                    "action": {
                      "type": "postback",
                      "label": "換叫號機",
                      "data": `action=換叫號機&shop_id=${shop_id}`
                    },
                    "height": "24px",
                    "width": "24px"
                  },
                  {
                    "type": "box",
                    "layout": "horizontal",
                    "contents": [
                      {
                        "type": "text",
                        "text": ""+caller_name,
                        "weight": "bold",
                        "size": "lg",
                        "color": "#306090",
                        "flex": 0
                      }
                    ],
                    "flex": 0,
                    "action": {
                      "type": "postback",
                      "label": "換叫號機",
                      "data": `action=換叫號機&shop_id=${shop_id}`
                    }
                  }
                ],
                "paddingEnd": "7px",
                "offsetStart": "-2px"
              }
            ]
          },
          {
            "type": "separator",
            "margin": "xl",
            "color": "#FFFFFF"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": "當前號碼",
                "size": "md",
                "weight": "bold",
                "flex": 0
              },
              {
                "type": "text",
                "text": curr_num+"號",
                "color": "#FF0000",
                "size": "md",
                "weight": "bold",
                "margin": "lg"
              },
              {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                  {
                    "type": "text",
                    "text": "叫號查詢",
                    "size": "sm",
                    "weight": "bold",
                    "contents": [],
                    "color": "#FFFFFF",
                    "align": "center"
                  }
                ],
                "backgroundColor": "#6C757D",
                "cornerRadius": "md",
                "action": {
                  "type": "postback",
                  "label": "叫號查詢",
                  "data": `action=叫號查詢&shop_id=${shop_id}&caller_id=${caller_id}`
                },
                "paddingAll": "xs",
                "width": "72px"
              }
            ],
            "paddingEnd": "7px"
          },
          {
            "type": "separator",
            "margin": "xs",
            "color": "#FFFFFF"
          },
          {
            "type": "box",
            "layout": "horizontal",
            "contents": [
              {
                "type": "text",
                "text": "上次號碼",
                "size": "md",
                "weight": "bold",
                "flex": 0
              },
              {
                "type": "text",
                "text": (prev_num!="")? (prev_num+"號 - "+change_time):change_time,
                "color": "#999999",
                "size": "md",
                "weight": "bold",
                "margin": "lg"
              }
            ]
          },
          {
            "type": "separator",
            "margin": "sm",
            "color": "#FFFFFF"
          },
          {
            "type": "text",
            "text": update_time_text,
            "color": update_time_color,
            "size": "sm",
            "weight": "bold",
            "margin": "xl",
            "align": "end"
          }
        ]
      }
    }
  };
  
  // 刪除不使用的項目 (先刪除"後面"的項目)
  if (caller_name == "") {
    // 移除 "叫號機名稱"
    msg_obj["contents"]["body"]["contents"][2]["contents"].splice(2,1);
  }

  // 不使用 Google Map 搜尋，移除 action
  if (!b_google_map) {
    //delete msg_obj["contents"]["body"]["contents"][2]["contents"][1]["contents"][0].action;
    //delete msg_obj["contents"]["body"]["contents"][2]["contents"][1]["contents"][0].decoration;
  }
  
  // 依 msg_type 及 reply_type 變更 通知訊息 的 圖示及顏色
  if (msg_type=='notify' || reply_type == "已到號") {
    msg_obj["altText"] = "已經到號了";
    msg_obj["contents"]["body"]["contents"][0] = 
    {
      "type": "box",
      "layout": "horizontal",
      "contents": [
        {
          "type": "box",
          "layout": "baseline",
          "contents": [
            {
              "type": "icon",
              //"url": "https://i.ibb.co/n6ddzTt/triangle-exclamation-solid.png",
              "url": "https://storage.googleapis.com/callme-398802_linebot_data/icons/triangle-exclamation-solid.png",
              "size": "md",
              "offsetTop": "xs"
            }
          ],
          "width": "18px"
        },
        {
          "type": "text",
          "text": "已經到號了",
          //"color": "#58151C",
          "color": "#664D03",
          "size": "md",
          "weight": "bold",
          "flex": 0
        }
      ],
      //"backgroundColor": "#F8D7DA",
      "backgroundColor": "#FFF3CD",
      "cornerRadius": "md",
      "paddingAll": "md"
    };
  }  
  else if (reply_type == "已過號") {
    msg_obj["altText"] = "已經過號了";
    msg_obj["contents"]["body"]["contents"][0] = 
    {
      "type": "box",
      "layout": "horizontal",
      "contents": [
        {
          "type": "box",
          "layout": "baseline",
          "contents": [
            {
              "type": "icon",
              //"url": "https://i.ibb.co/fCZW7YX/triangle-exclamation-solid-red.png",
              "url": "https://storage.googleapis.com/callme-398802_linebot_data/icons/triangle-exclamation-solid-red.png",
              "size": "md",
              "offsetTop": "xs"
            }
          ],
          "width": "18px"
        },
        {
          "type": "text",
          "text": "已經過號了",
          "color": "#58151C",
          "size": "md",
          "weight": "bold",
          "flex": 0
        }
      ],
      "backgroundColor": "#F8D7DA",
      "cornerRadius": "md",
      "paddingAll": "md"
    };
  }
  if (reply_type == "即將到號") {
    msg_obj["altText"] = "即將到號，建議到現場等待";
    msg_obj["contents"]["body"]["contents"][0] = 
    {
      "type": "box",
      "layout": "horizontal",
      "contents": [
        {
          "type": "box",
          "layout": "baseline",
          "contents": [
            {
              "type": "icon",
              //"url": "https://i.ibb.co/n6ddzTt/triangle-exclamation-solid.png",
              "url": "https://storage.googleapis.com/callme-398802_linebot_data/icons/triangle-exclamation-solid.png",
              "size": "md",
              "offsetTop": "xs"
            }
          ],
          "width": "18px"
        },
        {
          "type": "text",
          "text": "即將到號，建議到現場等待",
          //"color": "#58151C",
          "color": "#664D03",
          "size": "md",
          "weight": "bold",
          "flex": 0
        }
      ],
      //"backgroundColor": "#F8D7DA",
      "backgroundColor": "#FFF3CD",
      "cornerRadius": "md",
      "paddingAll": "md"
    };
  }  
    
  return msg_obj; 
}
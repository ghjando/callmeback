
const numlog_data = require("./shop_ranking_data/call-num-log.json");
const shop_data = require("./shop_ranking_data/shop-list.json");
//const fs = require('fs');
const chokidar = require('chokidar');

// 製作 店家活躍度排行
async function create_shop_ranking() {
  let date_obj = new Date();

  // 計算 店家活躍度排行 起迄日期
  let start_date_obj = new Date();
  start_date_obj.setDate(date_obj.getDate()-7);
  let start_year = start_date_obj.getFullYear();
  let start_month = ("00"+(start_date_obj.getMonth()+1)).substr(-2);
  let start_day = ("00"+start_date_obj.getDate()).substr(-2);
  //let start_str = `${start_year}${start_month}${start_day}`;
  let start_str = "20240220";
  
  let end_date_obj = new Date();
  end_date_obj.setDate(date_obj.getDate()-1);
  let end_year = end_date_obj.getFullYear();
  let end_month = ("00"+(end_date_obj.getMonth()+1)).substr(-2);
  let end_day = ("00"+end_date_obj.getDate()).substr(-2);
  //let end_str = `${end_year}${end_month}${end_day}`;
  let end_str = "20240226";

  // 製作 店家活躍度排行
  let shop_ranking = [];
  // if (numlog_snapshot.exists()) {
    //let numlog_data = numlog_snapshot.val();
    for (let shop_id in shop_data) {
      //if (shop_id >= 300) continue;
      let shop_name = shop_data[shop_id].name;
      let customer_count = 0;
      for (let caller_id in shop_data[shop_id].callers) {
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
      shop_ranking.push({
        'id': shop_id,
        'name': shop_name,
        'customer_count': customer_count
      });
    }
    shop_ranking = shop_ranking.sort(function (a, b) {
      return a.customer_count > b.customer_count ? -1 : 1;
    });
    
    // 創建寫入流
    const ws = fs.createWriteStream('./shop_ranking.txt');
    // 寫入內容
    ws.write('店家ID,跳號數,店家名稱\n');
    for (let i=0; i<shop_ranking.length; i++) {
      ws.write(shop_ranking[i].id+','+shop_ranking[i].customer_count+','+shop_ranking[i].name+'\n');
    }
    //關閉寫入流
    ws.close();

    /*
    fs.writeFile("shop_ranking.json", JSON.stringify(JSON.parse(JSON.stringify(shop_ranking))), function(err) {
        if (err) {
            console.log(err);
        }
    });    
    */
  // }    
}

async function main() {
  //console.log(JSON.stringify(numlog_data['1003-0']['202402']['14']['14:36:58']));
  //return;

  // 製作 店家活躍度排行
  // create_shop_ranking();
  
  /*
  fs.watch("../common_data/shop_data.json", (eventType, filename) => {
    console.log("\nThe file", filename, "was modified!");
    console.log("The type of change was:", eventType);
  });  
  */
  
  console.log('1');
  chokidar.watch('../common_data/shop_data.json').on('change', (path, stats) => {
    //console.log(path, stats);
    console.log('2');  
  });
  console.log('3');  
}

main();



const shop_data = require("../common_data/shop_data.json");
const fs = require('fs');
const path = require("path");
const iconv = require("iconv-lite");  //編碼轉換


// 判斷是否為數字
function isNum(val) {
  return !isNaN(val);
}

// 取得 年月日字串 "yyyymmdd"
function get_ymd(date_object) {
  let year = date_object.getFullYear();
  let month = ("00"+(date_object.getMonth()+1)).substr(-2);
  let day = ("00"+date_object.getDate()).substr(-2);
  let ymd = `${year}${month}${day}`;
  return ymd;
}

// 製作 店家使用人數季報
async function create_users_num_season_report() {
  let end_date_obj;   // 報表結束日期
  let end_date;       // yyyymmdd

  if (process.argv.length < 3) {  // 未輸入 報表結束日期
    // 報表結束日期 = 取得前一個 星期天 的日期
    let today = new Date();
    let week_day = today.getDay();  // 取得今天星期幾 (Sunday - Saturday : 0 - 6)
    end_date_obj = new Date(Date.now()-1000*60*60*24*week_day);
    end_date = get_ymd(end_date_obj);
  }
  else { // 有輸入 報表結束日期
    end_date = process.argv[2];
    if (isNum(end_date) && end_date.length==8) {
      let year = end_date.substr(0,4);
      let month = parseInt(end_date.substr(4,2), 10)-1;
      let day = end_date.substr(6,2);
      end_date_obj = new Date(year, month, day);
    }
    else {
      console.log('日期格式錯誤!! (format: yyyymmdd)');
      process.exit(1);
    }
  }

  // 統計 店家 每週使用人數 (共 10週)
  let user_count_obj = {};  // 存放 店家使用人數
  let week_title = []; // 存放 各週欄位名稱
  let start_date_obj = new Date(end_date_obj.getTime()-1000*60*60*24*69); // 報表開始日期
  for (let j=0; j<10; j++) {  //共 10週
    user_count_obj[j]={};
    for (let i=0; i<7; i++) { //每週 7天
      // 取得 usage_log 檔案路徑
      let file_date = get_ymd(new Date(start_date_obj.getTime()+1000*60*60*24*(j*7+i)));
      if (i==6) week_title.push(file_date); 
      let u_log_path = path.join(process.cwd(), `../common_data/usage_log/${file_date}.json`);
      
      // 統計 店家使用人數
      if (fs.existsSync(u_log_path)) {
        console.log(u_log_path);
        let u_log_file = await fs.readFileSync(u_log_path, 'utf8');
        let u_log_data = await JSON.parse(u_log_file);
        for (let shop_id in u_log_data) {
          if (shop_id in user_count_obj[j]) user_count_obj[j][shop_id] += Object.keys(u_log_data[shop_id]).length;
          else user_count_obj[j][shop_id] = Object.keys(u_log_data[shop_id]).length;
        }    
      }
    }
  }

  //製作 店家使用人數季報
  let users_num_season_report = [];
  
  for (let shop_id in shop_data) {
    let shop_name = shop_data[shop_id].name;
    let phone = shop_data[shop_id].phone;
    let address = shop_data[shop_id].address;
    
    users_num_season_report.push({
      'id': shop_id,
      'name': shop_name,
      'week9':(shop_id in user_count_obj['9'])? user_count_obj['9'][shop_id]:0,
      'week8':(shop_id in user_count_obj['8'])? user_count_obj['8'][shop_id]:0,
      'week7':(shop_id in user_count_obj['7'])? user_count_obj['7'][shop_id]:0,
      'week6':(shop_id in user_count_obj['6'])? user_count_obj['6'][shop_id]:0,
      'week5':(shop_id in user_count_obj['5'])? user_count_obj['5'][shop_id]:0,
      'week4':(shop_id in user_count_obj['4'])? user_count_obj['4'][shop_id]:0,
      'week3':(shop_id in user_count_obj['3'])? user_count_obj['3'][shop_id]:0,
      'week2':(shop_id in user_count_obj['2'])? user_count_obj['2'][shop_id]:0,
      'week1':(shop_id in user_count_obj['1'])? user_count_obj['1'][shop_id]:0,
      'week0':(shop_id in user_count_obj['0'])? user_count_obj['0'][shop_id]:0,
      'phone': phone,
      'address': address
    });
  }
  users_num_season_report = users_num_season_report.sort(function (a, b) {
    return b.week9 - a.week9;
  });
  
  // 創建寫入流
  const ws = fs.createWriteStream(`./users_num_season_report_${end_date}.csv`);
  // 寫入內容
  ws.write(`\uFEFF店家ID,店家名稱,${week_title[9]},${week_title[8]},${week_title[7]},${week_title[6]},${week_title[5]},${week_title[4]},${week_title[3]},${week_title[2]},${week_title[1]},${week_title[0]},電話,地址\n`); // 加入 BOM 檔頭 \uFEFF (for Excel)
  for (let i=0; i<users_num_season_report.length; i++) {
    let usr_obj = users_num_season_report[i];
    ws.write(usr_obj.id+','+usr_obj.name+','+usr_obj.week9+','+usr_obj.week8+','+usr_obj.week7+','+usr_obj.week6+','+usr_obj.week5+','+usr_obj.week4+','+usr_obj.week3+','+usr_obj.week2+','+usr_obj.week1+','+usr_obj.week0+','+usr_obj.phone+','+usr_obj.address+'\n');
  }
  //關閉寫入流
  ws.close();
}

async function main() {
  // 製作 店家使用人數季報
  create_users_num_season_report();
}

main();


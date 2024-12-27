
const shop_data = require("../common_data/shop_data.json");
const fs = require('fs');
const path = require("path");
const iconv = require("iconv-lite");  //編碼轉換

// 製作 店家活躍度排行
async function create_shop_ranking() {
  /*
  // 計算 店家活躍度排行 起迄日期
  let start_date_obj = new Date(Date.now()-1000*60*60*24*7);  // 7天前
  let start_year = start_date_obj.getFullYear();
  let start_month = ("00"+(start_date_obj.getMonth()+1)).substr(-2);
  let start_day = ("00"+start_date_obj.getDate()).substr(-2);
  //let start_date = `${start_year}${start_month}${start_day}`;
  let start_date = "20240219";
  
  let end_date_obj = new Date(Date.now()-1000*60*60*24*1);  // 1天前
  let end_year = end_date_obj.getFullYear();
  let end_month = ("00"+(end_date_obj.getMonth()+1)).substr(-2);
  let end_day = ("00"+end_date_obj.getDate()).substr(-2);
  //let end_date = `${end_year}${end_month}${end_day}`;
  let end_date = "20240512";
  */

  // 未輸入起迄日期
  if (process.argv.length < 4) {
    console.log('未輸入起迄日期...');
    process.exit();
  }

  let start_date = process.argv[2]; 
  let end_date = process.argv[3]; 

  // 讀取 usage_log 檔案列表
  let u_filenames = fs.readdirSync("../common_data/usage_log");
  
  // 統計 店家 使用次數
  let u_count_obj = {};
  for (let i=0; i<u_filenames.length; i++) {
    let ymd = path.parse(u_filenames[i]).name;
    if (ymd >= start_date && ymd <= end_date) {
      let u_log_file = await fs.readFileSync(`../common_data/usage_log/${u_filenames[i]}`, 'utf8');
      let u_log_data = await JSON.parse(u_log_file);

      // 特殊處理：弘宇診所 shop_id 從 1211 改成 2808
      for (let shop_id in u_log_data) {
        if (shop_id=='1211') {
          u_log_data['2808']=u_log_data['1211'];
          delete u_log_data['1211'];
        }
      }    
      
      for (let shop_id in u_log_data) {
        for (let user_id in u_log_data[shop_id]) {
          if (shop_id in u_count_obj) u_count_obj[shop_id] += Object.keys(u_log_data[shop_id][user_id]).length;
          else u_count_obj[shop_id] = Object.keys(u_log_data[shop_id][user_id]).length;
        }
      }    
    }
  }

  // 讀取 callnum_log 檔案列表
  let c_filenames = fs.readdirSync("../common_data/callnum_log");
  
  // 統計 叫號機 跳號次數
  let c_count_obj = {};
  for (let i=0; i<c_filenames.length; i++) {
    let ymd = path.parse(c_filenames[i]).name;
    if (ymd >= start_date && ymd <= end_date) {
      let c_log_file = await fs.readFileSync(`../common_data/callnum_log/${c_filenames[i]}`, 'utf8');
      let c_log_data = await JSON.parse(c_log_file);
      
      // 特殊處理：弘宇診所 caller_id 從 1211-0 改成 2808-0
      for (let caller_id in c_log_data) {
        if (caller_id=='1211-0') {
          c_log_data['2808-0']=c_log_data['1211-0'];
          delete c_log_data['1211-0'];
        }
      }    
      
      for (let caller_id in c_log_data) {
        if (caller_id in c_count_obj) c_count_obj[caller_id] += Object.keys(c_log_data[caller_id]).length;
        else c_count_obj[caller_id] = Object.keys(c_log_data[caller_id]).length;
      }    
    }
  }

  // 製作 店家活躍度排行
  let shop_ranking = [];
  
  for (let shop_id in shop_data) {
    let shop_name = shop_data[shop_id].name;
    let phone = shop_data[shop_id].phone;
    let address = shop_data[shop_id].address;
    
    // 記算店家跳號次數
    let customer_count = 0;
    for (let caller_id in shop_data[shop_id].callers) {
      if (caller_id in c_count_obj) {
        customer_count += c_count_obj[caller_id];
      }
    }
    
    shop_ranking.push({
      'id': shop_id,
      'name': shop_name,
      'phone': phone,
      'address': address,
      'customer_count': customer_count,
      'usage_count': (shop_id in u_count_obj)? u_count_obj[shop_id]:0
    });
  }
  shop_ranking = shop_ranking.sort(function (a, b) {
    return b.customer_count - a.customer_count;
  });
  
  // 創建寫入流
  const ws = fs.createWriteStream(`./shop_ranking_${start_date}~${end_date}.csv`);
  // 寫入內容
  //ws.write(iconv.encode('跳號數,使用次數,店家ID,店家名稱,電話,地址\n', 'big5'));
  ws.write('\uFEFF跳號數,使用次數,店家ID,店家名稱,電話,地址\n'); // 加入 BOM 檔頭 \uFEFF (for Excel)
  for (let i=0; i<shop_ranking.length; i++) {
    let sr_obj = shop_ranking[i];
    //let text = sr_obj.customer_count+','+sr_obj.usage_count+','+sr_obj.id+','+sr_obj.name+','+sr_obj.phone+','+sr_obj.address+'\n';
    //let content = iconv.encode(text, 'big5');
    //ws.write(content);
    ws.write(sr_obj.customer_count+','+sr_obj.usage_count+','+sr_obj.id+','+sr_obj.name+','+sr_obj.phone+','+sr_obj.address+'\n');
  }
  //關閉寫入流
  ws.close();
}

async function main() {
  // 製作 店家活躍度排行
  create_shop_ranking();
}

main();


const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require("path");
const {execSync, exec} = require('child_process');
//const iconv = require("iconv-lite");  //編碼轉換

// for CloudRun
const {Storage} = require('@google-cloud/storage');

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

// 店家資料
var shopData = {};

async function main() {
  // shop_data.json 檔案路徑  
  let shop_file_path = path.join(process.cwd(), '../common_data/shop_data.json');
  console.log(shop_file_path);

  // Creates a cloud storage client
  let storage;
  if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
    let storage_key_file = await fsPromises.readFile(`./data/${project_id}/storage_service_account_key.json`, 'utf8');
    let storage_key = JSON.parse(storage_key_file);
    storage = new Storage({
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

  // 上傳檔案 到 Cloud Storage
  async function upload_file_to_storage(bucketName,folder,file_name) {
    const options = {
      destination: `${folder}/${file_name}`
    };
    let file_path = path.join(process.cwd(), file_name);
    
    try {
      await storage.bucket(bucketName).upload(file_path, options);
      console.log(`gs://${bucketName}/${folder}/${file_name} uploaded`);
    }
    catch (err) {
      console.log(`error: failed to upload gs://${bucketName}/${folder}/${file_name}`);
      console.log(err.message);
      log_file.write(`error: failed to upload gs://${bucketName}/${folder}/${file_name}\n`);
      log_file.write(err.message+"\n");
    }
    
    return Promise.resolve(null);
  }

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
    let u_filenames = [];
    if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
      const listOptions = {
        prefix: "usage_log/"
      };
      // Lists files in the bucket, filtered by a prefix
      const [files] = await storage.bucket(bucketName).getFiles(listOptions);
      files.forEach(file => {
        u_filenames.push(file.name);
      });      
    }
    else {
      u_filenames = fs.readdirSync("../common_data/usage_log");
    }

    // 統計 店家 使用次數 及 使用人數
    let u_count_obj = {}; // 存放 店家使用次數 
    let user_count_obj = {};  // 存放 店家使用人數
    for (let i=0; i<u_filenames.length; i++) {
      let ymd = path.parse(u_filenames[i]).name;
      if (ymd >= start_date && ymd <= end_date) {
        // 取得 u_log_data
        let u_log_file = {};
        if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
          u_log_file = await storage.bucket(bucketName).file(u_filenames[i]).download();
        }
        else {
          u_log_file = await fs.readFileSync(`../common_data/usage_log/${u_filenames[i]}`, 'utf8');
        }
        let u_log_data = await JSON.parse(u_log_file);

        // 特殊處理：弘宇診所 shop_id 從 1211 改成 2808
        for (let shop_id in u_log_data) {
          if (ymd<'20240818' && shop_id=='1211') {
            u_log_data['2808']=u_log_data['1211'];
            delete u_log_data['1211'];
          }
        }    
        
        for (let shop_id in u_log_data) {
          if (shop_id in user_count_obj) user_count_obj[shop_id] += Object.keys(u_log_data[shop_id]).length;
          else user_count_obj[shop_id] = Object.keys(u_log_data[shop_id]).length;
          for (let user_id in u_log_data[shop_id]) {
            if (shop_id in u_count_obj) u_count_obj[shop_id] += Object.keys(u_log_data[shop_id][user_id]).length;
            else u_count_obj[shop_id] = Object.keys(u_log_data[shop_id][user_id]).length;
          }
        }    
      }
    }

    // 讀取 callnum_log 檔案列表
    let c_filenames = [];
    if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
      const listOptions = {
        prefix: "callnum_log/"
      };
      // Lists files in the bucket, filtered by a prefix
      const [files] = await storage.bucket(bucketName).getFiles(listOptions);
      files.forEach(file => {
        c_filenames.push(file.name);
      });      
    }
    else {
      c_filenames = fs.readdirSync("../common_data/callnum_log");
    }

    // 統計 叫號機 跳號次數
    let c_count_obj = {}; // 存放 叫號機 跳號次數
    for (let i=0; i<c_filenames.length; i++) {
      let ymd = path.parse(c_filenames[i]).name;
      if (ymd >= start_date && ymd <= end_date) {
        // 取得 c_log_data
        let c_log_file = {};
        if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
          c_log_file = await storage.bucket(bucketName).file(c_filenames[i]).download();
        }
        else {
          c_log_file = await fs.readFileSync(`../common_data/callnum_log/${c_filenames[i]}`, 'utf8');
        }
        let c_log_data = await JSON.parse(c_log_file);

        
        // 特殊處理：弘宇診所 caller_id 從 1211-0 改成 2808-0
        for (let caller_id in c_log_data) {
          if (ymd<'20240818' && caller_id=='1211-0') {
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

    // 製作 店家跳號數排行
    let shop_ranking = [];
    
    for (let shop_id in shopData) {
      let shop_name = shopData[shop_id].name;
      let phone = shopData[shop_id].phone;
      let address = shopData[shop_id].address;
      
      // 記算店家跳號次數
      let customer_count = 0;
      for (let caller_id in shopData[shop_id].callers) {
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
        'usage_count': (shop_id in u_count_obj)? u_count_obj[shop_id]:0,
        'user_count': (shop_id in user_count_obj)? user_count_obj[shop_id]:0
      });
    }
    shop_ranking = shop_ranking.sort(function (a, b) {
      return b.customer_count - a.customer_count;
    });
    
    // 創建寫入流
    const ws = fs.createWriteStream(`./shop_ranking_${start_date}~${end_date}.csv`);
    // 寫入內容
    //ws.write(iconv.encode('跳號數,使用次數,使用人數,店家ID,店家名稱,電話,地址\n', 'big5'));
    ws.write('\uFEFF跳號數,使用次數,使用人數,店家ID,店家名稱,電話,地址\n'); // 加入 BOM 檔頭 \uFEFF (for Excel)
    for (let i=0; i<shop_ranking.length; i++) {
      let sr_obj = shop_ranking[i];
      /*
      let text = sr_obj.customer_count+','+sr_obj.usage_count+','+sr_obj.user_count+','+sr_obj.id+','+sr_obj.name+','+sr_obj.phone+','+sr_obj.address+'\n';
      let content = iconv.encode(text, 'big5');
      ws.write(content);
      */
      ws.write(sr_obj.customer_count+','+sr_obj.usage_count+','+sr_obj.user_count+','+sr_obj.id+','+sr_obj.name+','+sr_obj.phone+','+sr_obj.address+'\n');
    }
    // 關閉寫入流
    ws.close();
    
    // 上傳 shop_ranking 檔案到 Cloud Storage
    if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
      let folder = "report";
      let file_name = `shop_ranking_${start_date}~${end_date}.csv`;
      await upload_file_to_storage(bucketName,folder,file_name);
    }
  }

  // 從 Cloud Storage 下載 shop_data.js
  if (deploy_type == "cloud_run" || deploy_type == "docker_run") {
    await download_shop_file(shop_file_path);
  }
  
  // 檢查 shop_data.json 是否存在
  if (!fs.existsSync(shop_file_path)) {
    console.log("shop_data.json 檔案不存在...");
    process.exit(1);
  }

  // 讀取店家資料
  let shop_file = await fs.readFileSync(shop_file_path, 'utf8');
  shopData = await JSON.parse(shop_file);
  console.log('shop count:', Object.keys(shopData).length);

  // 製作 店家活躍度排行
  create_shop_ranking();
}

main();


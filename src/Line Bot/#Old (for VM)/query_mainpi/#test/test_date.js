// 取得 年月日字串 "yyyymmdd"
function get_ymd(date_object) {
  let year = date_object.getFullYear();
  let month = ("00"+(date_object.getMonth()+1)).substr(-2);
  let day = ("00"+date_object.getDate()).substr(-2);
  let ymd = `${year}${month}${day}`;
  return ymd;
}

let date_obj = new Date();
let exp_date_obj = new Date();
let exp_ymd = '';

exp_date_obj.setDate(date_obj.getDate()-101);
exp_ymd = get_ymd(exp_date_obj);
console.log(exp_ymd);

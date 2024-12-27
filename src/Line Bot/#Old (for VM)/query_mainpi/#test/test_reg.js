let userMsg, reg, arr;

userMsg = " 　No. 　No 　 22  　 號 　号 　";
reg = /^(No|No.| |　)*\d+( |　|號|号)*$/;
if (reg.test(userMsg)) {  
    msgType = 'number';
    reg = /\d+/;
    userMsg = userMsg.match(reg)[0];
} else {
    msgType = 'text';
}
console.log(msgType);
console.log(userMsg);

userMsg = "abc 　No. 　No 　 22  　 號 　号 　123";
reg = /^(No|No.| |　)*\d+( |　|號|号)*$/;
arr = userMsg.match(reg);
if (reg.test(userMsg)) {  
    msgType = 'number';
    reg = /\d+/;
    userMsg = userMsg.match(reg)[0];
} else {
    msgType = 'text';
}
console.log(msgType);
console.log(userMsg);

userMsg = " 　No. 　No 　   　 號 　号 　";
reg = /^(No|No.| |　)*\d+( |　|號|号)*$/;
arr = userMsg.match(reg);
if (reg.test(userMsg)) {  
    msgType = 'number';
    reg = /\d+/;
    userMsg = userMsg.match(reg)[0];
} else {
    msgType = 'text';
}
console.log(msgType);
console.log(userMsg);

/*
var reg = /\d+$/;
var str = '1号房间777';
let arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串

str = '1号房间';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串

console.log('==========');

reg = /,+|;+|:+| +|，+|；+|：+|　+$/;
str = '1号房间,';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
str = '1号房间;;';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
str = '1号房间:::';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
str = '1号房间    ';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]+'$'); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
str = '1号房间，，，，';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
str = '1号房间；；；';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
str = '1号房间：：';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
str = '1号房间　';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]+'$'); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
str = '1号房间';
arr = str.match(reg);
if (arr==null) arr=['null'];
console.log(arr[0]); //获取匹配字符串
console.log(str.replace(reg,'')); //替换匹配字符串
*/
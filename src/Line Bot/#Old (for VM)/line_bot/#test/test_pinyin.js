import Pinyin from "./node_modules/pinyin/lib/pinyin.js";
//import lazy_pinyin from "./node_modules/pinyin/lib/pinyin.js";
//import Style from "./node_modules/pinyin/lib/pinyin.js";

//style = Style.BOPOMOFO;
//console.log(lazy_pinyin('聪明的小兔子', style=style));
//console.log(pinyin.lazy_pinyin('聪明的小兔子', 10));
console.log(Pinyin.pinyin("一個",{style:"TONE", compact:true}));
console.log(Pinyin.pinyin("中國",{style:"TONE", compact:true}));
console.log(Pinyin.pinyin("謝謝",{style:"TONE", compact:true}));
console.log(Pinyin.pinyin("孩子",{style:"TONE", compact:true}));

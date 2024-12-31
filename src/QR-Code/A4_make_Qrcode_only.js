const fs = require('fs');
const QRCode = require('qrcode');
const sharp = require('sharp');
require('dotenv').config();

(async () => {
  const jsonString = fs.readFileSync('./DifferentJsonFile/多出來的店家.json', 'utf8');
  const data = JSON.parse(jsonString);

  const storeCount = Object.keys(data).length;  //僅計算store數量
  let roomCount = 0;
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const objectItem = data[key];
      if (objectItem.isMultiCaller) {
        const callerKeys = Object.keys(objectItem.callers);
        roomCount += callerKeys.length;         //計算Room數量
      }
    }
  }
  const allA4numbers = storeCount + roomCount;

  let counting = 0;
  for (const key in data) {
    const { name, id, ...callers } = data[key];
    const values = Object.values(callers.callers);
    values.unshift(name);

    const storeId = id;
    let count = 0;
    //qrCodeGenerator(id, name, values, storeId, count);
    //async function qrCodeGenerator(id, name, values, storeId, count) {
    const encodedName = encodeURIComponent(name);
    const url = `https://line.me/R/oaMessage/@callmeback/?${encodedName}`;

    await new Promise((resolve, reject) => {
      QRCode.toFile(`./qrCodeOriginalA4/${id}.png`, url, {
        width: 815, height: 815,
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.99,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });


    console.log('\n<<<<  Qrcode A4 已列印完成...  >>>>\n');
  }

})();


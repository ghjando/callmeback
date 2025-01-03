const fs = require('fs');
const QRCode = require('qrcode');
//const sharp = require('sharp');
require('dotenv').config();

//商店名稱一定耀是  原來的名字  <==================================== 注意

(async () => {
  const jsonString = fs.readFileSync('./DifferentJsonFile/多出來的店家.json', 'utf8');
  const data = JSON.parse(jsonString);
  //let count = 0;

  //const liPaiNumbers = Object.keys(data).length;
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const objectItem = data[key];

      const encodedName = encodeURIComponent(objectItem.name);
      const url = `https://line.me/R/oaMessage/@callmeback/?${encodedName}`;

      await new Promise((resolve, reject) => {
        QRCode.toFile(`./qrCodeOriginal/${objectItem.id}.png`, url, {
          width: 432, height: 432,
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

      console.log('\n<<<<  Qrcode 立牌 已列印完成...  >>>>\n');
    }
  }
})();


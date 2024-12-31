const fs = require('fs');
// const QRCode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
require('dotenv').config();


function deleteFilesInFolder(folderPath) {
  // 讀取資料夾內的所有檔案
  const files = fs.readdirSync(folderPath);

  files.forEach((file) => {
    const curPath = path.join(folderPath, file);
    // 刪除檔案
    fs.unlinkSync(curPath);
  });
}

// 使用範例：刪除 LiPai_Card_Final 資料夾內的所有檔案
deleteFilesInFolder('./LiPai_Card_Final');


(async () => {
  const jsonString = fs.readFileSync('./DifferentJsonFile/多出來的店家.json', 'utf8');
  const data = JSON.parse(jsonString);
  let count = 0;

  const liPaiNumbers = Object.keys(data).length;
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const objectItem = data[key];

      const bgImage = sharp('./images/QrBG_Card2.png').extend({
        top: 0, left: 0, bottom: 0, right: 0,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });
      let qrImage = sharp(`./qrCodeOriginal/${objectItem.id}.png`);

      const bgMetadata = await bgImage.metadata();
      const qrMetadata = await qrImage.metadata();
      const x = Math.floor((bgMetadata.width - qrMetadata.width) / 2);

      const y = 580;

      const resultImage = await bgImage
        .composite([{ input: await qrImage.toBuffer(), left: x, top: y }])
        .toBuffer();

      const nameDelSpace = objectItem.name.replace(/\s+/g, '');
      const normalName = nameDelSpace.replace(/[:*.&?<">|/]/g, '_');

      await sharp(resultImage).toFile(`./imageResults1/${objectItem.id}-${normalName}.png`);
      await sharp(resultImage).toFile(`./imageResults2/${objectItem.id}-${normalName}-QrBG.png`);
      await sharp(resultImage).toFile(`./imageResults3/${objectItem.id}.png`);

      count++;
      const digitalNumber = liPaiNumbers.toString().length;
      const fourNumbers = count.toString().padStart(digitalNumber, '0');
      console.log(`QR code [${fourNumbers}/${liPaiNumbers}] generated for ${objectItem.id}-${objectItem.name}`);


      //console.log('\n  <<< Qrcode+背景圖案列印 已完成 >>>\n');
      ////////////////////////////////////////////////////////////////////

      const image = sharp(`./imageResults3/${objectItem.id}.png`);
      const metadata = await image.metadata();
      const textOptions = {
        top: parseInt(process.env.nomalPosition),
        left: Math.round(metadata.width / 2),
        width: metadata.width,
        fontSize: parseInt(process.env.normalSize),
        font: { family: 'Noto Sans CJK SC' },
        //align: 'center',
      };

      const text = `<svg width="${metadata.width}" 
      height="${metadata.height}">
      <text x="${metadata.width / 2}" 
      y="${process.env.cardPosition}" 
      text-anchor="middle" font-family="Noto Sans CJK SC" 
      font-size="${process.env.normalSize}px">${objectItem.name}</text>
      </svg>`;

      const nameDelSpace2 = objectItem.name.replace(/\s+/g, '');
      const normalName2 = nameDelSpace2.replace(/[:*<.?>"&|/]/g, '_');

      const outputPath = `./Lipai_Card_Final/${objectItem.id}-${normalName2}.png`;
      await image
        .composite([{ input: Buffer.from(text), left: 0, top: 0 }])
        .toFile(outputPath);
    }
  }
  console.log('\n<<<<  Qrcode 立牌 已列印完成...  >>>>\n');
})();


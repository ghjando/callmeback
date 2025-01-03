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

    const bgImage = sharp('./images/QrA4BG.png').extend({
      top: 0, left: 0, bottom: 0, right: 0,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    });
    let qrImage = sharp(`./qrCodeOriginalA4/${id}.png`);

    const bgMetadata = await bgImage.metadata();
    const qrMetadata = await qrImage.metadata();
    const x = Math.floor((bgMetadata.width - qrMetadata.width) / 2);
    const y = 1620;

    const resultImage = await bgImage
      .composite([{
        input: await qrImage.toBuffer(),
        left: x,
        top: y
      }])
      .toBuffer();

    const nameDelSpace = name.replace(/\s+/g, '');
    const normalName = nameDelSpace.replace(/[:*.?"|<>\/]/g, '_');

    await sharp(resultImage).toFile(`./imageA4Results1/${id}-${normalName}.png`);
    await sharp(resultImage).toFile(`./imageA4Results2/${id}-${normalName}-QrBG.png`);
    await sharp(resultImage).toFile(`./imageA4Results3/${id}.png`);

    if (values.length >= 3) {
      for (let i = 0; i < values.length; i++) {
        const storeName = values[i];
        count++;
        addTextToImage(`./imageA4Results3/${id}.png`,
          storeName === values[0] ? storeName : values[0], storeId, count - 1);
      }
    } else {
      addTextToImage(`./imageA4Results3/${id}.png`, name, storeId, count);
    }
    counting++;
    digitalNumber = allA4numbers.toString().length;
    fourNumbers = counting.toString().padStart(digitalNumber, '0');
    console.log(`QR code [${fourNumbers}/${allA4numbers}] generated for ${id}-${name}`);
    // }
  }

  async function addTextToImage(imagePath, storeName, storeId, count) {

    const nameCount0 = storeName.replace(/\s+/g, '');
    const storeShortName = nameCount0.replace(/[:*?+".|<>\/]/g, '_');

    const image = sharp(imagePath);
    const metadata = await image.metadata();

    const textOptions = {
      top: parseInt(process.env.A4normalNoRoomPosition),
      left: Math.round(metadata.width / 2),
      width: metadata.width,
      fontSize: parseInt(process.env.A4normalSize),
      font: { family: 'Noto Sans CJK SC' },
      //align: 'center',
    };

    const text = `<svg width="${metadata.width}" height="${metadata.height}">
      <text x="${metadata.width / 2}"
            y="${process.env.A4normalNoRoomPosition}"
            text-anchor="middle"
            font-family="Noto Sans CJK SC"
            font-size="${process.env.A4normalSize}px">${storeName}</text>
    </svg>`;

    const outputPath = count >= 1 ?
      `./imageA4Final/${storeId}-${storeShortName}_${count}.png` :
      `./imageA4Final/${storeId}-${storeShortName}.png`;

    await image
      .composite([{ input: Buffer.from(text), left: 0, top: 0 }])
      .toFile(outputPath);
  }
  console.log('\n<<<<  Qrcode A4 已列印完成...  >>>>\n');
})();


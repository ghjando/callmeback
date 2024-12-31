const fs = require('fs');
const sharp = require('sharp');
require('dotenv').config();

const data = JSON.parse(fs.readFileSync('./callMe.json', 'utf8'));
console.log('\n<<<<  A4 Qrcode 製作中..., 請耐心等待...  >>>>\n');

for (const key in data) {
  const { name, id, ...callers } = data[key];
  const values = Object.values(callers.callers);
  const storeId = id;
  values.unshift(name);
  let count = 0;

  if (values.length >= 3) {
    for (let i = 0; i < values.length; i++) {
      const storeName = values[i];
      count++;
      addTextToImage(`./imageA4Results3/${storeId}.png`, storeName === values[0] ? storeName : values[0], storeId, count - 1);
    }
  } else {
    addTextToImage(`./imageA4Results3/${storeId}.png`, name, storeId);
  }
}

async function addTextToImage(imagePath, storeName, storeId, count) {
  const image = sharp(imagePath);
  const nameCount0 = storeName.replace(/\s+/g, '');
  const storeShortName = nameCount0.replace(/[:*?+".|<>\/]/g, '_');

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

  if (count >= 1) {
    const outputPath = `./imageA4Final/${storeId}-${storeShortName}_${count}.png`;
    await image
      .composite([{ input: Buffer.from(text), left: 0, top: 0 }])
      .toFile(outputPath);
  } else {
    const outputPath = `./imageA4Final/${storeId}-${storeShortName}.png`;
    await image
      .composite([{ input: Buffer.from(text), left: 0, top: 0 }])
      .toFile(outputPath);
  }
}

console.log('<<< 列印店家 A4 Qrcode 檔案列印中... >>>\n');

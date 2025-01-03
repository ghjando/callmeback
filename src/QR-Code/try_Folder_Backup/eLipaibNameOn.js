const fs = require('fs');
const sharp = require('sharp');
require('dotenv').config();

const data = JSON.parse(fs.readFileSync('./callMe.json', 'utf8'));
console.log('\n<<<<  立牌 Qrcode 製作中..., 請耐心等待...  >>>>\n');

for (const key in data) {
  const { name, id } = data[key];
  //const values = Object.values(callers.callers);
  const storeId = id;

  addTextToImage(`./imageResults3/${storeId}.png`, name, storeId);

  async function addTextToImage(imagePath, storeName, storeId) {
    const image = sharp(imagePath);
    const nameCount0 = storeName.replace(/\s+/g, '');
    const storeShortName = nameCount0.replace(/[:*?+".|<>\/]/g, '_');

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
          y="${process.env.normalPosition}" 
          text-anchor="middle" font-family="Noto Sans CJK SC" 
          font-size="${process.env.normalSize}px">${storeName}</text>
    </svg>`;


    const outputPath = `./imageLiPaiFinal/${storeId}-${storeShortName}.png`;
    await image
      .composite([{ input: Buffer.from(text), left: 0, top: 0 }])
      .toFile(outputPath);
  }
}

console.log('<<< 列印店家 立牌 Qrcode 檔案列印中... >>>\n');

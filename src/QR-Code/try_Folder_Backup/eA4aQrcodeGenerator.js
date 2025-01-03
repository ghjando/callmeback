const puppeteer = require('puppeteer-core');
const fs = require('fs');
const sharp = require('sharp');

(async () => {
  console.log('\n===> 網頁 Qr_Code製作中,請耐心等候...\n');

  // Specify the path to your Chrome or Chromium executable
  const chromiumExecutablePath = 'C://Program Files//Google//Chrome//Application//chrome.exe';

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumExecutablePath,
  });
  const page = await browser.newPage();

  // Read JSON file content
  const jsonString = fs.readFileSync('./callMe.json', 'utf8');
  const data = JSON.parse(jsonString);

  let idArray = [];
  let nameArray = [];
  let callersArray = [];

  for (let key in data) {
    if (data[key].isMultiCaller === false || data[key].isMultiCaller === true) {
      idArray.push(data[key].id);
      callersArray.push(data[key].callers);
      nameArray.push(data[key].name);
    }
  }

  const lines = nameArray;
  const lines2 = idArray;

  for (const [nameCount, noNum] of lines.map((val, idx) => [val, lines2[idx]])) {
    await page.goto('https://qr.ioi.tw/zh/');
    await page.setViewport({ width: 1558, height: 944 });

    const signString = encodeURIComponent(nameCount);

    await new Promise(_func => setTimeout(_func, 1000));
    await page.waitForSelector('#url');
    await page.type('#url', 'https://line.me/R/oaMessage/@callmeback/?' + signString);

    const nameCountNoSpaceName = nameCount.replace(/\s+/g, '');
    const underLineString = nameCountNoSpaceName.replace(/[:*.?"|<>\/]/g, '_');

    await new Promise(_func => setTimeout(_func, 1000));
    await page.waitForSelector('#filename');
    await page.type('#filename', noNum + '-' + underLineString);

    await new Promise(_func => setTimeout(_func, 1000));
    await page.waitForSelector('#download');
    await page.click('#download');

    await new Promise(_func => setTimeout(_func, 1000));

    // Load the QrBG_A4ZoomOut.png image
    const bgImage = await sharp('./images/QrBG_A4ZoomOut.png');
    let qrImage = await sharp(`C://Users//mickmon//Downloads//${noNum}-${underLineString}.png`);
    qrImage = await qrImage.resize(810, 810);

    const bgMetadata = await bgImage.metadata();
    const qrMetadata = await qrImage.metadata();

    const x = Math.floor((bgMetadata.width - 810) / 2);
    const y = 1580;

    const resultImage = await bgImage
      .composite([{ input: await qrImage.toBuffer(), left: x, top: y }])
      .toBuffer();

    const nameDelSpace = item.name.replace(/\s+/g, '');
    const normalName = nameDelSpace.replace(/[:*.?"|<>\/]/g, '_');

    await sharp(resultImage).toFile(`./imageA4Results1/${noNum}-${normalName}.png`);
    await sharp(resultImage).toFile(`./imageA4Results2/${noNum}-${normalName}-QrBG.png`);;
    await sharp(resultImage).toFile(`./imageA4Results3/${noNum}.png`);

  }

  await new Promise(_func => setTimeout(_func, 1000));
  await browser.close();

  console.log(`\r\nHas printed!!\n`);
})();

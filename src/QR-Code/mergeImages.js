const sharp = require('sharp');

(async () => {
  const bgImage = await sharp('./images/QrBG_A4ZoomOut.png');
  const qrImage = await sharp('C://Users//mickmon//Downloads//2774-雄大診所.png');

  const bgMetadata = await bgImage.metadata();
  const qrMetadata = await qrImage.metadata();

  const x = Math.floor((bgMetadata.width - qrMetadata.width) / 2);
  const y = Math.floor((bgMetadata.height - qrMetadata.height) / 2);

  const resultImage = await bgImage
    .composite([{ input: await qrImage.toBuffer(), left: x, top: y }])
    .toFile('./imageA4Results1/resultImage.png');
})();

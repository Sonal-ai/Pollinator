const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcPath = 'C:/Users/SONAL/.gemini/antigravity/brain/380f3cb2-be0e-4908-92e1-02f8cae24420/.user_uploaded/media_1789810918899.png';

async function generate() {
  console.log('Reading source logo...');
  const { data, info } = await sharp(srcPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // 1. Generate full logo with transparency
  const fullTransparentBlack = Buffer.alloc(width * height * 4);
  const fullTransparentWhite = Buffer.alloc(width * height * 4);
  const fullTransparentGold = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const brightness = (r + g + b) / 3;
    const darkness = 255 - brightness;

    let alpha = 0;
    if (darkness > 12) {
      alpha = Math.min(255, Math.round((darkness / 240) * 255));
    }

    // Black version
    fullTransparentBlack[idx] = 12;
    fullTransparentBlack[idx + 1] = 14;
    fullTransparentBlack[idx + 2] = 20;
    fullTransparentBlack[idx + 3] = alpha;

    // White version
    fullTransparentWhite[idx] = 248;
    fullTransparentWhite[idx + 1] = 250;
    fullTransparentWhite[idx + 2] = 252;
    fullTransparentWhite[idx + 3] = alpha;

    // Gold version (#ffd21e)
    fullTransparentGold[idx] = 255;
    fullTransparentGold[idx + 1] = 210;
    fullTransparentGold[idx + 2] = 30;
    fullTransparentGold[idx + 3] = alpha;
  }

  // Save base transparent buffers
  const fullBlackSharp = sharp(fullTransparentBlack, { raw: { width, height, channels: 4 } });
  const fullWhiteSharp = sharp(fullTransparentWhite, { raw: { width, height, channels: 4 } });
  const fullGoldSharp = sharp(fullTransparentGold, { raw: { width, height, channels: 4 } });

  // 2. High-res full logos
  await fullBlackSharp
    .clone()
    .resize(512, Math.round(512 * (height / width)), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/logo.png');

  await fullWhiteSharp
    .clone()
    .resize(512, Math.round(512 * (height / width)), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/logo-white.png');

  await fullGoldSharp
    .clone()
    .resize(512, Math.round(512 * (height / width)), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('public/logo-gold.png');

  console.log('Saved public/logo.png, logo-white.png, logo-gold.png');

  // 3. Extract square bee mark (x: 40..188, y: 8..156 => 148x148)
  const markCrop = { left: 40, top: 8, width: 148, height: 148 };

  const beeMarkBlackBuffer = await fullBlackSharp.clone().extract(markCrop).png().toBuffer();
  const beeMarkGoldBuffer = await fullGoldSharp.clone().extract(markCrop).png().toBuffer();
  const beeMarkWhiteBuffer = await fullWhiteSharp.clone().extract(markCrop).png().toBuffer();

  await sharp(beeMarkBlackBuffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile('public/logo-mark.png');
  await sharp(beeMarkGoldBuffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile('public/logo-mark-gold.png');
  await sharp(beeMarkWhiteBuffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile('public/logo-mark-white.png');
  console.log('Saved public/logo-mark.png, logo-mark-gold.png, logo-mark-white.png');

  // 4. Create Golden Honeycomb Squircle App Badge (512x512)
  const badgeSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="beeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffe043" />
          <stop offset="45%" stop-color="#ffd21e" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
        <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#d97706" stop-opacity="0.4" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="url(#beeGrad)" />
      <rect x="17" y="17" width="478" height="478" rx="111" ry="111" fill="none" stroke="url(#rimGrad)" stroke-width="4" />
    </svg>
  `;

  const badgeBg = await sharp(Buffer.from(badgeSvg)).png().toBuffer();
  
  const beeMarkResized = await sharp(beeMarkBlackBuffer)
    .resize(340, 340, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const appBadge512 = await sharp(badgeBg)
    .composite([
      { input: beeMarkResized, top: 86, left: 86 }
    ])
    .png()
    .toBuffer();

  await sharp(appBadge512).toFile('public/logo-badge.png');
  console.log('Saved public/logo-badge.png');

  // 5. Generate Favicons and App Icons
  await sharp(appBadge512).resize(512, 512).toFile('src/app/icon.png');
  await sharp(appBadge512).resize(512, 512).toFile('public/icon.png');
  console.log('Saved src/app/icon.png, public/icon.png');

  await sharp(appBadge512).resize(180, 180).toFile('src/app/apple-icon.png');
  await sharp(appBadge512).resize(180, 180).toFile('public/apple-touch-icon.png');
  console.log('Saved src/app/apple-icon.png, public/apple-touch-icon.png');

  await sharp(appBadge512).resize(32, 32).toFile('public/favicon-32x32.png');
  await sharp(appBadge512).resize(16, 16).toFile('public/favicon-16x16.png');
  await sharp(appBadge512).resize(48, 48).toFile('src/app/favicon.ico');
  await sharp(appBadge512).resize(48, 48).toFile('public/favicon.ico');
  console.log('Saved favicons');

  console.log('All brand assets successfully generated!');
}

generate().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});

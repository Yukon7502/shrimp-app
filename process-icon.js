const sharp = require('sharp');
const path = require('path');

const inputPath = '/Users/stefan/.trae-cn/attachments/6ad47a4a514bfa30b7732f5c/f13dc19d-e530-4767-852f-5199efad7da0_e37180c4-9e69-45d9-aa32-5677808de425_IMG_20261018_234511.png';
const outputDir = '/Users/stefan/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6ad47a4a514bfa30b7732f59/shrimp-app/public';

const size = 512;
const borderRadius = 95;

async function createIcon() {
  // 新图背景是白色的，直接裁剪成圆角方形即可
  
  // 创建圆角遮罩
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${borderRadius}" ry="${borderRadius}" fill="white"/>
  </svg>`;

  // 先缩放到512x512，然后应用圆角遮罩
  const result = await sharp(inputPath)
    .resize(size, size, {
      fit: 'cover',
      position: 'center'
    })
    .composite([{
      input: Buffer.from(maskSvg),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  await sharp(result).toFile(path.join(outputDir, 'icon-512.png'));
  await sharp(result).resize(192, 192).toFile(path.join(outputDir, 'icon-192.png'));
  await sharp(result).resize(180, 180).toFile(path.join(outputDir, 'apple-touch-icon.png'));
  await sharp(result).resize(32, 32).toFile(path.join(outputDir, 'favicon.png'));

  console.log('✅ 新图标生成完成！');
}

createIcon().catch(console.error);

// 生成虾多多 APP 图标（纯 Node.js，无需额外依赖）
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, drawPixel) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk: raw image data with filter bytes
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const idx = y * (width * 4 + 1) + 1 + x * 4;
      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
      rawData[idx + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// 颜色工具
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
    255
  ];
}

// 绘制图标
function drawIcon(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

  // 圆角矩形（近似为圆形）
  const cornerRadius = w * 0.22;
  const rx = Math.min(x, w - 1 - x);
  const ry = Math.min(y, h - 1 - y);
  let inRect = true;
  if (rx < cornerRadius && ry < cornerRadius) {
    const dx = cornerRadius - rx;
    const dy = cornerRadius - ry;
    if (dx * dx + dy * dy > cornerRadius * cornerRadius) inRect = false;
  }

  if (!inRect) return [0, 0, 0, 0];

  // 渐变背景（深蓝到青绿）
  const c1 = hexToRgb('#0f6f8f');
  const c2 = hexToRgb('#12a3a0');
  const t = y / h;
  const bg = lerpColor(c1, c2, t * 0.8 + 0.1);

  // 画一只简化的虾（用圆形和线条模拟）
  const bodyCx = cx;
  const bodyCy = cy + h * 0.05;
  const bodyR = w * 0.28;

  // 虾身体（椭圆）
  const dx = (x - bodyCx) / bodyR;
  const dy = (y - bodyCy) / (bodyR * 0.7);
  const bodyDist = dx * dx + dy * dy;

  if (bodyDist < 1) {
    // 虾身体 - 浅粉色渐变
    const shrimpC1 = hexToRgb('#ffb3b3');
    const shrimpC2 = hexToRgb('#ff8a8a');
    const bt = (y - (bodyCy - bodyR * 0.7)) / (bodyR * 1.4);
    return lerpColor(shrimpC1, shrimpC2, Math.max(0, Math.min(1, bt)));
  }

  // 虾头（左边的小圆）
  const headCx = cx - w * 0.22;
  const headCy = cy - h * 0.02;
  const headR = w * 0.15;
  const headDx = (x - headCx) / headR;
  const headDy = (y - headCy) / headR;
  if (headDx * headDx + headDy * headDy < 1) {
    return hexToRgb('#ff9999').concat([255]);
  }

  // 虾尾巴（右边的三角形，用简单线条）
  const tailBaseX = cx + w * 0.25;
  const tailTipX = cx + w * 0.38;
  const tailTopY = cy - h * 0.1;
  const tailBotY = cy + h * 0.12;
  // 尾巴区域判断
  if (x > tailBaseX && x < tailTipX) {
    const tt = (x - tailBaseX) / (tailTipX - tailBaseX);
    const halfH = (tailBotY - tailTopY) / 2 * (1 - tt);
    const midY = (tailTopY + tailBotY) / 2;
    if (y > midY - halfH && y < midY + halfH) {
      return hexToRgb('#ff8080').concat([255]);
    }
  }

  // 眼睛（黑点）
  const eyeCx = headCx - headR * 0.3;
  const eyeCy = headCy - headR * 0.2;
  const eyeR = w * 0.025;
  if ((x - eyeCx) ** 2 + (y - eyeCy) ** 2 < eyeR * eyeR) {
    return [30, 30, 30, 255];
  }

  return bg;
}

const sizes = [192, 512, 180]; // 180 for apple touch icon
const outDir = path.join(__dirname, 'public');

sizes.forEach(size => {
  const png = createPNG(size, size, drawIcon);
  let filename;
  if (size === 180) filename = 'apple-touch-icon.png';
  else filename = `icon-${size}.png`;
  fs.writeFileSync(path.join(outDir, filename), png);
  console.log(`Generated ${filename} (${size}x${size})`);
});

// favicon (32x32)
const favicon = createPNG(32, 32, drawIcon);
fs.writeFileSync(path.join(outDir, 'favicon.ico'), favicon);
console.log('Generated favicon.ico');

console.log('所有图标生成完成！');

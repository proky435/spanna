// scripts/gen-icons.mjs
// Generálja a PWA ikonokat (192, 512, apple-touch) egy egyszerű SVG-ből.
// Használat: node scripts/gen-icons.mjs

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

// SVG ikon: sötét háttér, kék "S" betű, lekerekített sarkok
function svgIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#0f172a"/>
  <text x="50%" y="50%" dy="${size * 0.07}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="${size * 0.6}" font-weight="bold" fill="#1f66f5">S</text>
</svg>`;
}

async function generate() {
  const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of sizes) {
    const svg = Buffer.from(svgIcon(size));
    await sharp(svg).png().toFile(join(publicDir, name));
    console.log(`Generálva: public/${name} (${size}x${size})`);
  }

  // Favicon (32x32)
  const faviconSvg = Buffer.from(svgIcon(32));
  await sharp(faviconSvg).png().toFile(join(publicDir, 'favicon.ico'));
  console.log('Generálva: public/favicon.ico (32x32)');

  console.log('\nKész! Az ikonok a public/ mappában vannak.');
}

generate().catch(console.error);

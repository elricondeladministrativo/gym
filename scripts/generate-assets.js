/**
 * Genera los PNG de ícono/splash/favicon a partir de los SVG del logo.
 * Uso: npm run assets
 */
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets');
const logoPath = path.join(ASSETS, 'logo.svg');
const monoPath = path.join(ASSETS, 'monochrome-source.svg');

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const BLACK = { r: 13, g: 13, b: 13, alpha: 1 };

async function render(input, size) {
  return sharp(input, { density: 600 })
    .resize(size, size, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
}

async function compose(size, background, logoBuffer) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  const logoLarge = await render(logoPath, 860);
  const logoSmall = await render(logoPath, 620);
  const monoSmall = await render(monoPath, 620);
  const splash = await render(logoPath, 512);
  const faviconLogo = await render(logoPath, 40);

  const icon = await compose(1024, BLACK, logoLarge);
  const adaptive = await compose(1024, TRANSPARENT, logoSmall);
  const monochrome = await compose(1024, TRANSPARENT, monoSmall);
  const favicon = await compose(48, BLACK, faviconLogo);

  await sharp(icon).toFile(path.join(ASSETS, 'icon.png'));
  await sharp(adaptive).toFile(path.join(ASSETS, 'adaptive-icon.png'));
  await sharp(monochrome).toFile(path.join(ASSETS, 'monochrome-icon.png'));
  await sharp(splash).toFile(path.join(ASSETS, 'splash-icon.png'));
  await sharp(favicon).toFile(path.join(ASSETS, 'favicon.png'));

  console.log('Assets generados: icon, adaptive-icon, monochrome-icon, splash-icon, favicon.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

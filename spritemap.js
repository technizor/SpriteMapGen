const gm = require('gm');
const sharp = require('sharp');
const fse = require('fs-extra');
const path = require('path');

module.exports = (sheets, cache = '.spritemap-cache/') => {
  fse.ensureDir(cache).then(() =>
    sheets.forEach((configPath) => fse.readJson(configPath).then((data) => {
      console.log('Reading ' + configPath);
      const basePath = path.dirname(configPath);
      const inputPath = path.join(basePath, data.input.path);
      const inputExt = data.input.extension || 'png';
      const { x: basisX, y: basisY } = data.basis;
      const { x: gridX, y: gridY } = data.grid;
      const sprites = data.sprites;
      const blocks = data.blocks;
      const tempPath = path.join(cache, data.output.path);
      console.log('Writing ' + tempPath);
      const ox = basisX * gridX;
      const oy = basisY * gridY;

      const getValues = (data) => {
        const { x: gx, y: gy, src } = data;
        const gw = data.w || 1;
        const gh = data.h || 1;
        const px = gx * (basisX + 0);
        const py = gy * (basisY + 0);
        const pw = gw * basisX;
        const ph = gh * basisY;

        const imgSrc = `${src}.${inputExt}`;
        const srcPath = path.join(inputPath, imgSrc);
        const tmpPath = path.join(cache, imgSrc);
        return {
          gx, gy, gw, gh, px, py, pw, ph, imgSrc, srcPath, tmpPath,
        };
      }

      const bufferX = sprites.map(v => (v.w || 1) * basisX).reduce((a, b) => a > b ? a : b, 0);
      const bufferY = sprites.map(v => (v.h || 1) * basisY).reduce((a, b) => a > b ? a : b, 0);
      console.log('bufferX: '+ bufferX + ' bufferY: ' + bufferY); // Needs a buffer zone because region().draw() overrites from 0,0 for some reason

      const serialStitch = (array, buffer, position) => {
        if (position === array.length) {
          sharp(buffer)
            .toFile(tempPath, fileOutCb);
        } else {
          const { gx, gy, gw, gh, px, py, pw, ph, imgSrc, srcPath, tmpPath } = getValues(array[position]);

          if (!fse.existsSync(srcPath)) {
            console.log('DNE:', srcPath, '->', tempPath);
            serialStitch(array, buffer, position + 1);
          } else {
            sharp(srcPath)
              .resize(pw, ph)
              .toBuffer((err, data, info) => {
                if (err) console.log(err);
                sharp(buffer)
                  .overlayWith(data, { left: px, top: py })
                  .toBuffer(sharpCb(position + 1));
              });
          }
        }
      };

      const sharpCb = (nextIndex) => (err, data, info) => {
        if (err) console.log(err);
        serialStitch(sprites, data, nextIndex);
      };
      const fileOutCb = (err, info) => {
        if (err) console.log('no write: ' + tempPath + `\n${err}`);
      };
      
      const width = ox;
      const height = oy;
      const channels = 4;
      const background = '#00000000';
      const canvasOptions = { create: { width, height, channels, background } };
      sharp(null, canvasOptions)
        .toFormat(inputExt)
        .toBuffer(sharpCb(0));
    })));

}

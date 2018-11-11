const fse = require('fs-extra');
const path = require('path');

const {
  fileHash, readConfig,
} = require('./fso');

const {
  size, areaOver,
  recordToData, subData,
  getFuseSteps, isValidRectangle,
} = require('./mapper');

module.exports = (sheets, cache = '.spritemap-cache/') => {
  fse.ensureDir(cache).then(() =>
    sheets.forEach((configPath) => readConfig(configPath).then((data) => {
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

      const splitBlocks = (data) => {
        const { srcs } = data;
        if (srcs) {

        }
        return data;
      }

      const getValues = (data) => {
        const { x: gx1, y: gy1, src } = data;
        const gw = data.w || 1;
        const gh = data.h || 1;
        const gx2 = gx1 + gw;
        const gy2 = gy1 + gh;

        const imgSrc = `${src}.${inputExt}`;
        const srcPath = path.join(inputPath, imgSrc);
        const tmpPath = path.join(cache, imgSrc);
        return {
          gx1, gx2, gy1, gy2, gw, gh, imgSrc, srcPath, tmpPath,
        };
      }

      Promise.all(sprites
        .map(getValues)
        .map(props => fileHash(props.srcPath)
          .then(hash => ({ hash, props }))
        )
      )
        .then(record => recordToData(record, size(gridX, gridY)))
        .then(data => {
          fse.outputJsonSync(path.join(cache, configPath, 'record.json'), data.record);
          fse.outputJsonSync(path.join(cache, configPath, 'map.json'), data.map);
          fse.outputJsonSync(path.join(cache, configPath, 'grid.json'), data.grid);
          return data;
        })
        .then(data => {


          var first = data.record[0];
          // left
          const { gx1, gx2, gy1, gy2, gw, gh } = first.props;

          var left = gx1;
          var right = gx2;
          while(left > 0 && isValidRectangle(data.grid, data.map, areaOver(left, gy1, gx2, gy2))) left--;
          while(right < gridX && isValidRectangle(data.grid, data.map, areaOver(gx1, gy1, right, gy2))) right++;
          var up = gy1;
          var down = gy2;
          while(up > 0 && isValidRectangle(data.grid, data.map, areaOver(gx1, up, gx2, gy2))) up--;
          while(down < gridY && isValidRectangle(data.grid, data.map, areaOver(gx1, gy1, gx2, down))) down++;

          var hData = subData(data, areaOver(left, gy1, right, gy2));
          var vData = subData(data, areaOver(gx1, up, gx2, down));
          fse.outputJsonSync(path.join(cache, configPath, 'hori.json'), hData);
          fse.outputJsonSync(path.join(cache, configPath, 'vert.json'), vData);
        })
        .catch(console.log)
    })));
}

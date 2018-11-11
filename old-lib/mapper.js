// Constructors
const size = (w, h) => ({ w, h });
const areaOver = (x1, y1, x2, y2) => ({ x1,  y1, w: x2 - x1, h: y2 - y1, x2, y2 });
const areaSized = (x, y, w = 1, h = 1) => ({ x1: x, y1: y, w, h, x2: x + w, y2: y + h });

const grid = (size, defVal = null) => {
  var out = new Array(size.h);
  for (var r = 0; r < size.h; r++) {
    out[r] = new Array(size.w);
    for(var c = 0; c < size.w; c++) {
      out[r][c] = defVal;
    }
  }
  return out;
}

const subData = (data, area) => {
  const { record, grid, map } = data;
  const sg = subGrid(grid, area);
  const sm = subMap(grid, map, area);
  const sr = subRecord(sm, record);
  return { grid: sg, map: sm, record: sr };
}

const subGrid = (grid, area) => {
  var out = new Array(area.h);
  for (var r = 0; r < area.h; r++) {
    out[r] = new Array(area.w);
    for(var c = 0; c < area.w; c++) {
      out[r][c] = grid[area.y1 + r][area.x1 + c];
    }
  }
  return out;
}

const subMap = (grid, map, area) => {
  const hashes = {};
  for (var r = area.y1; r < area.y2; r++) {
    for (var c = area.x1; c < area.x2; c++) {
      const hash = grid[r][c];
      if (hash) {
        const oldProps = map[hash];
        const newProps = Object.assign({}, oldProps, {
          gx1: oldProps.gx1-area.x1,
          gy1: oldProps.gy1-area.y1,
          gx2: oldProps.gx2-area.x1,
          gy2: oldProps.gy2-area.y1,
        });

        hashes[hash] = newProps;
      }
    }
  }
  return hashes;
}

const subRecord = (subMap, record) => {
  const keepers = Object.keys(subMap);
  return record.filter(v => keepers.indexOf(v.hash) !== -1);
}

const isValidRectangle = (grid, map, area) => {
  var checked = {};
  for (var r = area.y1; r < area.y2; r++) {
    for (var c = area.x1; c < area.x2; c++) {
      const hash = grid[r][c];
      if (hash && !checked[hash]) {
        const ref = map[hash];
        if (ref.gx1 < area.x1
          || ref.gy < area.y1
          || ref.gx2 > area.x2
          || ref.gy2 > area.y2)
          return false;
        checked[hash] = true;
      }
    }
  }
  return true;
}

const getFuseSteps = (grid, map) => 1;

const recordToData = (record, size) => {
  const r = sortRecord(record);
  const m = recordToMap(record);
  const g = recordToGrid(record, size);

  return ({ record: r, map: m, grid: g });
}

const recordToMap = (record) => record
  .map(v => ({ [v.hash]: v.props }))
  .reduce((a, b) => Object.assign(a, b), {});
const sortRecord = (record) => record
  .slice()
  .sort((a, b) => { // Largest side, Row, Column
    const ma = Math.max(a.props.gw, a.props.gh);
    const mb = Math.max(b.props.gw, b.props.gh);
    return Math.sign(-ma + mb)
      || Math.sign(a.props.gy1 - b.props.gy1)
      || Math.sign(a.props.gx1 - b.props.gx1);
  });
const recordToGrid = (record, size) => record
  .reduce((prev, next, index) => {
    for(let r = next.props.gy1; r < next.props.gy2; r++) {
      for(let c = next.props.gx1; c < next.props.gx2; c++) {
        if (prev[r][c] !== null) {
          console.log('overwrite at ' + r + ',' + c + `: "${prev[r][c]}" -> "${next.hash}"`);
          console.log(prev);
          throw new Error();
        }
        prev[r][c] = next.hash;
      }
    }
    return prev;
  }, grid(size, null));

const configSetup = (configData) => {

  const basePath = path.dirname(configPath);
  const inputPath = path.join(basePath, data.input.path);
  const inputExt = data.input.extension || 'png';
  const { x: basisX, y: basisY } = data.basis;
  const { x: gridX, y: gridY } = data.grid;
  const sprites = data.sprites;
  const tempPath = path.join(cache, data.output.path);


  const spriteConfig = (data) => {
    const a = areaSized(data.x, data.y, data.w, data.h);

    const id = data.src;
    const srcPath = `${src}.${inputExt}`;

    return Object.assign({}, a, { id, srcPath });
  }

  return {}
  sprites.map(getValues)
}

module.exports = {
  size,
  areaOver,
  areaSized,
  grid,

  recordToData,
  subData,

  getFuseSteps,
  isValidRectangle,
};

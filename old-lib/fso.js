const fse = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const fileHash = (path) => new Promise((resolve, reject) => {
  try {
    const hash = fse.createReadStream(path)
      .pipe(crypto.createHash('sha256').setEncoding('hex'))
      .on('finish', () => resolve(hash.read()));
  } catch (error) {
    reject(error);
  }
});

const readConfig = (configPath) => fse.readJson(configPath);

module.exports = {
  fileHash,
  readConfig,
}

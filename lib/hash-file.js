const crypto = require('crypto');
const fs = require('fs');

function hashFile(file) {
    return new Promise((resolve, reject) => {
        let hash = crypto.createHash('sha256');
        let fileStream = fs.ReadStream(file);
        fileStream.on('data', data => {
            hash.update(data);
        });
        fileStream.on('end', () => {
            let sha256 = hash.digest('hex');
            resolve(sha256);
        });
    });
}

module.exports = hashFile;
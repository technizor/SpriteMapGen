import * as crypto from 'crypto';
import * as fs from 'fs';

function hashFile(file: string) {
    return new Promise((resolve, reject) => {
        let hash = crypto.createHash('sha256');
        let fileStream = new fs.ReadStream(file as any);
        fileStream.on('data', data => {
            hash.update(data);
        });
        fileStream.on('end', () => {
            let sha256 = hash.digest('hex');
            resolve(sha256);
        });
    });
}

export default hashFile;
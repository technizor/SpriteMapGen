import * as crypto from 'crypto';
import * as fse from 'fs-extra';

function hashFile(file: string) {
    let fp = file as any;
    return new Promise<string | null>((resolve, reject) => {
        let hash = crypto.createHash('sha256');
        if (!fse.existsSync(fp)) {
            console.log('not exist', file);
            resolve(null);
        }
        if (!fse.lstatSync(file as any).isFile) {
            resolve(null);
        }
        let fileStream = new fse.ReadStream(file as any);
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
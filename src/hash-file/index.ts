import * as crypto from 'crypto';
import * as fse from 'fs-extra';

export default function getHashFile(quiet: boolean = false) {
    return function hashFile(file: string) {
        let fp = file as any;
        return new Promise<string | null>((resolve, reject) => {
            let hash = crypto.createHash('sha256');
            if (!fse.existsSync(fp)) {
                if (!quiet) console.error('File does not exist: ', file);
                resolve(null);
                return;
            }
            let lstat = fse.lstatSync(file as any);
            if (!lstat.isFile()) {
                if (!quiet) console.error('Path is not a file: ', file);
                resolve(null);
                return;
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
}

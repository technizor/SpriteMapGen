import { expect } from 'chai';

import hashFile from '.';

const sha256Regex = /^[0-9a-f]{64}$/i;

describe('hashFile function', function () {
    it('is a function', function () {
        let func = hashFile(false);
        expect(func).to.be.not.null;
    });
    it('returns null for non-existent file at path', async function () {
        let func = hashFile(false);
        expect(await func('nothing.json')).to.be.null;
    });
    it('throws for existing folder at path', async function () {
        let func = hashFile(false);
        expect(await func('resources')).to.be.null;
    });
    it('returns sha256 hash for existing file at path', async function () {
        let func = hashFile(false);
        let hash = await func('resources/example-map.json');
        expect(hash).to.be.not.null;
        expect(sha256Regex.test(hash!)).to.be.true;
    });
});
import { expect } from 'chai';

import hashFile from '.';

describe('hashFile', function () {
    it('is a function', function () {
        let func = hashFile(true);
        expect(func).to.be.not.null;
    });
    it('returns null for non-existent file at path', async function () {
        let func = hashFile(true);
        expect(await func('nothing.json')).to.be.null;
    });
    it('throws for existing folder at path', async function () {
        let func = hashFile(true);
        expect(await func('resources')).to.be.null;
    });
    it('returns sha256 hash for existing file at path', async function () {
        let func = hashFile(true);
        expect(await func('resources/example-map.json')).to.be.not.null;
    });
});
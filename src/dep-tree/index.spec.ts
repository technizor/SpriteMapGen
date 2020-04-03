import { expect } from 'chai';
import { DepNode } from '.';

describe('DepNode class', function () {
    it('constructor', function () {
        let fileHash = '000000';
        let deps = new Map<string, DepNode<string>>();
        let data = 'mydata';
        let node: DepNode<string> = new DepNode(fileHash, deps, data, true, null);

        expect(node).to.be.not.null;
        expect(node.getFileHash()).to.be.eq(fileHash);
        expect(node.getData()).to.be.eq(data);
        expect(node.getDependencies()).to.be.eq(deps);
        expect(node.isValid()).to.be.true;
        expect(node.getReason()).to.be.null;
    });
});
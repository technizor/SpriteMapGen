import ValidatorFactory from '../validator';
import { OptionsValue, IOValue, GridValue, BlockEntry, BlockBlockEntry, BaseBlockEntry } from './types';
import { ValidateFunc } from '../validator/types';
import { Obj } from '../validator/spec';

const primitiveValidators = {
    string: ValidatorFactory.string(),
    dimension: ValidatorFactory.number()
        .finite().integer().gt(0),
    position: ValidatorFactory.number()
        .finite().integer().gteq(0),
    format: ValidatorFactory.string()
        .enum('png', 'jpeg', 'webp', 'tiff', 'raw', 'tile'),
};

const blockValidatorBase = ValidatorFactory.object<BaseBlockEntry>()
    .prop('sizeX', primitiveValidators.dimension.optional(1))
    .prop('sizeY', primitiveValidators.dimension.optional(1))
    .prop('x', primitiveValidators.position)
    .prop('y', primitiveValidators.position);
const blockValidators = {
    map: blockValidatorBase
        .prop('map', primitiveValidators.string),
    sprite: blockValidatorBase
        .prop('src', primitiveValidators.string),
    block: blockValidatorBase
        .prop('blockSrc', ValidatorFactory.array<string>().every(primitiveValidators.string))
        .prop('blockX', primitiveValidators.dimension.optional(1))
        .prop('blockY', primitiveValidators.dimension.optional(1))
        .prop('blockDir', primitiveValidators.string.enum('row', 'col').optional('row')),
}

const fieldValidators = {
    input: ValidatorFactory.object<IOValue>()
        .prop('path', primitiveValidators.string)
        .prop('format', primitiveValidators.format.optional('png')),
    output: ValidatorFactory.object<IOValue>()
        .prop('path', primitiveValidators.string)
        .prop('format', primitiveValidators.format.optional('png')),
    grid: ValidatorFactory.object<GridValue>()
        .prop('basisX', primitiveValidators.dimension)
        .prop('basisY', primitiveValidators.dimension)
        .prop('sizeX', primitiveValidators.dimension)
        .prop('sizeY', primitiveValidators.dimension),
    blocks: ValidatorFactory.array<BlockEntry>()
        .every(ValidatorFactory.object<BlockEntry>()
            .case(blockValidators.map, blockValidators.sprite, blockValidators.block)),
};

const validateGridConstraints: ValidateFunc<Obj<OptionsValue>> = (value) => {
    const malformedRes = { valid: false, reason: { message: 'grid is malformed' } };
    const successRes = { valid: true, reason: { message: 'grid is okay' } };

    // todo: make a better coordinate-based check instead of cell-based
    let grid = value.grid;
    let cells = new Array(grid.sizeY);
    for (let y = 0; y < grid.sizeY; y++) {
        cells[y] = new Array(grid.sizeX);
    }
    let blocks = value.blocks;
    for (let b = 0; b < blocks.length; b++) {
        let block = blocks[b];
        let xs = block.sizeX || 1;
        let ys = block.sizeY || 1;
        let x1 = block.x;
        let y1 = block.y;
        let x2 = x1 + xs;
        let y2 = y1 + ys;
        if (x1 < 0 || x2 < 0 || x1 >= grid.sizeX || x2 > grid.sizeX) return malformedRes;
        if (y1 < 0 || y2 < 0 || y1 >= grid.sizeY || y2 > grid.sizeY) return malformedRes;

        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                if (cells[y][x] !== undefined && cells[y][x] !== null) return malformedRes;
                cells[y][x] = b;
            }
        }

        // Block layout check
        if ((block as BlockBlockEntry).blockSrc) {
            let blk = block as BlockBlockEntry;
            let count = blk.blockSrc.length;
            let xb = blk.blockX || 1;
            let yb = blk.blockY || 1;
            let xn = xs / xb;
            let yn = ys / yb;
            if (!Number.isInteger(xn)) return malformedRes;
            if (!Number.isInteger(yn)) return malformedRes;
            if (xn * yn > count) return malformedRes;
        }
    }
    //console.log(debugGridStr(cells));
    return successRes;
};

const optionsValidator = ValidatorFactory.object<OptionsValue>()
    .prop('input', fieldValidators.input)
    .prop('output', fieldValidators.output)
    .prop('grid', fieldValidators.grid)
    .prop('blocks', fieldValidators.blocks)
    .validate('gridConstraints', validateGridConstraints);

export default optionsValidator;
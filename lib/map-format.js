const Validator = new require('./validator');

const primitiveValidators = {
    string: Validator.string(),
    dimension: Validator.number()
        .finite().integer().gt(0),
    position: Validator.number()
        .finite().integer().gteq(0),
    format: Validator.string()
        .enum('png', 'jpeg', 'webp', 'tiff', 'raw', 'tile'),
};
const blockValidatorBase = Validator.object()
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
        .prop('blockSrc', Validator.array().every(primitiveValidators.string))
        .prop('blockX', primitiveValidators.dimension.optional(1))
        .prop('blockY', primitiveValidators.dimension.optional(1))
        .prop('blockDir', primitiveValidators.string.enum('row', 'col').optional('row')),
}
const fieldValidators = {
    input: Validator.object()
        .prop('path', primitiveValidators.string)
        .prop('format', primitiveValidators.format.optional('png')),
    output: Validator.object()
        .prop('path', primitiveValidators.string)
        .prop('format', primitiveValidators.format.optional('png')),
    grid: Validator.object()
        .prop('basisX', primitiveValidators.dimension)
        .prop('basisY', primitiveValidators.dimension)
        .prop('sizeX', primitiveValidators.dimension)
        .prop('sizeY', primitiveValidators.dimension),
    blocks: Validator.array()
        .every(Validator.object()
            .case(blockValidators.map, blockValidators.sprite, blockValidators.block)),
};

const base64Table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const debugGridStr = grid => grid
    .map(row => row
        .map(b => (b !== undefined && b !== null) ? base64Table.charAt(b % base64Table.length) : ' ')
        .join(''))
    .join('\n');

const validateGridConstraints = (value) => {
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
        if (x1 < 0 || x2 < 0 || x1 >= grid.sizeX || x2 > grid.sizeX) return false;
        if (y1 < 0 || y2 < 0 || y1 >= grid.sizeY || y2 > grid.sizeY) return false;

        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                if (cells[y][x] !== undefined && cells[y][x] !== null) return false;
                cells[y][x] = b;
            }
        }

        // Block layout check
        if (block.blockSrc !== null && block.blockSrc !== undefined) {
            let count = block.blockSrc.length;
            let xb = block.blockX || 1;
            let yb = block.blockY || 1;
            let xn = xs / xb;
            let yn = ys / yb;
            if (!Number.isInteger(xn)) return false;
            if (!Number.isInteger(yn)) return false;
            if (xn * yn > count) return false;
        }
    }
    //console.log(debugGridStr(cells));
    return true;
};

const optionsValidator = Validator.object()
    .prop('input', fieldValidators.input)
    .prop('output', fieldValidators.output)
    .prop('grid', fieldValidators.grid)
    .prop('blocks', fieldValidators.blocks)
    .validate('gridConstraints', validateGridConstraints);

module.exports = optionsValidator;
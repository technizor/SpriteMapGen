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
    .prop('sizeX', primitiveValidators.dimension.optional())
    .prop('sizeY', primitiveValidators.dimension.optional())
    .prop('x', primitiveValidators.position)
    .prop('y', primitiveValidators.position);
const blockValidators = {
    map: blockValidatorBase
        .prop('map', primitiveValidators.string),
    sprite: blockValidatorBase
        .prop('src', primitiveValidators.string),
    block: blockValidatorBase
        .prop('blockSrc', Validator.array().every(primitiveValidators.string))
        .prop('blockX', primitiveValidators.dimension)
        .prop('blockY', primitiveValidators.dimension)
        .prop('blockDir', primitiveValidators.string.optional()),
}
const fieldValidators = {
    input: Validator.object()
        .prop('path', primitiveValidators.string)
        .prop('format', primitiveValidators.format),
    output: Validator.object()
        .prop('path', primitiveValidators.string)
        .prop('format', primitiveValidators.format),
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
    .join(''),
).join('\n');

const validateGridConstraints = (value) => {
    let grid = value.grid;
    let cells = new Array(grid.sizeX);
    for (let x = 0; x < grid.sizeX; x++) {
        cells[x] = new Array(grid.sizeY);
    }
    let blocks = value.blocks;
    for (let b = 0; b < blocks.length; b++) {
        let block = blocks[b];
        let x1 = block.x;
        let y1 = block.y;
        let x2 = block.x + (block.sizeX || 1);
        let y2 = block.y + (block.sizeY || 1);
        if (x1 >= grid.sizeX || x2 > grid.sizeX) return false;
        if (y1 >= grid.sizeY || x2 > grid.sizeY) return false;

        for (let x = x1; x < x2; x++) {
            for (let y = y1; y < y2; y++) {
                if (cells[x][y] !== undefined && cells[x][y] !== null) return false;
                cells[x][y] = b;
            }
        }
    }
    console.log(debugGridStr(cells));
    return true;
};

const optionsValidator = Validator.object()
    .prop('input', fieldValidators.input)
    .prop('output', fieldValidators.output)
    .prop('grid', fieldValidators.grid)
    .prop('blocks', fieldValidators.blocks)
    .validate('gridConstraints', validateGridConstraints);

module.exports = optionsValidator;
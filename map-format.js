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
    .prop('sizeX', primitiveValidators.dimension)
    .prop('sizeY', primitiveValidators.dimension)
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
        .prop('x', primitiveValidators.dimension)
        .prop('y', primitiveValidators.dimension),
    blocks: Validator.array()
        .every(Validator.object()
            .case(blockValidators.map, blockValidators.sprite, blockValidators.block)),
};
const optionsValidator = Validator.object()
    .prop('input', fieldValidators.input)
    .prop('output', fieldValidators.output)
    .prop('grid', fieldValidators.grid)
    .prop('blocks', fieldValidators.blocks);

var defaultOptions = {
    input: {
        path: 'input/',
        format: 'png', 
        },
    output: {
        path: 'output.png',
        format: 'png',
        },
    grid: {
        basisX: 16,
        basisY: 16,
        x: 16,
        y: 16,
    },
    blocks: [{
        src: 'img',
        x: 0,
        y: 0,
        sizeX: 8,
        sizeY: 8,
    }, {
        map: 'inner-map.json',
        x: 8,
        y: 0,
        sizeX: 8,
        sizeY: 16,
    }, {
        blockDir: 'row',
        blockX: 2,
        blockY: 2,
        blockSrc: ['img1', 'img2'],
        x: 0,
        y: 8,
        sizeX: 8,
        sizeY: 8,
    }],
};
console.log(optionsValidator.spec('[options]'));
console.log('defaultOptions valid:', optionsValidator.test(defaultOptions));

/*
class SpriteMap {
    constructor(options) {
        this.options = {
            input: {
                path: null,
                format: null, 
            },
            output: {
                path: null,
                format: null,
            },
            grid: {
                basisX: null,
                basisY: null,
                x: null,
                y: null,
            },
            blocks: null,
        };

        this.input = {
            path: options.input.path,
            extension: options.input.
        }
    }
    get input() {
        return this
    }
}*/
const fse = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const mapFormat = require('./map-format');

class Processor {
    constructor(map, cache, stack = []) {
        if (!map) throw new Exception("Map is required.");
        if (!cache) throw new Exception("Cache is required.");
        if (!stack) throw new Exception("Stack is required.");

        this._map = map;
        this._cache = cache;
        this._stack = stack;
    }
}

class BaseProcessor extends Processor {
    constructor(map, cache, stack) {
        super(map, cache, stack);
    }

    async loadOptions() {
        let cachePath = path.resolve(this._cache);
        let basePath = path.dirname(path.resolve(this._map));

        let rawOptions = await fse.readJson(this._map);
        let options = Object.assign({}, rawOptions, {
            input: Object.assign({}, rawOptions.input, {
                path: path.join(basePath, rawOptions.input.path),
            }),
            output: Object.assign({}, rawOptions.output, {
                path: path.join(cachePath, rawOptions.output.path),
            }),
        });
        return new ResolvedProcessor(this._map, this._cache, this._stack, rawOptions, options);
    }
}

class ResolvedProcessor extends Processor {
    constructor(map, cache, stack, rawOptions, options) {
        super(map, cache, stack);
        this._rawOptions = rawOptions;
        this._options = options;
    }

    async validate() {
        let result = mapFormat.test(this._options);
        if (!result.valid) {
            console.log(`${this._map} is not valid:`, result.reason);
            return new ValidatedProcessor(this._map, this._cache, this._stack, this._rawOptions, this._options, false, false);
        }
        console.log('Not Implemented: Testing File Existence');
        return new ValidatedProcessor(this._map, this._cache, this._stack, this._rawOptions, this._options, true, true);
    }
}

class ValidatedProcessor extends ResolvedProcessor {
    constructor(map, cache, stack, rawOptions, options, validOptions, validFiles) {
        super(map, cache, stack, rawOptions, options);
        this._validOptions = validOptions;
        this._validFiles = validFiles;
    }

    isValid() {
        return this._validOptions && this._validFiles;
    }
    isOptionsValid() {
        return this._validOptions;
    }
    isFilesValid() {
        return this._validFiles;
    }

    async generate() {
        if (!this.isValid()) {
            console.log('Map is invalid. Cannot generate spritemap.');
            return;
        }
        await generateImage(this._options);
    }
}

// Generator Functions
async function generateImage(options) {
    let inputOptions = options.input;
    let gridOptions = options.grid;
    const width = gridOptions.sizeX * gridOptions.basisX;
    const height = gridOptions.sizeY * gridOptions.basisY;
    const channels = 4;
    const background = '#00000000';
    const canvasOptions = { create: { width, height, channels, background } };
    let stepData = await sharp(null, canvasOptions)
        .toFormat(inputOptions.format)
        .toBuffer();
    for (let i = 0; i < options.blocks.length; i++) {
        let blockOptions = options.blocks[i];
        let blockPosition = {
            left: blockOptions.x * gridOptions.basisX,
            top: blockOptions.y * gridOptions.basisY,
        };
        let blockData = await getSpriteBuffer(inputOptions, gridOptions, blockOptions);
        stepData = await sharp(stepData)
            .overlayWith(blockData, blockPosition)
            .toBuffer();
    }
    let outputOptions = options.output;
    let tempPath = `${outputOptions.path}.${outputOptions.format}`;
    await sharp(stepData)
        .toFormat(outputOptions.format)
        .toFile(tempPath);
}

async function getSpriteBuffer(inputOptions, gridOptions, blockOptions) {
    let width = (blockOptions.sizeX || 1) * gridOptions.basisX;
    let height = (blockOptions.sizeY || 1) * gridOptions.basisY;
    if (blockOptions.src !== undefined && blockOptions.src !== null) {
        let src = path.join(inputOptions.path, `${blockOptions.src}.${inputOptions.format}`);
        if (fse.existsSync(src)) {
            return await sharp(src)
                .resize(width, height)
                .toFormat(inputOptions.format)
                .toBuffer();
        } else {
            throw new Error(`DNE: ${src}`);
        }
    } else if (blockOptions.map !== undefined && blockOptions.map !== null) {
        throw new Error(`Not Implemented`);
    } else if (blockOptions.blockSrc !== undefined && blockOptions.blockSrc !== null) {
        const channels = 4;
        const background = '#00000000';
        const canvasOptions = { create: { width, height, channels, background } };
        let blockStepData = await sharp(null, canvasOptions)
            .toFormat(inputOptions.format)
            .toBuffer();
        let blockWidth = (blockOptions.blockX || 1) * gridOptions.basisX;
        let blockHeight = (blockOptions.blockY || 1) * gridOptions.basisY;
        let blockCols = (blockOptions.sizeX || 1) / (blockOptions.blockX || 1);
        let blockRows = (blockOptions.sizeY || 1) / (blockOptions.blockY || 1);
        for (let i = 0; i < blockOptions.blockSrc.length; i++) {
            let colNum = i % blockCols;
            let rowNum = (i - colNum) / blockCols;
            let blockItemPosition = {
                left: colNum * gridOptions.basisX,
                top: rowNum * gridOptions.basisY,
            };

            let src = path.join(inputOptions.path, `${blockOptions.blockSrc[0]}.${inputOptions.format}`);
            if (fse.existsSync(src)) {
                let blockItemData = await sharp(src)
                    .resize(blockWidth, blockHeight)
                    .toFormat(inputOptions.format)
                    .toBuffer();
                blockStepData = await sharp(blockStepData)
                    .overlayWith(blockItemData, blockItemPosition)
                    .toBuffer();
            }
        }
        return blockStepData;
    }
}

module.exports = BaseProcessor;

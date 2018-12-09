const sharp = require('sharp');
const fse = require('fs-extra');
const path = require('path');
const mapFormat = require('./map-format');

async function loadSheets(sheets) {
    let loadedOptions = new Array(sheets.length);
    for (let i = 0; i < sheets.length; i++) {
        loadedOptions[i] = await fse.readJson(sheets[i]);
    }
    return loadedOptions;
}

async function resolvePaths(options, sheets, cache) {
    let cachePath = path.resolve(cache);
    await fse.ensureDir(cachePath);
    let resolvedOptions = new Array(options.length);
    for (let i = 0; i < options.length; i++) {
        let basePath = path.dirname(path.resolve(sheets[i]));
        resolvedOptions[i] = Object.assign({}, options[i], {
            input: Object.assign({}, options[i].input, {
                path: path.join(basePath, options[i].input.path),
            }),
            output: Object.assign({}, options[i].output, {
                path: path.join(cachePath, options[i].output.path),
            }),
        });
    }
    return resolvedOptions;
}

async function validateOptions(options, sheets) {
    let allValid = true;
    for (let i = 0; i < options.length; i++) {
        let result = mapFormat.test(options[i]);
        if (!result.valid) {
            console.log(`${sheets[i]} is not valid:`, result.reason);
            allValid = false;
        }
    }
    return allValid;
}

async function validateFiles(blockOptions) {
    console.log('Not Implemented: Testing File Existence');
    //for (let i = 0; i < data.options.length; i++) {
    //}
    return true;
}

async function generate(options) {
    for (let i = 0; i < options.length; i++) {
        await generateImage(options[i]);
    }
}

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
            .toFormat(inputOptions.format);
        let blockWidth = (blockOptions.blockX || 1) * gridOptions.basisX;
        let blockHeight = (blockOptions.blockY || 1) * gridOptions.basisY;
        let blockCols = (blockOptions.sizeX || 1) / (blockOptions.blockX || 1);
        let blockRows = (blockOptions.sizeY || 1) / (blockOptions.blockY || 1);
        for (let i = 0; i < blockOptions.blockSrc.length; i++) {
            let src = path.join(inputOptions.path, `${blockOptions.blockSrc[0]}.${inputOptions.format}`);
            if (fse.existsSync(src)) {
                let blockItemData = await sharp(src)
                    .resize(blockWidth, blockHeight)
                    .toFormat(inputOptions.format)
                    .toBuffer();

                let colNum = i % blockCols;
                let rowNum = (i - colNum) / blockCols;
                let blockItemPosition = {
                    left: colNum * gridOptions.basisX,
                    top: rowNum * gridOptions.basisY,
                };
                blockStepData.overlayWith(blockItemData, blockItemPosition);
            }
        }
        return blockStepData.toBuffer();
    }
}

module.exports = {
    generate: async ({ sheets = [], cache = '.spritemap-cache' } = {}) => {
        let originalOptions = await loadSheets(sheets);
        let resolvedOptions = await resolvePaths(originalOptions, sheets, cache);
        let validOptions = await validateOptions(resolvedOptions, sheets);
        if (!validOptions) {
            console.log(mapFormat.spec('[options]'));
            return false;
        }
        console.log('All sheets are valid.');
        let validFiles = await validateFiles(resolvedOptions);
        if (!validFiles) {
            console.log('Files are missing.');
            return false;
        }
        console.log('All files are valid.');
        try {
            await generate(resolvedOptions);
        } catch (err) {
            console.error(err);
            return false;
        }
        console.log('All files generated.');
        return true;
    },
    testFiles: async ({ sheets = [], cache = '.spritemap-cache' } = {}) => {
        let originalOptions = await loadSheets(sheets);
        let resolvedOptions = await resolvePaths(originalOptions, sheets, cache);
        let validOptions = await validateOptions(resolvedOptions);
        if (!validOptions) {
            console.log(mapFormat.spec('[options]'));
            return false;
        }
        console.log('All sheets are valid.');
        let validFiles = await validateFiles(resolvedOptions);
        if (!validFiles) {
            console.log('Files are missing.');
            return false;
        }
        console.log('All files are valid.');
        return true;
    },
    test: async ({ sheets = [], cache = '.spritemap-cache' } = {}) => {
        let originalOptions = await loadSheets(sheets);
        let resolvedOptions = await resolvePaths(originalOptions, sheets, cache);
        let validOptions = await validateOptions(resolvedOptions, sheets);
        if (!validOptions) {
            return false;
        }
        console.log('All sheets are valid.');
        return true;
    },
};
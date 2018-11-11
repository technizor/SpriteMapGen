const sharp = require('sharp');
const fse = require('fs-extra');
const path = require('path');
const mapFormat = require('./map-format');

async function procedure (sheets, cache = '.spritemap-cache') {
    let cachePath = path.resolve(cache);
    await fse.ensureDir(cachePath);
    for (let i = 0; i < sheets.length; i++) {
        let configPath = path.resolve(sheets[i]);
        try {
            let options = await fse.readJson(configPath);
            let basePath = path.dirname(configPath);
            options.input.path = path.join(basePath, options.input.path);
            options.output.path = path.join(cachePath, options.output.path);

            if (!mapFormat.test(options)) {
                throw new Error(mapFormat.spec('[options]'));
            }
            await produce(options);
        } catch (err) {
            console.log(err);
        }
    }
}
async function produce(options) {
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
        throw new Error(`Not Implemented`);
    }
}

module.exports = procedure;
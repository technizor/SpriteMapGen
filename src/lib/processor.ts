import * as fse from 'fs-extra';
import * as path from 'path';
import * as sharp from 'sharp';
import mapFormat from './map-format';
import { OptionsValue, IOValue, GridValue, BlockEntry, SpriteBlockEntry, MapBlockEntry, BlockBlockEntry } from './map-format/types';

class Processor {
    public _map: any;
    public _cache: any;
    public _stack: Array<any>;
    constructor(map: any, cache: any, stack: Array<any> = []) {
        if (!map) throw new Error("Map is required.");
        if (!cache) throw new Error("Cache is required.");
        if (!stack) throw new Error("Stack is required.");

        this._map = map;
        this._cache = cache;
        this._stack = stack;
    }
}

class BaseProcessor extends Processor {
    constructor(map: any, cache: any, stack: Array<any>) {
        super(map, cache, stack);
    }

    async loadOptions(): Promise<ResolvedProcessor> {
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

        let stack = [];
        for (let i = 0; i < options.blocks.length; i++) {
            if (options.blocks[i].map !== undefined && options.blocks[i].map !== null) {
                let src = path.join(options.input.path, options.blocks[i].map);
                let subMap = new BaseProcessor(src, this._cache, []);
                stack[i] = await subMap.loadOptions();
            }
        }
        return new ResolvedProcessor(this._map, this._cache, stack, rawOptions, options);
    }
}

class ResolvedProcessor extends Processor {
    public _rawOptions: any;
    public _options: any;
    constructor(map: any, cache: any, stack: Array<any>, rawOptions: any, options: any) {
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
        let stack = [];
        for (let i = 0; i < this._options.blocks.length; i++) {
            if (this._options.blocks[i].map !== undefined && this._options.blocks[i].map !== null) {
                stack[i] = await this._stack[i].validate();
            }
        }
        console.log('Not Implemented: Testing File Existence');
        return new ValidatedProcessor(this._map, this._cache, stack, this._rawOptions, this._options, true, true);
    }
}

class ValidatedProcessor extends ResolvedProcessor {
    public _validOptions: any;
    public _validFiles: any;
    constructor(map: any, cache: any, stack: Array<any>, rawOptions: any, options: any, validOptions: any, validFiles: any) {
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
        await generateImage(this._options, this._stack);
    }
}

interface BlockItemPositionFunc {
    (idx: number): { left: number, top: number }
}

// Generator Functions
async function generateImage(options: OptionsValue, stack: any) {
    let inputOptions = options.input;
    let gridOptions = options.grid;
    const width = gridOptions.sizeX * gridOptions.basisX;
    const height = gridOptions.sizeY * gridOptions.basisY;
    const channels: sharp.Channels = 4;
    const background = '#00000000';
    const canvasOptions = { create: { width, height, channels, background } };
    let stepData = await sharp(undefined, canvasOptions)
        .toFormat(inputOptions.format)
        .toBuffer();
    for (let i = 0; i < options.blocks.length; i++) {
        let blockOptions = options.blocks[i];
        let blockPosition = {
            left: blockOptions.x * gridOptions.basisX,
            top: blockOptions.y * gridOptions.basisY,
        };
        let blockData = await getSpriteBuffer(inputOptions, gridOptions, blockOptions, stack[i]);
        stepData = await sharp(stepData)
            .overlayWith(blockData!, blockPosition)
            .toBuffer();
    }
    let outputOptions = options.output;
    let tempPath = `${outputOptions.path}.${outputOptions.format}`;
    await sharp(stepData)
        .toFormat(outputOptions.format)
        .toFile(tempPath);
    return tempPath;
}

async function getSpriteBuffer(inputOptions: IOValue, gridOptions: GridValue, blockOptions: BlockEntry, subMap: ValidatedProcessor): Promise<Buffer | undefined> {
    let width = (blockOptions.sizeX || 1) * gridOptions.basisX;
    let height = (blockOptions.sizeY || 1) * gridOptions.basisY;
    if ((blockOptions as SpriteBlockEntry).src) {
        let spriteBlockOptions = blockOptions as SpriteBlockEntry;
        let src = path.join(inputOptions.path, `${spriteBlockOptions.src}.${inputOptions.format}`);
        if (fse.existsSync(src)) {
            return await sharp(src)
                .resize(width, height)
                .toFormat(inputOptions.format)
                .toBuffer();
        } else {
            throw new Error(`DNE: ${src}`);
        }
    } else if ((blockOptions as MapBlockEntry).map) {
        await subMap.generate();
        let subOutputOptions = subMap._options.output;
        let subOutputPath = `${subOutputOptions.path}.${subOutputOptions.format}`;
        if (fse.existsSync(subOutputPath)) {
            return await sharp(subOutputPath)
                .resize(width, height)
                .toFormat(inputOptions.format)
                .toBuffer();
        } else {
            throw new Error(`DNE: ${subOutputPath}`);
        }
    } else if ((blockOptions as BlockBlockEntry).blockSrc) {
        let bbo = (blockOptions as BlockBlockEntry);
        const channels: sharp.Channels = 4;
        const background = '#00000000';
        const canvasOptions = { create: { width, height, channels, background } };
        let blockStepData = await sharp(undefined, canvasOptions)
            .toFormat(inputOptions.format)
            .toBuffer();
        let blockWidth = (bbo.blockX || 1) * gridOptions.basisX;
        let blockHeight = (bbo.blockY || 1) * gridOptions.basisY;
        let blockCols = (bbo.sizeX || 1) / (bbo.blockX || 1);
        let blockRows = (bbo.sizeY || 1) / (bbo.blockY || 1);
        let blockDir = bbo.blockDir || 'row';
        let bipFunc: BlockItemPositionFunc = blockDir === 'row' ?
            (idx: number) => {
                let colNum = idx % blockCols;
                let rowNum = (idx - colNum) / blockCols;
                return {
                    left: colNum * gridOptions.basisX,
                    top: rowNum * gridOptions.basisY,
                };
            } :
            (idx: number) => {
                let rowNum = idx % blockRows;
                let colNum = (idx - rowNum) / blockRows;
                return {
                    left: colNum * gridOptions.basisX,
                    top: rowNum * gridOptions.basisY,
                };
            };
        for (let i = 0; i < bbo.blockSrc.length; i++) {
            let blockItemPosition = bipFunc(i);

            let src = path.join(inputOptions.path, `${bbo.blockSrc[i]}.${inputOptions.format}`);
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
    return undefined;
}

export default BaseProcessor;

export { Processor, BaseProcessor, ResolvedProcessor, ValidatedProcessor };
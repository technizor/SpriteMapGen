import * as fse from 'fs-extra';
import * as path from 'path';
import * as sharp from 'sharp';
import mapFormat from 'src/map-format';
import { OptionsValue, IOValue, GridValue, BlockEntry, SpriteBlockEntry, MapBlockEntry, BlockBlockEntry } from 'src/map-format/types';

class Processor<T extends Processor<T>> {
    private _mapPath: string;
    private _cachePath: string;
    private _stack: Array<T>;
    constructor(mapPath: string, cachePath: string, stack: Array<T> = []) {
        if (!mapPath) throw new Error("Map is required.");
        if (!cachePath) throw new Error("Cache is required.");
        if (!stack) throw new Error("Stack is required.");

        this._mapPath = mapPath;
        this._cachePath = cachePath;
        this._stack = stack;
    }

    getMapPath() { return this._mapPath; }
    getCachePath() { return this._cachePath; }
    getStack() { return this._stack; }
}

class BaseProcessor extends Processor<BaseProcessor> {
    constructor(mapPath: string, cachePath: string, stack: Array<BaseProcessor>) { super(mapPath, cachePath, stack); }

    async loadOptions(): Promise<ResolvedProcessor> {
        let cachePath = path.resolve(this.getCachePath());
        let basePath = path.dirname(path.resolve(this.getMapPath()));

        let rawOptions = await fse.readJson(this.getMapPath()) as OptionsValue;
        let options = Object.assign({}, rawOptions,  {
            input: Object.assign({}, rawOptions.input, { path: path.join(basePath, rawOptions.input.path) }),
            output: Object.assign({}, rawOptions.output, { path: path.join(cachePath, rawOptions.output.path) }),
        }) as OptionsValue;

        let stack = await Promise.all<ResolvedProcessor>(options.blocks.filter(blk => (blk as MapBlockEntry).map)
            .map(blk => blk as MapBlockEntry)
            .map(blk => {
                let src = path.join(options.input.path, blk.map);
                let subMap = new BaseProcessor(src, this.getCachePath(), []);
                return subMap.loadOptions();
        }));
        return new ResolvedProcessor(this.getMapPath(), this.getCachePath(), stack, rawOptions, options);
    }
}

class ResolvedProcessor extends Processor<ResolvedProcessor> {
    private _rawOptions: OptionsValue;
    private _options: OptionsValue;
    constructor(mapPath: string, cachePath: string, stack: Array<ResolvedProcessor>, rawOptions: OptionsValue, options: OptionsValue) {
        super(mapPath, cachePath, stack);
        this._rawOptions = rawOptions;
        this._options = options;
    }

    getRawOptions() { return this._rawOptions; }
    getOptions() { return this._options; }

    async validate(): Promise<ValidatedProcessor> {
        let result = mapFormat.test(this._options);

        let stack = await Promise.all(this.getStack().map(p => p.validate()));
        if (!result.valid) {
            console.log(`${this.getMapPath()} is not valid:`, result.reason);
            return new ValidatedProcessor(this.getMapPath(), this.getCachePath(), stack, this.getRawOptions(), this.getOptions(), false, false);
        }
        console.log('Not Implemented: Testing File Existence');
        return new ValidatedProcessor(this.getMapPath(), this.getCachePath(), stack, this.getRawOptions(), this.getOptions(), true, true);
    }
}

class ValidatedProcessor extends Processor<ValidatedProcessor> {
    private _rawOptions: OptionsValue;
    private _options: OptionsValue;
    private _validOptions: boolean;
    private _validFiles: boolean;
    constructor(mapPath: string, cachePath: string, stack: Array<ValidatedProcessor>, rawOptions: OptionsValue, options: OptionsValue, validOptions: boolean, validFiles: boolean) {
        super(mapPath, cachePath, stack);
        this._rawOptions = rawOptions;
        this._options = options;
        this._validOptions = validOptions;
        this._validFiles = validFiles;
    }

    getRawOptions() { return this._rawOptions; }
    getOptions() { return this._options; }
    isValid() { return this._validOptions && this._validFiles; }
    isOptionsValid() { return this._validOptions; }
    isFilesValid() { return this._validFiles; }

    async generate() {
        if (!this.isValid()) {
            console.log('Map is invalid. Cannot generate spritemap.');
            return;
        }
        await generateImage(this._options, this.getStack());

        let outputFile = `${this._options.output.path}.${this._options.output.format}`;
        console.log(this.getMapPath(), '->', outputFile);
        return outputFile;
    }
}

interface BlockItemPositionFunc {
    (idx: number): { left: number, top: number }
}

// Generator Functions
async function generateImage(options: OptionsValue, stack: Array<ValidatedProcessor>) {
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
        let subOutputOptions = subMap.getOptions().output;
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
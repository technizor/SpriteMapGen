import * as fse from 'fs-extra';
import BaseProcessor, {Processor, ResolvedProcessor, ValidatedProcessor} from './processor';
import mapFormat from './map-format';

class StepResult<T extends Processor<T>> {
    private _success: boolean;
    private _processors: Array<T>;
    private _cachePath: string;

    constructor(success: boolean, processors: Array<T>, cachePath: string) {
        this._success = success;
        this._processors = processors;
        this._cachePath = cachePath;
    }

    isSuccess() { return this._success; }
    getProcessors() { return this._processors; }
    getCachePath() { return this._cachePath; }
}

interface LoadArguments {
    mapPaths?: Array<string>,
    cachePath?: string,
}

async function loadStep(opts: LoadArguments = {}) {
    let mapPaths = opts.mapPaths || [];
    let cachePath = opts.cachePath || '.spritemap-cache';

    await fse.ensureDir(cachePath);

    let processors = await Promise.all(mapPaths
        .map(s => new BaseProcessor(s, cachePath, []))
        .map(bp => bp.loadOptions()));
    return new StepResult(true, processors, cachePath);
}

async function validateStep(processors: Array<ResolvedProcessor>, cachePath: string) {
    let validatedProcessors = await Promise.all(processors.map(p => p.validate()))

    if (validatedProcessors.findIndex(p => !p.isOptionsValid()) !== -1) {
        console.log(mapFormat.spec('[options]'));
        return new StepResult(false, validatedProcessors, cachePath);
    }
    console.log('All maps are valid.');

    if (validatedProcessors.findIndex(p => !p.isFilesValid()) !== -1) {
        console.log('Files are missing.');
        return new StepResult(false, validatedProcessors, cachePath);
    }
    console.log('All files are valid.');
    return new StepResult(true, validatedProcessors, cachePath);
}

async function generateStep(processors: Array<ValidatedProcessor>, cachePath: string) {
    return await Promise.all(processors.map(p => `${p.getMapPath()} -> ${p.generate()}`))
    .then(() => {
        console.log('All files generated.');

        return new StepResult(true, processors, cachePath);
    }).catch((err: any) => {
        console.error(err);
        return new StepResult(false, processors, cachePath);
    });
}

export default {
    mapFormat,
    
    generate: async (options: LoadArguments) => {
        let loadResult = await loadStep(options);
        if (!loadResult.isSuccess()) {
            return false;
        }

        let validateResult = await validateStep(loadResult.getProcessors(), loadResult.getCachePath());
        if (!validateResult.isSuccess()) {
            return false;
        }

        let generateResult = await generateStep(validateResult.getProcessors(), validateResult.getCachePath());
        if (!generateResult.isSuccess()) {
            return false;
        }

        return true;
    },
    test: async (options: LoadArguments) => {
        let loadResult = await loadStep(options);
        if (!loadResult.isSuccess()) {
            return false;
        }

        let validateResult = await validateStep(loadResult.getProcessors(), loadResult.getCachePath());
        if (!validateResult.isSuccess()) {
            return false;
        }

        return true;
    },
};
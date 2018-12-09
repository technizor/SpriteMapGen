const fse = require('fs-extra');
const path = require('path');
const Processor = require('./processor');

class StepResult {
    constructor(success, processors, cache) {
        this._success = success;
        this._processors = processors;
        this._cache = cache;
    }
}

async function loadStep({ maps = [], cache = '.spritemap-cache' } = {}) {
    await fse.ensureDir(cache);

    let processors = maps.map(s => new Processor(s, cache));
    for (let i = 0; i < processors.length; i++) {
        processors[i] = await processors[i].loadOptions();
    }
    return new StepResult(true, processors, cache);
}

async function validateStep (processors, cache) {
    let nextProcessors = new Array(processors.length);
    for (let i = 0; i < processors.length; i++) {
        nextProcessors[i] = await processors[i].validate();
    }
    if (nextProcessors.findIndex(p => !p.isOptionsValid()) != -1) {
        console.log(mapFormat.spec('[options]'));
        return new StepResult(false, nextProcessors, cache);
    }
    console.log('All maps are valid.');

    if (nextProcessors.findIndex(p => !p.isFilesValid()) != -1) {
        console.log('Files are missing.');
        return new StepResult(false, nextProcessors, cache);
    }
    console.log('All files are valid.');
    return new StepResult(true, nextProcessors, cache);
}

async function generateStep(processors, cache) {
    try {
        for (let i = 0; i < processors.length; i++) {
            await processors[i].generate();
            console.log(`${processors[i]._map} -> ${processors[i]._options.output.path}.${processors[i]._options.output.format}`);
        }
    } catch (err) {
        console.error(err);
        return new StepResult(false, processors, cache);
    }
    console.log('All files generated.');

    return new StepResult(true, processors, cache);
}

module.exports = {
    generate: async (options) => {
        let loadResult = await loadStep(options);
        if (!loadResult._success) {
            return false;
        }

        let validateResult = await validateStep(loadResult._processors, loadResult._cache);
        if (!validateResult._success) {
            return false;
        }

        let generateResult = await generateStep(validateResult._processors, validateResult._cache);
        if (!generateResult._success) {
            return false;
        }

        return true;
    },
    test: async (options) => {
        let loadResult = await loadStep(options);
        if (!loadResult._success) {
            return false;
        }

        let validateResult = await validateStep(loadResult._processors, loadResult._cache);
        if (!validateResult._success) {
            return false;
        }

        return true;
    },
};
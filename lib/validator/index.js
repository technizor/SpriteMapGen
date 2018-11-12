const ValidationResult = require('./validation-result');
const specFactory = require('./spec');

const indent = (str) => str.split('\n')
    .map(line => `  ${line}`)
    .join('\n');

const tester = (optional, steps) => (value) => {
    if (value === undefined) return new ValidationResult(optional, 'required value was undefined');
    if (value === null) return new ValidationResult(optional, 'required value was null');
    let standardSpecs = steps.filter(spec => spec.type === 'value' || spec.type === 'enum' || spec.type === 'prop' || spec.type === 'entry' || spec.type === 'case');
    let customSpecs = steps.filter(spec => spec.type === 'custom');
    
    let specToTestMapper = spec => {
        try {
            return { spec, result: spec.test(value) };
        } catch (error) {
            return { spec, result: new ValidationResult(false, { error }) };
        }
    };
    let testFailFilter = t => !t.result.valid;
    let testToReasonMapper = res => ({ [res.spec.name]: res.result.reason });
    let customSpecToReasonMapper = spec => ({ [spec.name]: 'preconditions failed' });

    let standardTest = standardSpecs.map(specToTestMapper);
    let standardTestFails = standardTest.filter(testFailFilter);
    if (standardTestFails.length > 0) {
        let reason = Object.assign({}, ...standardTestFails.map(testToReasonMapper), ...customSpecs.map(customSpecToReasonMapper));
        return new ValidationResult(false, reason);
    }

    let customTest = customSpecs.map(specToTestMapper);
    let customTestFails = customTest.filter(testFailFilter);
    
    let overallTestFails = [...standardTestFails, ...customTestFails];
    if (overallTestFails.length > 0) {
        let reason = Object.assign({}, ...overallTestFails.map(testToReasonMapper));
        return new ValidationResult(false, reason);
    }
    return new ValidationResult(true);
};

class Validator {
    constructor({ optional = false, defaultValue = undefined, type = 'undefined', steps = [] } = {}) {
        this._optional = optional;
        this._defaultValue = defaultValue;
        this._type = type;
        this._steps = steps;
    }

    getType() { return this._type; }

    eq(x) {
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.eq(x)]),
        });
    }
    neq(x) {
        return new this.constructor({ 
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: this._steps.concat([specFactory.neq(x)]),
        });
    }

    enum() {
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type,
            steps: this._steps.concat([specFactory.enum(Array.prototype.slice.call(arguments))]),
        });
    }
    nenum() {
        return new this.constructor({
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: this._steps.concat([specFactory.nenum(Array.prototype.slice.call(arguments))]),
        });
    }
    getEnum(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'enum' && spec.name === 'enum')[n];
        return spec && spec.vals;
    }
    getNenum(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'enum' && spec.name === 'nenum')[n];
        return spec && spec.vals;
    }

    case() {
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type,
            steps: this._steps.concat([specFactory.case(Array.prototype.slice.call(arguments))]),
        });
    }
    ncase() {
        return new this.constructor({
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: this._steps.concat([specFactory.ncase(Array.prototype.slice.call(arguments))]),
        });
    }
    getCase(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'case' && spec.name === 'case')[n];
        return spec && spec.caseValidators;
    }
    getNcase(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'case' && spec.name === 'ncase')[n];
        return spec && spec.caseValidators;
    }

    required() {
        return new this.constructor({
            optional: false,
            defaultValue: undefined,
            type: this._type,
            steps: this._steps,
        });
    }
    optional(defaultValue) {
        return new this.constructor({
            optional: true,
            defaultValue,
            type: this._type,
            steps: this._steps,
        });
    }
    getOptional() {
        return this._optional;
    }
    getDefault() {
        return this._default;
    }

    validate(validatorName, validatorFunc) {
        return new this.constructor({
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: this._steps.concat([specFactory.validate(validatorName, validatorFunc)]),
        });
    }
    getValidate(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'custom')[n];
        return spec && spec.validatorFunc;
    }

    test(value) {
        if (arguments.length > 1) {
            return Array.prototype.slice.call(arguments)
                .map(tester(this._optional, this._steps));
        }
        return tester(this._optional, this._steps)(value);
    }
    spec(name) {
        let simpleSpecs = this._steps.filter(spec => spec.type === 'value' || spec.type === 'enum');
        let complexSpecs = this._steps.filter(spec => spec.type === 'prop' || spec.type === 'entry' || spec.type === 'case');
        let customSpecs = this._steps.filter(spec => spec.type === 'custom');
        let prefix = `${name}${this._optional ? '?' : ''}:${this._type}`;
        let line = `${prefix}${simpleSpecs.length > 0 ? ` ${simpleSpecs.map(spec => spec.display()).join(' ')}` : ''}`;
        return [
            line,
            ...complexSpecs.map(spec => indent(spec.display())),
            ...customSpecs.map(spec => indent(spec.display())),
        ].join('\n');
    }
}

class BaseValidator extends Validator {
    constructor(options) {
        super(options);
    }

    object() {
        return new ObjectValidator({
            optional: this._optional,
            defaultValue: this._defaultValue, 
            type: 'object', 
            steps: this._steps.concat([specFactory.object()]),
        }); 
    }
    type(type) { 
        return new ObjectValidator({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: type && type.name, 
            steps: this._steps.concat([specFactory.type(type)]),
        });
    }
    string() { 
        return new PrimitiveValidator({
            optional: this._optional,
            defaultValue: this._defaultValue, 
            type: 'string', 
            steps: this._steps.concat([specFactory.string()]),
        });
    }
    number() {
        return new NumberValidator({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: 'number', 
            steps: this._steps.concat([specFactory.number()]),
        }); 
    }
    boolean() {
        return new PrimitiveValidator({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: 'boolean', 
            steps: this._steps.concat([specFactory.boolean()]),
        }); 
    }
    array() {
        return new ArrayValidator({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: 'array',
            steps: this._steps.concat([specFactory.array()]),
        }); 
    }
}

class PrimitiveValidator extends Validator {
    constructor(options) {
        super(options);
    }

    lt(x) {
        return this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.lt(x)]),
        }); 
    }
    lteq(x) { 
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.lteq(x)]),
        }); 
    }
    gt(x) { 
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.gt(x)]),
        }); 
    }
    gteq(x) { 
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.gteq(x)]),
        }); 
    }
}

class NumberValidator extends PrimitiveValidator {
    constructor(options) {
        super(options);
    }

    integer() {
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.integer()]),
        }); 
    }
    finite() { 
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.finite()]),
        }); 
    }
    nan() { 
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.nan()]),
        }); 
    }
}

class ObjectValidator extends Validator {
    constructor(options) {
        super(options);
    }

    prop(propName, propValidator = new Validator()) { 
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.prop(propName, propValidator)]),
        }); 
    }

    getProp(propName, n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'prop' && spec.name === `[${propName}]`)[n];
        return spec && spec.propValidator;
    }
}

class ArrayValidator extends ObjectValidator {
    constructor(options) {
        super(options);
    }

    every(entryValidator = new Validator()) { 
        return new this.constructor({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.every(entryValidator)]),
        }); 
    }

    getEvery(n = 0) {
        let spec = this.filter(spec => spec.type === 'entry')[n];
        return spec && spec.entryValidator;
    }
}

module.exports = new BaseValidator();
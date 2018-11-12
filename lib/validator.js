const specFactory = {
    // Type Value Checks
    object: () => new TypeSpec('object', value => {
        let valid = (typeof value === 'object' || value.constructor === Object);
        let reason = { expected: 'object' };
        return new ValidationResult(valid, reason);
    }),
    type: (type) => new TypeSpec(`type(${type && type.name})`, value => {
        let valid = (value.constructor === type);
        let reason = { expected: type && type.name };
        return new ValidationResult(valid, reason);
    }),
    string: () => new TypeSpec('string', value => {
        let valid = (typeof value === 'string' || value.constructor === String);
        let reason = { expected: 'string' };
        return new ValidationResult(valid, reason);
    }),
    number: () => new TypeSpec('number', value => {
        let valid = (typeof value === 'number' || value.constructor === Number);
        let reason = { expected: 'number' };
        return new ValidationResult(valid, reason);
    }),
    boolean: () => new TypeSpec('boolean', value => {
        let valid = (typeof value === 'boolean' || value.constructor === Boolean);
        let reason = { expected: 'boolean' };
        return new ValidationResult(valid, reason);
    }),
    array: () => new TypeSpec('array', value => {
        let valid = (typeof value === 'object' && value.constructor === Array);
        let reason = { expected: 'array' };
        return new ValidationResult(valid, reason);
    }),
    // Number Value Checks
    integer: () => new ValueSpec('integer', value => {
        let valid = Number.isInteger(value);
        let reason = { expected: 'integer' };
        return new ValidationResult(valid, reason);
    }),
    finite: () => new ValueSpec('finite', value => {
        let valid = Number.isFinite(value);
        let reason = { expected: 'finite' };
        return new ValidationResult(valid, reason);
    }),
    nan: () => new ValueSpec('nan', value => {
        let valid = Number.isNaN(value);
        let reason = { expected: 'NaN' };
        return new ValidationResult(valid, reason);
    }),
    // Value Checks
    lt: (x) => new ValueSpec(`lt(${x})`, value => {
        let valid = value < x;
        let reason = { expected: `lt(${x})` };
        return new ValidationResult(valid, reason);
    }),
    lteq: (x) => new ValueSpec(`lteq(${x})`, value => {
        let valid = value <= x;
        let reason = { expected: `lteq(${x})` };
        return new ValidationResult(valid, reason);
    }),
    gt: (x) => new ValueSpec(`gt(${x})`, value => {
        let valid = value > x;
        let reason = { expected: `gt(${x})` };
        return new ValidationResult(valid, reason);
    }),
    gteq: (x) => new ValueSpec(`gteq(${x})`, value => {
        let valid = value >= x;
        let reason = { expected: `gteq(${x})` };
        return new ValidationResult(valid, reason);
    }),
    eq: (x) => new ValueSpec(`eq(${x})`, value => {
        let valid = value === x;
        let reason = { expected: `eq(${x})` };
        return new ValidationResult(valid, reason);
    }),
    neq: (x) => new ValueSpec(`neq(${x})`, value => {
        let valid = value !== x;
        let reason = { expected: `neq(${x})` };
        return new ValidationResult(valid, reason);
    }),
    enum: (vals) => new EnumSpec('enum', true, vals),
    nenum: (vals) => new EnumSpec('nenum', false, vals),
    case: (caseValidators) => new CaseSpec('case', true, caseValidators),
    ncase: (caseValidators) => new CaseSpec('ncase', false, caseValidators),
    // Object Property Value Checks
    prop: (propName, propValidator) => new PropSpec(`[${propName}]`, propValidator),
    // Array Property Value Checks
    every: (entryValidator) => new EntrySpec('every', entryValidator),
    // Custom Validation
    validate: (validationName, validationFunction) => new CustomSpec(`<validate(${validationName})>`, validationFunction),
};
const vf = {
    printTree: (str) => str.split('\n')
        .map(line => `  ${line}`)
        .join('\n'),
    test: (optional, steps) => (value) => {
        if (value === undefined) return new ValidationResult(optional, 'required value was undefined');
        if (value === null) return new ValidationResult(optional, 'required value was null');
        let standardSpecs = steps.filter(spec => spec.type === 'value' || spec.type === 'prop' || spec.type === 'entry' || spec.type === 'case');
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
    },
};
class ValidationResult {
    constructor(valid, reason) {
        this.valid = valid;
        this.reason = reason;
    }
}

class Spec {
    constructor(type, name, test) {
        this.type = type;
        this.name = name;
        this.test = test;
    }

    display() {
        return '~';
    }
}

class TypeSpec extends Spec {
    constructor(name, test) {
        super('type', name, test);
    }
    display() {
        return '';
    }
}

class ValueSpec extends Spec {
    constructor(name, test) {
        super('value', name, test);
    }
    display() {
        return this.name;
    }
}

class EnumSpec extends ValueSpec {
    constructor(name, inclusive, vals) {
        super('enum', name, value => {
            let valid = vals.includes(value) === inclusive;
            let reason = { expected: this.display() };
            return new ValidationResult(valid, reason);
        });

        this.inclusive = inclusive;
        this.vals = vals;
    }

    display() {
        return `${this.name}(${this.vals.join(',')})`;
    }
}

class PropSpec extends Spec {
    constructor(name, propValidator) {
        super('prop', name, value => {
            if (typeof value !== 'object' && value.constructor !== Object) {
                let reason = { expected: 'object' };
                return new ValidationResult(false, reason);
            }
            let propResult = propValidator.test(value[propName]);
            let valid = propResult.valid;
            let reason = propResult.reason;
            return new ValidationResult(valid, reason);
        });

        this.propValidator = propValidator;
    }
    display() {
        return this.propValidator.spec(`${this.name}`);
    }
}

class EntrySpec extends Spec {
    constructor(name, entryValidator) {
        super('entry', name, value => {
            if (typeof value !== 'object' || value.constructor !== Array) {
                let reason = { expected: 'array' };
                return new ValidationResult(false, reason);
            }
            let entryResult = value.map(v => entryValidator.test(v));
            let entryFails = entryResult.filter(res => !res.valid).map(res => res.reason);
            let valid = entryFails.length === 0;
            let reason = { entry: entryFails };
            return new ValidationResult(valid, reason);
        });

        this.entryValidator = entryValidator;
    }
    display() {
        let entry = this.entryValidator.spec('<entry>');
        let prefix = `${this.name}(${entry})`;
        return prefix;
    }
}
class CaseSpec extends Spec {
    constructor(name, inclusive, caseValidators) {
        super('case', name, value => {
            let matchIndex = caseValidators.findIndex(caseVal => caseVal.test(value).valid);
            let valid = (matchIndex !== -1) === inclusive;
            let reason = 'case';
            return new ValidationResult(valid, reason);
        });

        this.caseValidators = caseValidators;
    }
    display() {
        return this.caseValidators
            .map((caseVal, index) => caseVal.spec(`<${this.name}(${index})>`))
            .join('\n');
    }
}
class CustomSpec extends Spec{
    constructor(name, validatorFunc) {
        super('custom', name, value => {
            let valid = validationFunction(value);
            let reason = 'custom validation';
            return new ValidationResult(valid, reason);
        });

        this.validatorFunc = validatorFunc;
    }
    display() {
        return this.name;
    }
}
class Validator {
    constructor({ optional = false, defaultValue = undefined, type = 'undefined', steps = [] } = {}) {
        this._optional = optional;
        this._defaultValue = defaultValue;
        this._type = type;
        this._steps = steps;
    }

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
        let spec = this.filter(spec => spec.type === 'value' && spec.name === 'enum')[n];
        return spec && spec.vals;
    }
    getNenum(n = 0) {
        let spec = this.filter(spec => spec.type === 'value' && spec.name === 'nenum')[n];
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
        let spec = this.filter(spec => spec.type === 'case' && spec.name === 'case')[n];
        return spec && spec.caseValidators;
    }
    getNcase(n = 0) {
        let spec = this.filter(spec => spec.type === 'case' && spec.name === 'ncase')[n];
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

    getType() { return this._type; }
    getOptional() { return this._optional; }
    getDefault() { return this._default; }

    validate(validationName, validationFunction) {
        return new this.constructor({
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: this._steps.concat([specFactory.validate(validationName, validationFunction)]),
        });
    }

    test(value) {
        if (arguments.length > 1) return Array.prototype.slice.call(arguments).map(vf.test(this._optional, this._steps));
        return vf.test(this._optional, this._steps)(value);
    }
    spec(name) {
        let simpleSpecs = this._steps.filter(spec => spec.type === 'value');
        let complexSpecs = this._steps.filter(spec => spec.type === 'prop' || spec.type === 'entry' || spec.type === 'case');
        let customSpecs = this._steps.filter(spec => spec.type === 'custom');
        let prefix = `${name}${this._optional ? '?' : ''}:${this._type}`;
        let line = `${prefix}${simpleSpecs.length > 0 ? ` ${simpleSpecs.map(spec => spec.display()).join(' ')}` : ''}`;
        return [
            line,
            ...complexSpecs.map(spec => vf.printTree(spec.display())),
            ...customSpecs.map(spec => vf.printTree(spec.display())),
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
const specFactory = {
    // Type Value Checks
    object: () => new TypeSpec('object', value => {
        let valid = (typeof value === 'object' || value.constructor === Object);
        return new ValidationResult(valid, { expected: 'object' });
    }),
    type: (type) => new TypeSpec(`type(${type && type.name})`, value => {
        let valid = (value.constructor === type);
        return new ValidationResult(valid, { expected: type && type.name });
    }),
    string: () => new TypeSpec('string', value => {
        let valid = (typeof value === 'string' || value.constructor === String);
        return new ValidationResult(valid, { expected: 'string' });
    }),
    number: () => new TypeSpec('number', value => {
        let valid = (typeof value === 'number' || value.constructor === Number);
        return new ValidationResult(valid, { expected: 'number' });
    }),
    boolean: () => new TypeSpec('boolean', value => {
        let valid = (typeof value === 'boolean' || value.constructor === Boolean);
        return new ValidationResult(valid, { expected: 'boolean' });
    }),
    array: () => new TypeSpec('array', value => {
        let valid = (typeof value === 'object' && value.constructor === Array);
        return new ValidationResult(valid, { expected: 'array' });
    }),
    // Number Value Checks
    integer: () => new ValueSpec('integer', value => {
        let valid = Number.isInteger(value);
        return new ValidationResult(valid, { expected: 'integer' });
    }),
    finite: () => new ValueSpec('finite', value => {
        let valid = Number.isFinite(value);
        return new ValidationResult(valid, { expected: 'finite' });
    }),
    nan: () => new ValueSpec('nan', value => {
        let valid = Number.isNaN(value);
        return new ValidationResult(valid, { expected: 'NaN' });
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
    enum: (vals) => new ValueSpec(`enum(${vals.join(',')})`, value => {
        let valid = vals.includes(value);
        let reason = { expected: `enum(${vals.join(',')})` };
        return new ValidationResult(valid, reason);
    }),
    nenum: (vals) => new ValueSpec(`nenum(${vals.join(',')})`, value => {
        let valid = !vals.includes(value);
        let reason = { expected: `nenum(${vals.join(',')})` };
        return new ValidationResult(valid, reason);
    }),
    case: (caseValidators) => new CaseSpec('case', value => {
        let valid = caseValidators.findIndex(caseVal => caseVal.test(value).valid) >= 0;
        let reason = 'case';
        return new ValidationResult(valid, reason);
    }, caseValidators),
    ncase: (caseValidators) => new CaseSpec('ncase', value => {
        let valid = caseValidators.findIndex(caseVal => caseVal.test(value).valid) === -1;
        let reason = 'ncase';
        return new ValidationResult(valid, reason);
    }, caseValidators),
    // Object Property Value Checks
    prop: (propName, propValidator) => new PropSpec(`[${propName}]`, value => {
        if (typeof value !== 'object' && value.constructor !== Object) {
            return new ValidationResult(false, { expected: 'object231' });
        }
        let propResult = propValidator.test(value[propName]);
        let valid = propResult.valid;
        let reason = propResult.reason;
        return new ValidationResult(valid, reason);
    }, propValidator),
    // Array Property Value Checks
    every: (entryValidator) => new EntrySpec('every', value => {
        if (typeof value !== 'object' || value.constructor !== Array) {
            return new ValidationResult(false, { expected: 'array' });
        }
        let entryResult = value.map(v => entryValidator.test(v));
        let entryFails = entryResult.filter(res => !res.valid).map(res => res.reason);
        let valid = entryFails.length === 0;
        let reason = { entry: entryFails };
        return new ValidationResult(valid, reason);
    }, entryValidator),
    count: (countValidator, entryValidator) => new EntrySpec('count', value => {
        if (typeof value !== 'object' || value.constructor !== Array) {
            return new ValidationResult(false, { expected: 'array' });
        }
        let entryResult = value.map(v => entryValidator.test(v));
        let entryFails = entryResult.filter(res => !res.valid).map(res => res.reason);
        let countResult = countValidator.test(entryResult.length - entryFails.length);
        let valid = countResult.valid;
        let reason = { count: countResult.reason, entry: entryFails };
        return new ValidationResult(valid, reason);
    }, entryValidator, countValidator),
    // Custom Validation
    validate: (validationName, validationFunction) => new CustomSpec(`validate<${validationName}>`, value => {
        let valid = validationFunction(value);
        let reason = 'custom validation';
        return new ValidationResult(valid, reason);
    }),
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
            } catch (err) {
                return { spec, result: new ValidationResult(false, { error: err }) };
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

class PropSpec extends Spec {
    constructor(name, test, propValidator) {
        super('prop', name, test);

        this.propValidator = propValidator;
    }
    display() {
        return this.propValidator.spec(`${this.name}`);
    }
}

class EntrySpec extends Spec {
    constructor(name, test, entryValidator, countValidator) {
        super('entry', name, test);

        this.entryValidator = entryValidator;
        this.countValidator = countValidator;
    }
    display() {
        let entry = this.entryValidator.spec('<entry>');
        let prefix = `${this.name}(${entry})`;
        if (this.countValidator) {
            return this.countValidator.spec(prefix);
        }
        return prefix;
    }
}
class CaseSpec extends Spec {
    constructor(name, test, caseValidators) {
        super('case', name, test);

        this.caseValidators = caseValidators;
    }
    display() {
        return this.caseValidators
            .map((caseVal, index) => caseVal.spec(`<${this.name}(${index})>`))
            .join('\n');
    }
}
class CustomSpec extends Spec{
    constructor(name, test) {
        super('custom', name, test);
    }
    display() {
        return this.name;
    }
}
class Validator {
    constructor(optional = false, type = 'undefined', steps = []) {
        this._optional = optional;
        this._type = type;
        this._steps = steps;
    }

    eq(x) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.eq(x)]); }
    neq(x) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.neq(x)]); }
    enum() { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.enum(Array.prototype.slice.call(arguments))]); }
    nenum() { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.nenum(Array.prototype.slice.call(arguments))]); }
    case() { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.case(Array.prototype.slice.call(arguments))]); }
    ncase() { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.ncase(Array.prototype.slice.call(arguments))]); }

    required() { return new this.constructor(false, this._type, this._steps); }
    optional() { return new this.constructor(true, this._type, this._steps); }
    validate(validationName, validationFunction) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.validate(validationName, validationFunction)]); }

    test(value) {
        if (arguments.length > 1) return Array.prototype.slice.call(arguments).map(vf.test(this._optional, this._steps));
        return vf.test(this._optional, this._steps)(value);
    }
    spec(name) {
        let simpleSpecs = this._steps.filter(spec => spec.type === 'value');
        let complexSpecs = this._steps.filter(spec => spec.type === 'prop' || spec.type === 'entry' || spec.type === 'case');
        let prefix = `${name}${this._optional ? '?' : ''}:${this._type}`;
        let line = `${prefix}${simpleSpecs.length > 0 ? ` ${simpleSpecs.map(spec => spec.display()).join(' ')}` : ''}`;
        return [
            line,
            ...complexSpecs.map(spec => vf.printTree(spec.display())),
        ].join('\n');
    }
}

class BaseValidator extends Validator {
    constructor(optional, type, steps) {
        super(optional, type, steps);
    }

    object() { return new ObjectValidator(this._optional, 'object', [...this._steps, specFactory.object()]); }
    type(type) { return new ObjectValidator(this._optional, type && type.name, [...this._steps, specFactory.type(type)]); }
    string() { return new PrimitiveValidator(this._optional, 'string', [...this._steps, specFactory.string()]); }
    number() { return new NumberValidator(this._optional, 'number', [...this._steps, specFactory.number()]); }
    boolean() { return new PrimitiveValidator(this._optional, 'boolean', [...this._steps, specFactory.boolean()]); }
    array() { return new ArrayValidator(this._optional, 'array', [...this._steps, specFactory.array()]); }
}

class PrimitiveValidator extends Validator {
    constructor(optional, type, steps) {
        super(optional, type, steps);
    }

    lt(x) { return this.constructor(this._optional, this._type, [...this._steps, specFactory.lt(x)]); }
    lteq(x) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.lteq(x)]); }
    gt(x) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.gt(x)]); }
    gteq(x) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.gteq(x)]); }
}

class NumberValidator extends PrimitiveValidator {
    constructor(optional, type, steps) {
        super(optional, type, steps);
    }

    integer() { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.integer()]); }
    finite() { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.finite()]); }
    nan() { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.nan()]); }
}

class ObjectValidator extends Validator {
    constructor(optional, type, steps) {
        super(optional, type, steps);
    }

    prop(propName, propValidator = new Validator()) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.prop(propName, propValidator)]); }
}

class ArrayValidator extends ObjectValidator {
    constructor(optional, type, steps) {
        super(optional, type, steps);
    }

    every(entryValidator = new Validator()) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.every(entryValidator)]); }
    count(entryValidator = new Validator(), countValidator = new Validator()) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.count(countValidator, entryValidator)]); }
}

module.exports = new BaseValidator();
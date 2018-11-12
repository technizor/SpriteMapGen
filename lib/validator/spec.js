const ValidationResult = require('./validation-result');

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

class EnumSpec extends Spec {
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
    constructor(propName, propValidator) {
        super('prop', `[${propName}]`, value => {
            if (typeof value !== 'object' && value.constructor !== Object) {
                let reason = { expected: 'object' };
                return new ValidationResult(false, reason);
            }
            let propResult = propValidator.test(value[propName]);
            let valid = propResult.valid;
            let reason = propResult.reason;
            return new ValidationResult(valid, reason);
        });

        this.propName = propName;
        this.propValidator = propValidator;
    }
    display() {
        return this.propValidator.spec(`${this.name}`);
    }
}

class EntrySpec extends Spec {
    constructor(entryValidator) {
        super('entry', 'entry', value => {
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
            let reason = { expected: 'any case validator passed' };
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

class CustomSpec extends Spec {
    constructor(validatorName, validatorFunc) {
        super('custom', `<validate(${validatorName})>`, value => {
            let valid = validatorFunc(value);
            let reason = { expected: 'validator function passed' };
            return new ValidationResult(valid, reason);
        });

        this.validatorFunc = validatorFunc;
    }
    display() {
        return this.name;
    }
}

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
    prop: (propName, propValidator) => new PropSpec(propName, propValidator),
    // Array Property Value Checks
    every: (entryValidator) => new EntrySpec(entryValidator),
    // Custom Validation
    validate: (validatorName, validatorFunc) => new CustomSpec(validatorName, validatorFunc),
};

module.exports = specFactory;
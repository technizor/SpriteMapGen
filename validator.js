const specFactory = {
    // Types
    object: () => new TypeSpec('object', value => (typeof value === 'object' || value.constructor === Object)),
    type: (type) => new TypeSpec(`type(${type && type.name})`, value => (value.constructor === type)),
    string: () => new TypeSpec('string', value => (typeof value === 'string' || value.constructor === String)),
    number: () => new TypeSpec('number', value => (typeof value === 'number' || value.constructor === Number)),
    boolean: () => new TypeSpec('boolean', value => (typeof value === 'boolean' || value.constructor === Boolean)),
    array: () => new TypeSpec('array', value => (typeof value === 'object' && value.constructor === Array)),
    // Number Value Checks
    integer: () => new ValueSpec('integer', value => Number.isInteger(value)),
    finite: () => new ValueSpec('finite', value => Number.isFinite(value)),
    nan: () => new ValueSpec('nan', value => Number.isNaN(value)),
    // Value Checks
    lt: (x) => new ValueSpec(`lt(${x})`, value => value < x),
    lteq: (x) => new ValueSpec(`lteq(${x})`, value => value <= x),
    gt: (x) => new ValueSpec(`gt(${x})`, value => value > x),
    gteq: (x) => new ValueSpec(`gteq(${x})`, value => value >= x),
    eq: (x) => new ValueSpec(`eq(${x})`, value => value === x),
    neq: (x) => new ValueSpec(`neq(${x})`, value => value !== x),
    enum: (vals) => new ValueSpec(`enum(${vals.join(',')})`, value => vals.includes(value)),
    nenum: (vals) => new ValueSpec(`nenum(${vals.join(',')})`, value => !vals.includes(value)),
    case: (caseValidators) => new CaseSpec(`case`, value => caseValidators.findIndex(caseVal => caseVal.test(value)) >= 0, caseValidators),
    ncase: (caseValidators) => new CaseSpec(`ncase`, value => caseValidators.findIndex(caseVal => caseVal.test(value)) === -1, caseValidators),
    // Object Property Value Checks
    prop: (propName, propValidator) => new PropSpec(`[${propName}]`,
        value => propValidator.test(value[propName]),
        propValidator),
    // Array Property Value Checks
    every: (entryValidator) => new EntrySpec('every',
        value => (typeof value === 'object' && value.constructor === Array) && value.every(v => entryValidator.test(v)),
        entryValidator),
    count: (countValidator, entryValidator) => new EntrySpec('count', 
        value => (typeof value === 'object' && value.constructor === Array) && countValidator.test(value.filter(entryValidator.test)),
        entryValidator, countValidator),
};
const vf = {
    printTree: (str) => str.split('\n')
        .map(line => `  ${line}`)
        .join('\n'),
    test: (optional, steps) => (value) => {
        if (value === undefined) return false;
        if (value === null) return optional;
        return steps.every(spec => spec.test(value));
    },
};

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

class ArrayValidator extends Validator {
    constructor(optional, type, steps) {
        super(optional, type, steps);
    }

    every(entryValidator = new Validator()) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.every(entryValidator)]); }
    count(entryValidator = new Validator(), countValidator = new Validator()) { return new this.constructor(this._optional, this._type, [...this._steps, specFactory.count(countValidator, entryValidator)]); }
}

module.exports = new BaseValidator();
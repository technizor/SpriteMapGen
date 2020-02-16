import { IValidator, ValidationResult, ValidateFunc } from './types';

type SpecType = 'type' | 'value' | 'enum' | 'prop' | 'entry' | 'case' | 'custom';

// Used to coerce data objects
export interface Obj<T> {
    [name: string]: any;
}

interface TestFunc<T> {
    (value: T): ValidationResult;
}

export class Spec<T> {
    readonly type: SpecType;
    readonly name: string;
    readonly test: TestFunc<T>;
    constructor(type: SpecType, name: string, test: TestFunc<T>) {
        this.type = type;
        this.name = name;
        this.test = test;
    }

    display() {
        return '~';
    }
}

export class TypeSpec<T> extends Spec<T> {
    constructor(name: string, test: TestFunc<T>) {
        super('type', name, test);
    }
    display() {
        return '';
    }
}

export class ValueSpec<T> extends Spec<T> {
    constructor(name: string, test: TestFunc<T>) {
        super('value', name, test);
    }
    display() {
        return this.name;
    }
}

export class EnumSpec<T> extends Spec<T> {
    readonly inclusive: boolean;
    readonly vals: Array<T>;
    constructor(name: string, inclusive: boolean, vals: Array<T>) {
        super('enum', name, value => {
            let valid = vals.includes(value) === inclusive;
            let reason = { message: this.display() };
            return new ValidationResult(valid, reason);
        });

        this.inclusive = inclusive;
        this.vals = vals;
    }

    display() {
        return `${this.name}(${this.vals.join(',')})`;
    }
}

export class PropSpec<T, U> extends Spec<Obj<T>> {
    readonly propName: string;
    readonly propValidator: IValidator<U>;
    constructor(propName: string, propValidator: IValidator<U>) {
        super('prop', `[${propName}]`, value => {
            if (typeof value !== 'object' && Object.getPrototypeOf(value).constructor !== Object) {
                let reason = { message: 'object' };
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

export class EntrySpec<T> extends Spec<Array<T>> {
    readonly entryValidator: IValidator<T>;
    constructor(entryValidator: IValidator<T>) {
        super('entry', 'entry', (value: Array<T>) => {
            if (typeof value !== 'object' || value.constructor !== Array) {
                let reason = { message: 'array' };
                return new ValidationResult(false, reason);
            }
            let entryResult = value.map(v => entryValidator.test(v));
            let entryFails = entryResult.filter(res => !res.valid).map(res => res.reason);
            let valid = entryFails.length === 0;
            let reason = { message: 'all entries passed entry validator', entry: entryFails };
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

export class CaseSpec<T> extends Spec<T> {
    readonly caseValidators: Array<IValidator<T>>;

    constructor(name: string, inclusive: boolean, caseValidators: Array<IValidator<T>>) {
        super('case', name, value => {
            let matchIndex = caseValidators.findIndex(caseVal => caseVal.test(value).valid);
            let valid = (matchIndex !== -1) === inclusive;
            let reason = { message: 'any case validator passed' };
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

export class CustomSpec<T> extends Spec<T> {
    readonly validatorFunc: ValidateFunc<T>;
    constructor(validatorName: string, validatorFunc: ValidateFunc<T>) {
        super('custom', `<validate(${validatorName})>`, value => {
            let result = validatorFunc(value);
            return new ValidationResult(result.valid, result.reason);
        });

        this.validatorFunc = validatorFunc;
    }
    display() {
        return this.name;
    }
}

export default {
    // Type Value Checks
    object: <T>() => new TypeSpec<Obj<T>>('object', value => {
        let valid = (typeof value === 'object');
        let reason = { message: 'object' };
        return new ValidationResult(valid, reason);
    }),
    type: <T>(type: new () => T) => new TypeSpec<Obj<T>>(`type(${type.name})`, value => {
        let valid = (Object.getPrototypeOf(value).constructor === type);
        let reason = { message: type.name };
        return new ValidationResult(valid, reason);
    }),
    string: () => new TypeSpec<string>('string', value => {
        let valid = (typeof value === 'string');
        let reason = { message: 'string' };
        return new ValidationResult(valid, reason);
    }),
    number: () => new TypeSpec<number>('number', value => {
        let valid = (typeof value === 'number');
        let reason = { message: 'number' };
        return new ValidationResult(valid, reason);
    }),
    boolean: () => new TypeSpec<boolean>('boolean', value => {
        let valid = (typeof value === 'boolean');
        let reason = { message: 'boolean' };
        return new ValidationResult(valid, reason);
    }),
    array: <T>() => new TypeSpec<Array<T>>('array', value => {
        let valid = (typeof value === 'object' && value.constructor === Array);
        let reason = { message: 'array' };
        return new ValidationResult(valid, reason);
    }),
    // Number Value Checks
    integer: () => new ValueSpec<number>('integer', value => {
        let valid = Number.isInteger(value);
        let reason = { message: 'integer' };
        return new ValidationResult(valid, reason);
    }),
    finite: () => new ValueSpec<number>('finite', value => {
        let valid = Number.isFinite(value);
        let reason = { message: 'finite' };
        return new ValidationResult(valid, reason);
    }),
    nan: () => new ValueSpec<number>('nan', value => {
        let valid = Number.isNaN(value);
        let reason = { message: 'NaN' };
        return new ValidationResult(valid, reason);
    }),
    // Value Checks
    lt: <T>(x: T) => new ValueSpec<T>(`lt(${x})`, value => {
        let valid = value < x;
        let reason = { message: `lt(${x})` };
        return new ValidationResult(valid, reason);
    }),
    lteq: <T>(x: T) => new ValueSpec<T>(`lteq(${x})`, value => {
        let valid = value <= x;
        let reason = { message: `lteq(${x})` };
        return new ValidationResult(valid, reason);
    }),
    gt: <T>(x: T) => new ValueSpec<T>(`gt(${x})`, value => {
        let valid = value > x;
        let reason = { message: `gt(${x})` };
        return new ValidationResult(valid, reason);
    }),
    gteq: <T>(x: T) => new ValueSpec<T>(`gteq(${x})`, value => {
        let valid = value >= x;
        let reason = { message: `gteq(${x})` };
        return new ValidationResult(valid, reason);
    }),
    eq: <T>(x: T) => new ValueSpec<T>(`eq(${x})`, value => {
        let valid = value === x;
        let reason = { message: `eq(${x})` };
        return new ValidationResult(valid, reason);
    }),
    neq: <T>(x: T) => new ValueSpec<T>(`neq(${x})`, value => {
        let valid = value !== x;
        let reason = { message: `neq(${x})` };
        return new ValidationResult(valid, reason);
    }),
    enum: <T>(vals: Array<T>) => new EnumSpec('enum', true, vals),
    nenum: <T>(vals: Array<T>) => new EnumSpec('nenum', false, vals),
    case: <T>(caseValidators: Array<IValidator<T>>) => new CaseSpec('case', true, caseValidators),
    ncase: <T>(caseValidators: Array<IValidator<T>>) => new CaseSpec('ncase', false, caseValidators),
    // Object Property Value Checks
    prop: <T, U>(propName: string, propValidator: IValidator<U>) => new PropSpec<T, U>(propName, propValidator),
    // Array Property Value Checks
    every: <T>(entryValidator: IValidator<T>) => new EntrySpec(entryValidator),
    // Custom Validation
    validate: <T>(validatorName: string, validatorFunc: ValidateFunc<T>) => new CustomSpec(validatorName, validatorFunc),
}
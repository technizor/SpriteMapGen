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
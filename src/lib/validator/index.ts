import { ValidationResult, IValidator, ValidateFunc, ValidationResultReason } from './types';
import { Spec, PropSpec, EnumSpec, CaseSpec, CustomSpec, EntrySpec, Obj } from './spec';
import specFactory from './spec-factory';

const indent = (str: string) => str.split('\n')
    .map(line => `  ${line}`)
    .join('\n');

interface SpecResult {
    spec: Spec<any>;
    result: ValidationResult;
}

const tester = (optional: boolean, steps: Array<Spec<any>>) => (value: any) => {
    if (value === undefined) return new ValidationResult(optional, { message: 'required value was undefined' });
    if (value === null) return new ValidationResult(optional, { message: 'required value was null' });
    let standardSpecs = steps.filter(spec => spec.type === 'value' || spec.type === 'enum' || spec.type === 'prop' || spec.type === 'entry' || spec.type === 'case');
    let customSpecs = steps.filter(spec => spec.type === 'custom');
    
    let specToTestMapper = (spec: Spec<any>): SpecResult => {
        try {
            return { spec, result: spec.test(value) };
        } catch (error) {
            return { spec, result: new ValidationResult(false, { message: 'testing specification threw error', error }) };
        }
    };
    let testFailFilter = (res: SpecResult) => !res.result.valid;
    let testToReasonMapper = (res: SpecResult): Record<string, ValidationResultReason> => ({ [res.spec.name]: res.result.reason });
    let customSpecToReasonMapper = (spec: Spec<any>): Record<string, ValidationResultReason> => ({ [spec.name]: { message: 'preconditions failed' } }); // todo get reason from custom validator

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
    return new ValidationResult(true, { message: 'validation succeeded' });
};

interface ValidatorOptions<T> {
    optional?: boolean;
    defaultValue?: any;
    type?: string;
    steps?: Array<Spec<T>>;
}
class Validator<T> implements IValidator<T> {
    protected _optional: boolean;
    protected _defaultValue: any;
    protected _type: string;
    protected _steps: Array<Spec<T>>;
    constructor({ optional = false, defaultValue = undefined, type = 'undefined', steps = [] }: ValidatorOptions<T> = {}) {
        this._optional = optional;
        this._defaultValue;
        this._type = type;
        this._steps = steps;
    }

    getType() { return this._type; }

    eq<S extends Validator<T>>(this: S, x: T): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.eq(x)],
        });
    }
    neq<S extends Validator<T>>(this: S, x: T): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: [...this._steps, specFactory.neq(x)],
        });
    }

    enum<S extends Validator<T>>(this: S, ...vals: T[]): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type,
            steps: [...this._steps, specFactory.enum(vals)],
        });
    }
    nenum<S extends Validator<T>>(this: S, ...vals: T[]): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: [...this._steps, specFactory.nenum(vals)],
        });
    }
    getEnum(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'enum' && spec.name === 'enum')[n];
        return spec && (spec as EnumSpec<T>).vals;
    }
    getNenum(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'enum' && spec.name === 'nenum')[n];
        return spec && (spec as EnumSpec<T>).vals;
    }

    case<S extends Validator<T>>(this: S, ...vals: IValidator<T>[]): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type,
            steps: [...this._steps, specFactory.case(vals)],
        });
    }
    ncase<S extends Validator<T>>(this: S, ...vals: IValidator<T>[]): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: [...this._steps, specFactory.ncase(vals)],
        });
    }
    
    getCase(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'case' && spec.name === 'case')[n];
        return spec && (spec as CaseSpec<T>).caseValidators;
    }
    getNcase(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'case' && spec.name === 'ncase')[n];
        return spec && (spec as CaseSpec<T>).caseValidators;
    }

    required<S extends Validator<T>>(this: S): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: false,
            defaultValue: undefined,
            type: this._type,
            steps: this._steps,
        });
    }
    optional<S extends Validator<T>>(this: S, defaultValue?: T): S {
        return new (Object.getPrototypeOf(this).constructor)({
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
        return this._defaultValue;
    }

    validate<S extends Validator<T>>(this: S, validatorName: string, validatorFunc: ValidateFunc<T>): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional,
            defaultValue: this._defaultValue,
            type: this._type,
            steps: [...this._steps, specFactory.validate(validatorName, validatorFunc)],
        });
    }
    getValidate(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'custom')[n];
        return spec && (spec as CustomSpec<T>).validatorFunc;
    }

    test(value: T) {
        return tester(this._optional, this._steps)(value);
    }
    spec(name: string) {
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

class PrimitiveValidator<T> extends Validator<T> {
    constructor(options?: ValidatorOptions<T>) {
        super(options);
    }

    lt<S extends PrimitiveValidator<T>>(this: S, x: T): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.lt(x)],
        }); 
    }
    lteq<S extends PrimitiveValidator<T>>(this: S, x: T): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.lteq(x)],
        }); 
    }
    gt<S extends PrimitiveValidator<T>>(this: S, x: T): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.gt(x)],
        }); 
    }
    gteq<S extends PrimitiveValidator<T>>(this: S, x: T): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.gteq(x)],
        }); 
    }
}

class NumberValidator extends PrimitiveValidator<number> {
    constructor(options?: ValidatorOptions<number>) {
        super(options);
    }

    integer<S extends NumberValidator>(this: S): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.integer()],
        }); 
    }
    finite<S extends NumberValidator>(this: S): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.finite()],
        }); 
    }
    nan<S extends NumberValidator>(this: S): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.nan()],
        }); 
    }
}

class ObjectValidator<T extends Obj<T>> extends Validator<T> {
    constructor(options?: ValidatorOptions<T>) {
        super(options);
    }

    prop<S extends ObjectValidator<T>, U>(this: S, propName: string, propValidator: Validator<U>): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: [...this._steps, specFactory.prop(propName, propValidator)],
        }); 
    }

    getProp<U>(propName: string, n = 0) {
        // todo: determine how to coerce type generic for object with property of computed name
        let spec = this._steps.filter(spec => spec.type === 'prop' && spec.name === `[${propName}]`)[n];
        return spec && (spec as PropSpec<T, U>).propValidator;
    }
}

class ArrayValidator<T> extends Validator<Array<T>> {
    constructor(options?: ValidatorOptions<Array<T>>) {
        super(options);
    }

    every<S extends ArrayValidator<T>>(this: S, entryValidator: Validator<T>): S {
        return new (Object.getPrototypeOf(this).constructor)({
            optional: this._optional, 
            defaultValue: this._defaultValue, 
            type: this._type, 
            steps: this._steps.concat([specFactory.every(entryValidator)]),
        }); 
    }

    getEvery(n = 0) {
        let spec = this._steps.filter(spec => spec.type === 'entry')[n];
        return spec && (spec as EntrySpec<T>).entryValidator;
    }
}

const ValidatorFactory = {
    object: <T>() => {
        return new ObjectValidator<T>({
            optional: false,
            defaultValue: undefined,
            type: 'object',
            steps: [specFactory.object()],
        });
    },
    type: <T>(type: new () => T) => {
        return new ObjectValidator<T>({
            optional: false,
            defaultValue: undefined,
            type: type && type.name,
            steps: [specFactory.type(type)],
        });
    },
    string: () => {
        return new PrimitiveValidator<string>({
            optional: false,
            defaultValue: undefined,
            type: 'string',
            steps: [specFactory.string()],
        });
    },
    number: () => {
        return new NumberValidator({
            optional: false,
            defaultValue: undefined,
            type: 'number',
            steps: [specFactory.number()],
        });
    },
    boolean: () => {
        return new PrimitiveValidator<boolean>({
            optional: false,
            defaultValue: undefined,
            type: 'boolean',
            steps: [specFactory.boolean()],
        });
    },
    array: <T>() => {
        return new ArrayValidator<T>({
            optional: false,
            defaultValue: undefined,
            type: 'array',
            steps: [specFactory.array<T>()],
        });
    },
}

export default ValidatorFactory;

export {
    Validator, PrimitiveValidator, NumberValidator, ArrayValidator, ObjectValidator
}
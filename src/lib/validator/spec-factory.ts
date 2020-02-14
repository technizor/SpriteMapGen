import { ValidationResult, ValidateFunc, IValidator } from './types';
import { TypeSpec, ValueSpec, EnumSpec, CaseSpec, EntrySpec, PropSpec, CustomSpec, Obj } from './spec';

const specFactory = {
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
};

export default specFactory;
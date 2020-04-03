
export interface ValidationResultReason {
    message: string;
    entry?: ValidationResultReason[];
    error?: any;
}

export class ValidationResult {
    valid: boolean;
    reason: ValidationResultReason;

    constructor(valid: boolean, reason: ValidationResultReason) {
        this.valid = valid;
        this.reason = reason;
    }
}

export interface ValidateFunc<T> {
    (value: T): ValidationResult;
}


export interface IValidator<T> {
    test: ValidateFunc<T>;
    spec(name: string): string;
}
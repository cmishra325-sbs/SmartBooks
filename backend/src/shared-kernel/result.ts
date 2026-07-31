/**
 * Represent the outcome of a business operation.
 * Eliminates throwing exceptions for domain rule violations.
 */
export class Result<ValueType, ErrorType> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly _value?: ValueType;
  private readonly _error?: ErrorType;

  private constructor(isSuccess: boolean, value?: ValueType, error?: ErrorType) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._value = value;
    this._error = error;
    Object.freeze(this);
  }

  /**
   * Access the success value. Throws an error if accessed on a failed result.
   */
  public get value(): ValueType {
    if (this.isFailure) {
      throw new Error("Cannot retrieve the value of a failed Result. Check status using isSuccess first.");
    }
    return this._value as ValueType;
  }

  /**
   * Access the error payload. Throws an error if accessed on a successful result.
   */
  public get error(): ErrorType {
    if (this.isSuccess) {
      throw new Error("Cannot retrieve the error of a successful Result. Check status using isFailure first.");
    }
    return this._error as ErrorType;
  }

  /**
   * Helper to instantiate a successful operation.
   */
  public static ok<T, E = never>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  /**
   * Helper to instantiate a failed operation.
   */
  public static fail<E, T = never>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }
}

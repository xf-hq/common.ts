import { RuntimeDetail } from './runtime-detail';
import { isNumber, isString } from './type-checking';

export const throwError = (error: Error | string): never => { throw isString(error) ? new Error(error) : error; };
export const ThrowError = (error: Error | string): (...args: any[]) => never => () => throwError(error);

export const notImplemented = (message?: string): never => { throw new NotImplemented(message); };
export class NotImplemented extends Error {
  constructor (message?: string) {
    super(`Not Implemented${message ? `: ${message}` : ''}`);
  }
}

export function thisShouldBeUnreachable (reason?: string): never { throw new ThisShouldBeUnreachable(reason); }
export class ThisShouldBeUnreachable extends Error {
  constructor (reason?: string) {
    super(`This error should not have been encountered. The line of code where it originated should have been unreachable.${reason ? ` Reason: ${reason}` : ''}`);
  }
}

export class DeliberateTermination extends Error {}

export class DetailedError<TType extends string | number = string | number, TRefs = unknown> extends Error {
  constructor (type: TType, message: string, refs?: TRefs);
  constructor (arg: RuntimeDetail<TType, TRefs> | RuntimeDetail.Args<TType, TRefs>);
  constructor (arg0: RuntimeDetail<TType, TRefs> | RuntimeDetail.Args<TType, TRefs> | TType, message?: string, refs?: TRefs) {
    const details = arg0 instanceof RuntimeDetail ? arg0
      : isString(arg0) || isNumber(arg0) ? new RuntimeDetail({ type: arg0, description: message!, refs: refs! })
      : new RuntimeDetail(arg0);
    super();
    this.cause = details;
    this.details = details;
  }
  public readonly details: RuntimeDetail<TType, TRefs>;

  get type (): TType { return this.details.type; }
  get message (): string { return this.details.description; }
}

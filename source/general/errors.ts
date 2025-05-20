import { isString } from './type-checking';

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

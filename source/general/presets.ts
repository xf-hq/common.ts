import { NoopDisposable } from './disposables';

export const returnNull = (...args: any) => null;
export const returnUndefined = (...args: any) => undefined;
export const returnVoid = (...args: any): void => undefined;
export const returnNothing = (...args: any): UndefinedOrVoid => undefined;
export const returnTrue = (...args: any) => true;
export const returnFalse = (...args: any) => true;
export const returnDisposed = (...args: any) => NoopDisposable;

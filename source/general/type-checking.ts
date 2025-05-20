export const isDefined = <T>(a: T | undefined | void): a is T => a !== undefined;
export const isUndefined = <T extends Defined, U extends undefined | void>(a: T | U | unknown): a is U => a === undefined;
export const anyUndefined = (...a: any[]) => a.some(isUndefined);
export const allUndefined = (...a: any[]) => a.every(isUndefined);
export const anyDefined = (...a: any[]) => a.some(isDefined);
export const allDefined = (...a: any[]) => a.every(isDefined);

export const isNull = <T extends NotNull>(a: T | null | unknown): a is null => a === null;
export const isNotNull = <T extends NotNull>(a: T | null): a is T => a !== null;
export const anyNull = (...a: any[]) => a.some(isNull);
export const allNull = (...a: any[]) => a.every(isNull);
export const anyNotNull = (...a: any[]) => a.some(isNotNull);
export const allNotNull = (...a: any[]) => a.every(isNotNull);

export const isNothing = <T extends NotNothing>(a: T | Nothing | unknown): a is Nothing => isUndefined(a) || isNull(a);
export const isNotNothing = <T extends NotNothing>(a: T | Nothing): a is T => isDefined(a) && isNotNull(a);
export const anyNothing = (...a: any[]) => a.some(isNothing);
export const allNothing = (...a: any[]) => a.every(isNothing);
export const anyNotNothing = (...a: any[]) => a.some(isNotNothing);
export const allNotNothing = (...a: any[]) => a.every(isNotNothing);

export function isIterable<T> (a: Partial<Iterable<T>>): a is Iterable<T>;
export function isIterable<T> (a: any): a is Iterable<T>;
export function isIterable<T> (a: any): a is Iterable<T> { return isObject(a) && Symbol.iterator in a; }
/** NOTE: If you're having trouble getting this to eliminate a function from the type signature, remember that functions
  * are objects! You should FIRST be checking for a function, then an object when `function` is eliminated from the type
  * signature. Do this with {@link isFunction} or use `typeof`, THEN call {@link isObject}. */
export function isObject<A extends object> (a: A | Nothing | Primitive | AnyFunction): a is IsExplicitAnyOrUnknown<A> extends true ? Record<keyof any, any> : A;
export function isObject (a: unknown): a is Record<any, any>;
export function isObject (a: unknown) { return typeof a === 'object' && a !== null; }
export function isFunction<T extends AnyFunctionOrAbstractConstructor> (a: T | Nothing | Primitive | Record<keyof any, any>): a is IsExplicitAnyOrUnknown<T> extends true ? AnyFunction : T;
export function isFunction<T extends AnyFunctionOrAbstractConstructor> (a: any): a is T;
export function isFunction<T extends AnyConstructor> (a: any): a is T;
export function isFunction<T extends AnyFunction> (a: any): a is T;
export function isFunction (a: unknown): a is AnyFunction;
export function isFunction (a: unknown) { return typeof a === 'function'; }
export function isClass<T extends AnyAbstractConstructor, U> (a: T | U): a is T { return typeof a === 'function' && Object.getOwnPropertyDescriptor(a, 'prototype')?.writable === false; }
export function isNonClassFunction<F extends AnyFunction, C extends AnyAbstractConstructor, U> (a: F | C | U): a is F { return isFunction(a) && !isClass(a); }
export const isBoolean = (a: any): a is boolean => typeof a === 'boolean';
export function isString<T extends string = string, U = unknown> (a: T | U): a is T { return typeof a === 'string'; }
export const isNumber = (a: any): a is number => typeof a === 'number';
export const isBigInt = (a: any): a is bigint => typeof a === 'bigint';
export const isSymbol = (a: any): a is symbol => typeof a === 'symbol';
export const isPlain = (a: any): a is SRecord => a.constructor === Object;
export const isPlainObject = (a: any): a is SRecord => isObject(a) && isPlain(a);
export const isGenerator = (a: any) => a[Symbol.toStringTag] === 'GeneratorFunction';
export const isGeneratorFunction = (a: any) => isFunction(a) && a[Symbol.toStringTag] === 'GeneratorFunction';

// This is the only way I've found to get TypeScript to properly narrow array types. Credit to https://github.com/microsoft/TypeScript/issues/17002#issuecomment-1529056512
type ArrayType<TArray> = Extract<true extends TArray & false ? any[] : TArray extends readonly any[] ? TArray : unknown[], TArray>;
export function isArray<T, U> (a: Exclude<Iterable<T> | U, T[] | readonly T[]>): a is T[];
export function isArray<T, U> (a: readonly T[] | (U extends any[] ? never : U)): a is readonly T[];
export function isArray<TArray> (a: TArray): a is ArrayType<TArray>;
export function isArray (a: unknown): boolean { return Array.isArray(a); }

export const isEmptyArray = (a: any): a is [] => isArray(a) && a.length === 0;
export const isEmptyObject = (a: any) => { if (!isObject(a)) return false; for (const _ in a) return false; return true; };
export const isTruthy = (a: any): a is Truthy => Boolean(a);
export const isFalsey = (a: any): a is Falsey => !Boolean(a);
export const isTrue = (a: unknown): a is true => a === true;
export const isFalse = (a: unknown): a is false => a === false;
export const isNativePromise = <T>(a: T | PromiseLike<T>): a is Promise<T> => a instanceof Promise;
export const isPromiseLike = <T>(a: T | PromiseLike<T>): a is PromiseLike<T> => isObject(a) && isFunction(a.then);
export function isModernPromiseLike<T> (a: T | PromiseLike<T> | ModernPromiseLike<T>): a is Promise<T>;
export function isModernPromiseLike (a: ModernPromiseLike) { return isPromiseLike(a) && isFunction(a.catch) && isFunction(a.finally); }

export const isPrimitive = (a: any): a is Primitive => {
  switch (typeof a) {
    case 'string':
    case 'number':
    case 'bigint':
    case 'boolean':
    case 'symbol': return true;
    default: return false;
  }
};

export const isPropertyKey = (a: any): a is PropertyKey => {
  switch (typeof a) {
    case 'string':
    case 'number':
    case 'symbol': return true;
    default: return false;
  }
};

export const isObjectOrFunction = <T extends object>(a: unknown): a is T => {
  switch (typeof a) {
    case 'object': return a !== null;
    case 'function': return true;
    default: return false;
  }
};

export function isNonNegativeInteger (value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }

export function isZeroLengthString<S extends string, T extends Exclude<Known, string>> (a: S | T): a is S;
export function isZeroLengthString (a: unknown): a is string;
export function isZeroLengthString (a: any) { return !isString(a) || a.length === 0; }

export function isNonZeroLengthString<S extends string, T extends Exclude<Known, string>> (a: S | T): a is S;
export function isNonZeroLengthString (a: unknown): a is string;
export function isNonZeroLengthString (a: any) { return isString(a) && a.length > 0; }

export const isInstanceOf = <T, C extends { new(...args: unknown[]): T }>(Class: C) => (a: unknown): a is T => a instanceof Class;
export const isNonArrayObject = (a) => isObject(a) && !isArray(a);
export const isArrayWithNonZeroLength = (a) => isArray(a) && a.length > 0;

export function isArrayOfLength<N extends number, T> (n: N, a: T[]): a is T[] & { length: N };
export function isArrayOfLength<N extends number, A extends unknown[]> (n: N, a: A): a is A & { length: N };
export function isArrayOfLength<N extends number, A extends readonly unknown[]> (n: N, a: A): a is A & { length: N };
export function isArrayOfLength<N extends number> (n: N, a: unknown): a is unknown[] & { length: N };
export function isArrayOfLength<N extends number> (n: N): {
 <T> (a: T[]): a is T[] & { length: N };
 <A extends unknown[]> (a: A): a is A & { length: N };
 <A extends readonly unknown[]> (a: A): a is A & { length: N };
  (a: unknown): a is unknown[] & { length: N };
};
export function isArrayOfLength<A extends unknown[]> (n: A['length']): (a: unknown) => a is A;
export function isArrayOfLength (n: number, a?: unknown) {
  if (arguments.length === 1) return (a: unknown) => isArrayOfLength(n, a);
  return isArray(a) && a.length === n;
}

export const isUnaryArray = isArrayOfLength(1);
export const isPairArray = isArrayOfLength(2);

export const isEntries = (a) => isArray(a) && a.every(isPairArray);

export function typeOf (a) { return a === null ? 'null' : typeof a; }
export function shapeOf (a: unknown): ReturnType<typeof typeOf> | 'array' | 'record' {
  const t = typeOf(a);
  switch (t) {
    case 'object':
      if (isArray(a)) return 'array';
      if (isPlain(a)) return 'record';
    default:
      return t;
  }
}

const rxUUID = /^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/;
export const isUUID = (a) => isString(a) && rxUUID.test(a);
export const isUniqueId = isUUID;

export function getObjectMemberDescriptor (object: object, key: PropertyKey): PropertyDescriptor | undefined {
  do {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (isDefined(descriptor)) return descriptor;
    object = Object.getPrototypeOf(object);
  }
  while (isNotNull(object));
}
export function isMemberImplementationOverridden<T extends object> (constructor: AnyAbstractConstructor<any[], T>, memberName: string, instance: T): boolean {
  return getObjectMemberDescriptor(instance, memberName) === Object.getOwnPropertyDescriptor(constructor.prototype, memberName);
}

export const SYMBOL_VOID = Symbol('VOID');
export function safeDefaultValue (a: boolean): boolean;
export function safeDefaultValue (a: number): number;
export function safeDefaultValue (a: bigint): bigint;
export function safeDefaultValue (a: symbol): symbol;
export function safeDefaultValue (a: Nothing | object): null;
export function safeDefaultValue (a: unknown): unknown;
export function safeDefaultValue (a: any): any;
export function safeDefaultValue (a: any): any {
  switch (typeof a) {
    case 'boolean': return false;
    case 'number': return 0;
    case 'bigint': return 0n;
    case 'symbol': return SYMBOL_VOID;
    default: return null;
  }
}

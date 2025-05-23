import { isUndefined } from './type-checking';

export function FnC<A extends any[], T> (_Class: new (...args: A) => T) {
  const instantiate: (...args: ConstructorParameters<typeof _Class>) => T = (...a: A) => new _Class(...a);
  Object.defineProperties(instantiate, {
    [Symbol.hasInstance]: { value: (instance) => instance instanceof _Class },
  });
  return instantiate;
}
/**
 * Variant of `FnC` that utilises a static `create` method to allow control over both construction and the return type.
 * This variant makes it possible to define static properties; see the examples below.
 *
 * @example
 * ```ts
 * // Basic example overriding the return type:
 * interface Foo { foo: number }
 * const MyClass = FnCC(class MyClass implements Foo {
 *   static create (): Foo { return new MyClass(); }
 *   get foo { return 42; }
 *   get bar { return 42; }
 * });
 * const instance = MyClass();
 * instance.foo; // 42
 * instance.bar; // TypeScript error: Property 'bar' does not exist on type 'Foo'. (Works in plain JS though)
 *
 *
 * // Basic example with conditional return type:
 * const MyClass = FnCC(class MyClass {
 *  static create (number: number): MyClass | null { return number === 42 ? new MyClass() : null; }
 * });
 * const a = MyClass(42); // --> MyClass
 * const b = MyClass(43); // --> null
 *
 *
 * // Simplest possible example providing static properties:
 * const MyClass = FnCC(class MyClass {
 *  static create = Object.assign(() => new MyClass(), { MeaningOfLife: 42 });
 * });
 * assert(MyClass.MeaningOfLife === 42); // assertion passes
 *
 *
 * // Example with static custom getters:
 * import { copyOwnProps } from '@xf-common/general/object';
 * const MyClass = FnCC(class MyClass {
 *   static create = copyOwnProps(() => new MyClass(), {
 *     get MeaningOfLife () { return 42; }
 *   });
 * });
 * assert(MyClass.MeaningOfLife === 42); // assertion passes
 * ```
 */
export function FnCC<T, F extends (...args: any[]) => any> (_Class: (new (...args: any[]) => T) & { create: F }) {
  Object.defineProperties(_Class.create, {
    [Symbol.hasInstance]: { value: (instance: T) => instance instanceof _Class },
  });
  return _Class.create;
}
export function FnCT<T> () {
  return function FnC<A extends any[]> (_Class: new (...args: A) => T) {
    const instantiate: (...args: ConstructorParameters<typeof _Class>) => T = (...a: A) => new _Class(...a);
    Object.defineProperties(instantiate, {
      [Symbol.hasInstance]: { value: (instance) => instance instanceof _Class },
    });
    return instantiate;
  };
}

export function LazyC<A extends any[], T> (createClass: () => new (...args: A) => T) {
  let Class: new (...args: A) => T;
  let isUninitialized = true;
  return (...args: A): T => {
    if (isUninitialized) {
      isUninitialized = false;
      Class = createClass();
    }
    return new Class(...args);
  };
}

export function LazyF<F extends AnyFunction> (create: () => F): F {
  let fn: F;
  return ((...args: Parameters<F>) => {
    if (isUndefined(fn)) fn = create();
    return fn(...args);
  }) as F;
}

export type PossiblyLazy<T> = T | Lazy<T>;
export interface Lazy<T> {
  readonly [Lazy.Tag]: true;
  readonly value: T;
}
export function Lazy<A extends any[], T> (create: (...args: A) => T, ...args: A): Lazy<T> {
  return new LazyInstance(create, args);
}
export namespace Lazy {
  export const Tag = Symbol('Lazy<T>');
  export const resolve = <T> (value: PossiblyLazy<T>): T => isLazy(value) ? value.value : value;
}

class LazyInstance<T> implements Lazy<T> {
  constructor (
    private readonly create: (...args: any[]) => T,
    private readonly args: any[],
  ) {}
  #isResolved = false;
  #value: T;
  get [Lazy.Tag] () { return true as const; }
  get value () {
    if (!this.#isResolved) {
      this.#value = this.create(...this.args);
      this.#isResolved = true;
    }
    return this.#value;
  }
}

export const isLazy = <T>(value: PossiblyLazy<T>): value is Lazy<T> => value?.[Lazy.Tag] === true;

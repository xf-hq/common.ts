declare type UndefinedOrVoid = undefined | void;
declare type Nothing = null | UndefinedOrVoid;
declare type NotNothing = Primitive | object | AnyFunctionOrAbstractConstructor;
declare type NotNull = NotNothing | undefined;
declare type Defined = NotNothing | null;
declare type Primitive = string | number | bigint | boolean | symbol;
declare type Known = Primitive | Nothing | object;
declare type JSType = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'null';
declare type Truthy = Exclude<string, ''> | Exclude<number, 0> | Exclude<bigint, 0n> | true | symbol;
declare type Falsey = undefined | null | false | 0 | 0n | '';
declare interface ModernPromiseLike<T = unknown> {
  then<TResult1 = T, TResult2 = never> (onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined): PromiseLike<TResult1 | TResult2>;
  catch<TResult = never> (onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): PromiseLike<T | TResult>;
  finally(onfinally?: (() => void) | null | undefined): PromiseLike<T>;
}

declare type AnyFunction<ARGS extends any[] = any[], RETURN_VALUE = any> = (...args: ARGS) => RETURN_VALUE;
declare namespace AnyFunction {
  type ARGS<F extends AnyFunction> = F extends AnyFunction<infer ARGS> ? ARGS : never;
  type RETURN_VALUE<F extends AnyFunction> = F extends AnyFunction<any[], infer RETURN_VALUE> ? RETURN_VALUE : never;
  type Returning<RETURN_VALUE> = AnyFunction<any[], RETURN_VALUE>;
}
declare type AnyConstructor<ARGS extends any[] = any[], INSTANCE_TYPE = any> = new (...args: ARGS) => INSTANCE_TYPE;
declare type AnyAbstractConstructor<ARGS extends any[] = any[], INSTANCE_TYPE = any> = abstract new (...args: ARGS) => INSTANCE_TYPE;
declare type AnyFunctionOrConstructor<ARGS extends any[] = any[], RESULT = any> = AnyFunction<ARGS, RESULT> | AnyConstructor<ARGS, RESULT>;
declare type AnyFunctionOrAbstractConstructor<ARGS extends any[] = any[], RESULT = any> = AnyFunction<ARGS, RESULT> | AnyAbstractConstructor<ARGS, RESULT>;

declare type Writable<T> = { -readonly [K in keyof T]: T[K] };
declare type WritableExcept<T, K extends keyof T> = Pick<T, K> & { -readonly [P in Exclude<keyof T, K>]: T[P]; };

declare type EmptyRecord = Record<never, never>;
declare type AnyRecord = Record<keyof any, any>;
declare type UnknownRecord = Record<keyof any, unknown>;
declare type RecordOf<V> = Record<string, V>;
declare type NestableRecordOf<V> = Record<string, V | Exclude<{ [K in string]: V }, V>>;
declare type RecordWithSameKeysAs<T, V = any> = { [K in keyof T]: V };

declare interface TypedRecord<T extends string = string, D = any> {
  readonly type: T;
  readonly data: D;
}

/**
 * The `S` prefix is an overloaded mnemonic for "Safe", "String (keys)", and "Serializable (where applicable)". It is
 * designed to make it easier to work with objects and records exclusively in terms of string-typed keys, and to
 * assist other types whose definitions are intended to work only with those keys of their input types that are strings.
 */
declare type SRecord<TRecord extends Record<any, unknown> = Record<string, unknown>> = { [K in keyof TRecord as K extends string ? K : never]: TRecord[K] };
declare namespace SRecord {
  export type Of<TValue> = Record<string, TValue>;
  export type KeyOf<TRecord> = Extract<keyof TRecord, string>;
}
declare type FilterKeysByValue<T extends SRecord<T>, C> = { [K in keyof T as T[K] extends C ? K : never]: T[K] };

/** Modifies `T` such that properties for `TRequiredKeys` are made non-optional. Other properties remain as defined for `T` (no optionality is introduced). */
declare type SomeRequired<T, TRequiredKeys extends keyof T> = Omit<T, TRequiredKeys> & Required<Pick<T, TRequiredKeys>>;
/** Modifies `T` such that properties for `TOptionalKeys` are made optional. Other properties remain as defined for `T` (no existing optionality is removed). */
declare type SomePartial<T, TOptionalKeys extends keyof T> = Omit<T, TOptionalKeys> & Partial<Pick<T, TOptionalKeys>>;
declare type RequireAtLeastOneOf<T, K extends keyof T = keyof T> = T & { [P in K]-?: Required<Pick<T, P>> }[K];

declare type PartialParameters<F extends AnyFunction> = PartialTuple<Parameters<F>>;
declare type RemainingParameters<F extends AnyFunction, P extends PartialTuple<Parameters<F>>> = RemainingTuple<Parameters<F>, P>;
declare type PartialTuple<T extends unknown[]> = T extends [] ? T : T extends [unknown] ? [] | T : T extends [...infer A, infer B] ? PartialTuple<A> | T : never;
declare type RemainingTuple<T extends unknown[], P extends PartialTuple<T>> = T extends P ? [] : T extends [...P, ...infer R] ? R : never;

// type Case1 = [];
// type Test1a = PartialTuple<Case1>; // Expected: []
// type Test1b = RemainingTuple<Case1, []>; // Expected: []

// type Case2 = [a: 1];
// type Test2a = PartialTuple<Case2>; // Expected: [] | [a: 1]
// type Test2b = RemainingTuple<Case2, []>; // Expected: [a: 1]
// type Test2c = RemainingTuple<Case2, [a: 1]>; // Expected: []

// type Case3 = [a: 1, b: 2];
// type Test3a = PartialTuple<Case3>; // Expected: [] | [a: 1] | [a: 1, b: 2]
// type Test3b = RemainingTuple<Case3, []>; // Expected: [a: 1, b: 2]
// type Test3c = RemainingTuple<Case3, [a: 1]>; // Expected: [b: 2]
// type Test3d = RemainingTuple<Case3, [a: 1, b: 2]>; // Expected: []

// type Case4 = [a: 1, b: 2, c: 3, d: 4, e: 5];
// type Test4a = PartialTuple<Case4>; // Expected: [] | [a: 1] | [a: 1, b: 2] | [a: 1, b: 2, c: 3] | [a: 1, b: 2, c: 3, d: 4] | [a: 1, b: 2, c: 3, d: 4, e: 5]
// type Test4b = RemainingTuple<Case4, []>; // Expected: [a: 1, b: 2, c: 3, d: 4, e: 5]
// type Test4c = RemainingTuple<Case4, [a: 1]>; // Expected: [b: 2, c: 3, d: 4, e: 5]
// type Test4d = RemainingTuple<Case4, [a: 1, b: 2]>; // Expected: [c: 3, d: 4, e: 5]
// type Test4e = RemainingTuple<Case4, [a: 1, b: 2, c: 3]>; // Expected: [d: 4, e: 5]
// type Test4f = RemainingTuple<Case4, [a: 1, b: 2, c: 3, d: 4]>; // Expected: [e: 5]
// type Test4g = RemainingTuple<Case4, [a: 1, b: 2, c: 3, d: 4, e: 5]>; // Expected: []


declare type Tuple1 = [unknown];
declare type Tuple2 = [unknown, unknown];
declare type Tuple3 = [unknown, unknown, unknown];
declare type Tuple4 = [unknown, unknown, unknown, unknown];
declare type Tuple5 = [unknown, unknown, unknown, unknown, unknown];
declare type Tuple6 = [...Tuple5, ...Tuple1];
declare type Tuple7 = [...Tuple5, ...Tuple2];
declare type Tuple8 = [...Tuple5, ...Tuple3];
declare type Tuple9 = [...Tuple5, ...Tuple4];
declare type Tuple10 = [...Tuple5, ...Tuple5];

declare namespace SliceTuple {
  /** `[A, B, C, D, E, F, ...]` becomes `[A]` */
  export type A<T extends [...Tuple1, ...unknown[]]> = T extends [...Tuple1, ...infer R] ? T extends [...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[A, B]` */
  export type AB<T extends [...Tuple2, ...unknown[]]> = T extends [...Tuple2, ...infer R] ? T extends [...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[A, B, C]` */
  export type ABC<T extends [...Tuple3, ...unknown[]]> = T extends [...Tuple3, ...infer R] ? T extends [...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[A, B, C, D]` */
  export type ABCD<T extends [...Tuple4, ...unknown[]]> = T extends [...Tuple4, ...infer R] ? T extends [...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[A, B, C, D, E]` */
  export type ABCDE<T extends [...Tuple5, ...unknown[]]> = T extends [...Tuple5, ...infer R] ? T extends [...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[A, B, C, D, E, F]` */
  export type ABCDEF<T extends [...Tuple6, ...unknown[]]> = T extends [...Tuple6, ...infer R] ? T extends [...infer S, ...R] ? S : never : never;

  /** `[A, B, C, D, E, F, ...]` becomes `[B]` */
  export type B<T extends [...Tuple2, ...unknown[]]> = T extends [...Tuple2, ...infer R] ? T extends [...Tuple1, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[B, C]` */
  export type BC<T extends [...Tuple3, ...unknown[]]> = T extends [...Tuple3, ...infer R] ? T extends [...Tuple1, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[B, C, D]` */
  export type BCD<T extends [...Tuple4, ...unknown[]]> = T extends [...Tuple4, ...infer R] ? T extends [...Tuple1, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[B, C, D, E]` */
  export type BCDE<T extends [...Tuple5, ...unknown[]]> = T extends [...Tuple5, ...infer R] ? T extends [...Tuple1, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[B, C, D, E, F]` */
  export type BCDEF<T extends [...Tuple6, ...unknown[]]> = T extends [...Tuple6, ...infer R] ? T extends [...Tuple1, ...infer S, ...R] ? S : never : never;

  /** `[A, B, C, D, E, F, ...]` becomes `[C]` */
  export type C<T extends [...Tuple3, ...unknown[]]> = T extends [...Tuple3, ...infer R] ? T extends [...Tuple2, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[C, D]` */
  export type CD<T extends [...Tuple4, ...unknown[]]> = T extends [...Tuple4, ...infer R] ? T extends [...Tuple2, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[C, D, E]` */
  export type CDE<T extends [...Tuple5, ...unknown[]]> = T extends [...Tuple5, ...infer R] ? T extends [...Tuple2, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[C, D, E, F]` */
  export type CDEF<T extends [...Tuple6, ...unknown[]]> = T extends [...Tuple6, ...infer R] ? T extends [...Tuple2, ...infer S, ...R] ? S : never : never;

  /** `[A, B, C, D, E, F, ...]` becomes `[D]` */
  export type D<T extends [...Tuple4, ...unknown[]]> = T extends [...Tuple4, ...infer R] ? T extends [...Tuple3, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[D, E]` */
  export type DE<T extends [...Tuple5, ...unknown[]]> = T extends [...Tuple5, ...infer R] ? T extends [...Tuple3, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[D, E, F]` */
  export type DEF<T extends [...Tuple6, ...unknown[]]> = T extends [...Tuple6, ...infer R] ? T extends [...Tuple3, ...infer S, ...R] ? S : never : never;

  /** `[A, B, C, D, E, F, ...]` becomes `[E]` */
  export type E<T extends [...Tuple5, ...unknown[]]> = T extends [...Tuple5, ...infer R] ? T extends [...Tuple4, ...infer S, ...R] ? S : never : never;
  /** `[A, B, C, D, E, F, ...]` becomes `[E, F]` */
  export type EF<T extends [...Tuple6, ...unknown[]]> = T extends [...Tuple6, ...infer R] ? T extends [...Tuple4, ...infer S, ...R] ? S : never : never;

  /** `[A, B, C, D, E, F, ...]` becomes `[F]` */
  export type F<T extends [...Tuple6, ...unknown[]]> = T extends [...Tuple6, ...infer R] ? T extends [...Tuple5, ...infer S, ...R] ? S : never : never;

  export namespace Rest {
    /** `[A, B, C, D, E, F, ...]` becomes `[B, C, D, E, F, ...]` */
    export type B<T extends [...Tuple1, ...unknown[]]> = T extends [...Tuple1, ...infer B] ? B : never;
    /** `[A, B, C, D, E, F, ...]` becomes `[C, D, E, F, ...]` */
    export type C<T extends [...Tuple2, ...unknown[]]> = T extends [...Tuple2, ...infer C] ? C : never;
    /** `[A, B, C, D, E, F, ...]` becomes `[D, E, F, ...]` */
    export type D<T extends [...Tuple3, ...unknown[]]> = T extends [...Tuple3, ...infer D] ? D : never;
    /** `[A, B, C, D, E, F, ...]` becomes `[E, F, ...]` */
    export type E<T extends [...Tuple4, ...unknown[]]> = T extends [...Tuple4, ...infer E] ? E : never;
    /** `[A, B, C, D, E, F, ...]` becomes `[F, ...]` */
    export type F<T extends [...Tuple5, ...unknown[]]> = T extends [...Tuple5, ...infer F] ? F : never;
  }
}

declare type MapTuple<TA extends any[], B> = { [K in keyof TA]: B };
declare type MapRecord<TA extends Record<string, any>, B> = { [K in keyof TA]: B };

declare type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
declare type UpperCaseChar = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
declare type LowerCaseChar = Lowercase<UpperCaseChar>;
declare type Letter = UpperCaseChar | LowerCaseChar;

type UnionToIntersection<U, TConstraint = unknown> = (U extends any ? (k: U) => void : never) extends ((k: infer I extends TConstraint) => void) ? I : never;
type KeysOfUnion<T> = T extends T ? keyof T : never;

type IfEquals<X, Y, A = X, B = never> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? A : B;
declare type ReadonlyKeys<T> = {
  [P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, never, P>
}[keyof T];
declare type WritableKeys<T> = {
  [P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P, never>
}[keyof T];
declare type OmitReadonly<T> = {
  [P in Exclude<keyof T, ReadonlyKeys<T>>]: T[P];
};

declare type AssertIsSubTypeOf<TSubType extends TSuperType, TSuperType> = TSubType extends TSuperType ? TSubType : never;

declare type FilterToFunctionKeysOnly<T extends SRecord> = { [K in keyof T as T[K] extends AnyFunction ? K : never]: T[K] };
// Further to the above, I now need a type taking <A extends any[], R> and returning a type that only has keys that are functions with that signature:
declare type FilterToFunctionsWithSignature<T extends SRecord, A extends any[], R> = { [K in keyof T as T[K] extends AnyFunction<A, R> ? K : never]: T[K] };

type FilterVoid<T extends any[]> = T extends [infer Head, ...infer Tail]
  ? Head extends void ? FilterVoid<Tail> : [Head, ...FilterVoid<Tail>]
  : [];
declare type NonVoidReturnTypes<T extends ((...args: unknown[]) => unknown)[]> = FilterVoid<{
  [K in keyof T]: T[K] extends (...args: unknown[]) => infer R ? R : never;
}>;

type TExtendsNever<T> = T extends never ? true : false;
declare type IsExplicitAny<T> = true extends TExtendsNever<T> ? false extends TExtendsNever<T> ? true : false : false; // Only 'any' returns both true and false for the condition "T extends never"
declare type IsExplicitUnknown<T> = IsExplicitAny<T> extends true ? false : unknown extends T ? true : false; // 'unknown' only extends 'any' and 'unknown', and the first condition eliminates 'any'
declare type IsExplicitAnyOrUnknown<T> = IsExplicitAny<T> extends true ? true : unknown extends T ? true : false; // Useful when we need a conditional type that safely deals with explicitly-known types

declare type Dispose = () => void;
declare type DisposeOrWaitForAbort = (abortSignal?: AbortSignal) => void;
declare type DisposableFunction = DisposeOrWaitForAbort & ExtendedDisposable;
declare type LooseDisposable = Nothing | Disposable | LegacyDisposable | ExtendedDisposable | Dispose | LooseDisposable[];
declare namespace LooseDisposable {
  type Factory<A extends any[]> = (...args: A) => LooseDisposable;
  type NotNothing = Exclude<LooseDisposable, Nothing>;
  type NeverNothing = Exclude<LooseDisposable, Nothing | LooseDisposable[]> | LooseDisposable.NeverNothing[];
}
declare interface LegacyDisposable {
  dispose (): void;
}
declare interface ExtendedDisposable extends Disposable {
  readonly isNoopOnDispose: boolean;
}

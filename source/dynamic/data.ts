import type { Async } from './async/async';
import { ArraySource, AssociativeRecordSource, BooleanSource, FixedRecordSource, MapSource, SetSource, type NumberSource, type StringSource, type ValueSource } from './sources';

// export function isLiteralData<T> (data: StringData): data is LiteralData<string>;
// export function isLiteralData<T> (data: NumberData): data is LiteralData<number>;
// export function isLiteralData<T> (data: BooleanData): data is LiteralData<boolean>;
// export function isLiteralData<T> (data: ValueData<T>): data is LiteralData<T>;
// export function isLiteralData<T> (data: ArrayData<T>): data is LiteralData<T[]>;
// export function isLiteralData<T> (value: any) {
//   return value?.[LiteralData.Tag] === true;
// }
// export interface LiteralData<T> {
//   readonly [LiteralData.Tag]: true;
//   readonly value: T;
// }
// export namespace LiteralData {
//   export const Tag = Symbol('LiteralData<T>');
// }

export type ValueData<T> =
  | ValueData.Immediate<T>
  | Async<ValueData.Immediate<T>>;
export namespace ValueData {
  export type Immediate<T> =
    // | LiteralData<T>
    | ValueSource<T>
    | Exclude<T, ValueSource>;
}
export type StringData =
  | StringData.Immediate
  | Async<StringData.Immediate>;
export namespace StringData {
  export type Immediate =
    // | LiteralData<string>
    | StringSource
    | string;
}
export type NumberData =
  | NumberData.Immediate
  | Async<NumberData.Immediate>;
export namespace NumberData {
  export type Immediate =
    // | LiteralData<number>
    | NumberSource
    | number;
}
export type BooleanData =
  | BooleanData.Immediate
  | Async<BooleanData.Immediate>;
export namespace BooleanData {
  export type Immediate =
    // | LiteralData<boolean>
    | BooleanSource
    | boolean;
}
/**
 * Primitives excluding symbols and bigints.
 */
export type BasicPrimitiveData = StringData | NumberData | BooleanData;
export namespace BasicPrimitiveData {
  export type Immediate =
    | StringData.Immediate
    | NumberData.Immediate
    | BooleanData.Immediate
  ;
  export type Dynamic = ValueSource<Literal>;
  export type Literal = string | number | boolean;
}

export type ArrayData<T> =
  | ArrayData.Immediate<T>
  | Async<ArrayData.Immediate<T>>;
export namespace ArrayData {
  export type Immediate<T> =
    // | LiteralData<readonly T[]>
    | ArraySource<T>
    | readonly T[];
}
export type MapData<K, V> =
  | MapData.Immediate<K, V>
  | Async<MapData.Immediate<K, V>>;
export namespace MapData {
  export type Immediate<K, V> =
    // | LiteralData<ReadonlyMap<K, V>>
    | MapSource<K, V>
    | Map<K, V>;
}
export type SetData<T> =
  | SetData.Immediate<T>
  | Async<SetData.Immediate<T>>;
export namespace SetData {
  export type Immediate<T> =
    // | LiteralData<ReadonlySet<T>>
    | SetSource<T>
    | Set<T>;
}
export type FixedRecordData<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
  | FixedRecordData.Immediate<TRecord, TEventPerField>
  | Async<FixedRecordData.Immediate<TRecord, TEventPerField>>;
export namespace FixedRecordData {
  export type Immediate<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
    // | LiteralData<TRecord>
    | FixedRecordSource<TRecord, TEventPerField>
    | TRecord;
}
export type AssociativeRecordData<T> =
  | AssociativeRecordData.Immediate<T>
  | Async<AssociativeRecordData.Immediate<T>>;
export namespace AssociativeRecordData {
  export type Immediate<T> =
    // | LiteralData<Record<string, T>>
    | AssociativeRecordSource<T>
    | Record<string, T>;
}

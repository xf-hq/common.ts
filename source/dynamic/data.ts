import type { Async } from './async/async';
import { ArraySource, AssociativeRecordSource, BooleanSource, FixedRecordSource, MapSource, SetSource, type NumberSource, type StringSource, type ValueSource } from './sources';

export function isLiteralData<T> (data: StringData): data is LiteralData<string>;
export function isLiteralData<T> (data: NumberData): data is LiteralData<number>;
export function isLiteralData<T> (data: BooleanData): data is LiteralData<boolean>;
export function isLiteralData<T> (data: ValueData<T>): data is LiteralData<T>;
export function isLiteralData<T> (data: ArrayData<T>): data is LiteralData<T[]>;
export function isLiteralData<T> (value: any) {
  return value?.[LiteralData.Tag] === true;
}
export interface LiteralData<T> {
  readonly [LiteralData.Tag]: true;
  readonly value: T;
}
export namespace LiteralData {
  export const Tag = Symbol('LiteralData<T>');
}

export type ValueData<T> =
  | ValueData.NotAsync<T>
  | Async<ValueData.NotAsync<T>>;
export namespace ValueData {
  export type NotAsync<T> =
    | LiteralData<T>
    | ValueSource<T>;
}
export type StringData =
  | StringData.NotAsync
  | Async<StringData.NotAsync>;
export namespace StringData {
  export type NotAsync =
    | LiteralData<string>
    | StringSource;
}
export type NumberData =
  | NumberData.NotAsync
  | Async<NumberData.NotAsync>;
export namespace NumberData {
  export type NotAsync =
    | LiteralData<number>
    | NumberSource;
}
export type BooleanData =
  | BooleanData.NotAsync
  | Async<BooleanData.NotAsync>;
export namespace BooleanData {
  export type NotAsync =
    | LiteralData<boolean>
    | BooleanSource;
}
export type ArrayData<T> =
  | ArrayData.NotAsync<T>
  | Async<ArrayData.NotAsync<T>>;
export namespace ArrayData {
  export type NotAsync<T> =
    | LiteralData<readonly T[]>
    | ArraySource<T>;
}
export type MapData<K, V> =
  | MapData.NotAsync<K, V>
  | Async<MapData.NotAsync<K, V>>;
export namespace MapData {
  export type NotAsync<K, V> =
    | LiteralData<ReadonlyMap<K, V>>
    | MapSource<K, V>;
}
export type SetData<T> =
  | SetData.NotAsync<T>
  | Async<SetData.NotAsync<T>>;
export namespace SetData {
  export type NotAsync<T> =
    | LiteralData<ReadonlySet<T>>
    | SetSource<T>;
}
export type FixedRecordData<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
  | FixedRecordData.NotAsync<TRecord, TEventPerField>
  | Async<FixedRecordData.NotAsync<TRecord, TEventPerField>>;
export namespace FixedRecordData {
  export type NotAsync<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
    | LiteralData<TRecord>
    | FixedRecordSource<TRecord, TEventPerField>;
}
export type AssociativeRecordData<T> =
  | AssociativeRecordData.NotAsync<T>
  | Async<AssociativeRecordData.NotAsync<T>>;
export namespace AssociativeRecordData {
  export type NotAsync<T> =
    | LiteralData<Record<string, T>>
    | AssociativeRecordSource<T>;
}

import type { Async } from './async/async';
import { ArraySource, AssociativeRecordSource, BooleanSource, FixedRecordSource, isArraySource, isAssociativeRecordSource, isFixedRecordSource, isMapSource, isSetSource, isValueSource, MapSource, SetSource, ValueSource, type NumberSource, type StringSource } from './sources';

export type ValueData<T> =
  | ValueData.Immediate<T>
  | Async<ValueData.Immediate<T>>;
export namespace ValueData {
  export type Immediate<T> =
    | ValueSource.Immediate<T>
    | Exclude<T, ValueSource.Immediate<T>>;
  export function snapshot<T> (source: Immediate<T>): T {
    return isValueSource(source) ? source.value : source;
  }
}
export type StringData =
  | StringData.Immediate
  | Async<StringData.Immediate>;
export namespace StringData {
  export type Immediate =
    | StringSource.Immediate
    | string;
  export const snapshot: <T extends string>(source: ValueData<T>) => T = ValueData.snapshot;
}
export type NumberData =
  | NumberData.Immediate
  | Async<NumberData.Immediate>;
export namespace NumberData {
  export type Immediate =
    | NumberSource.Immediate
    | number;
  export const snapshot = ValueData.snapshot<number>;
}
export type BooleanData =
  | BooleanData.Immediate
  | Async<BooleanData.Immediate>;
export namespace BooleanData {
  export type Immediate =
    | BooleanSource.Immediate
    | boolean;
  export const snapshot = ValueData.snapshot<boolean>;
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
    | ArraySource.Immediate<T>
    | readonly T[];
  export function snapshot<T> (source: Immediate<T>): readonly T[] {
    return isArraySource(source) ? source.__array : source;
  }
}
export type MapData<K, V> =
  | MapData.Immediate<K, V>
  | Async<MapData.Immediate<K, V>>;
export namespace MapData {
  export type Immediate<K, V> =
    | MapSource.Immediate<K, V>
    | Map<K, V>;
  export function snapshot<K, V> (source: Immediate<K, V>): ReadonlyMap<K, V> {
    return isMapSource(source) ? source.__map : source;
  }
}
export type SetData<T> =
  | SetData.Immediate<T>
  | Async<SetData.Immediate<T>>;
export namespace SetData {
  export type Immediate<T> =
    | SetSource.Immediate<T>
    | Set<T>;
  export function snapshot<T> (source: Immediate<T>): ReadonlySet<T> {
    return isSetSource(source) ? source.__set : source;
  }
}
export type FixedRecordData<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
  | FixedRecordData.Immediate<TRecord, TEventPerField>
  | Async<FixedRecordData.Immediate<TRecord, TEventPerField>>;
export namespace FixedRecordData {
  export type Immediate<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
    | FixedRecordSource.Immediate<TRecord, TEventPerField>
    | TRecord;
  export function snapshot<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> (source: Immediate<TRecord, TEventPerField>): Readonly<TRecord> {
    return isFixedRecordSource(source) ? source.__record : source;
  }
}
export type AssociativeRecordData<T> =
  | AssociativeRecordData.Immediate<T>
  | Async<AssociativeRecordData.Immediate<T>>;
export namespace AssociativeRecordData {
  export type Immediate<T> =
    | AssociativeRecordSource.Immediate<T>
    | Record<string, T>;
  export function snapshot<T> (source: Immediate<T>): Record<string, T> {
    return isAssociativeRecordSource(source) ? source.__record : source;
  }
}

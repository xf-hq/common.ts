import { Async, isAsync } from '../../async/async';
import { isOnDemandAsync, OnDemandAsync } from '../../async/on-demand-async';
import { FixedRecordSource, isFixedRecordSource } from '../../sources';
import type { ValueData } from '../values';

export type FixedRecordData<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
  | FixedRecordData.ExplicitAsync<TRecord, TEventPerField>
  | FixedRecordData.NotAsync<TRecord, TEventPerField>;
export namespace FixedRecordData {
  export type ExplicitAsync<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
    | Async<NotAsync<TRecord, TEventPerField>>
    | OnDemandAsync<NotAsync<TRecord, TEventPerField>>;
  export type NotAsync<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
    | FixedRecordSource<TRecord, TEventPerField>
    | TRecord;
  export type Immediate<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown> = MapRecord<TRecord, unknown>> =
    | FixedRecordSource.Immediate<TRecord, TEventPerField>
    | TRecord;
  export function snapshot<TRecord extends AnyRecord, TEventPerField extends MapRecord<TRecord, unknown>> (source: Immediate<TRecord, TEventPerField>): Readonly<TRecord> {
    return isFixedRecordSource(source) ? source.__record : source;
  }

  export type RecordOf<TData extends FixedRecordData<any, any>> = TData extends FixedRecordData<infer TRecord, any> ? TRecord : never;
  export type Keys<TData extends FixedRecordData<any, any>> = keyof RecordOf<TData>;
  export type ValueOf<TData extends FixedRecordData<any, any>, TKey extends Keys<TData>> = RecordOf<TData>[TKey] extends ValueData<infer V> ? V : never;

  export function getValue<TRecord extends { [P in K]: ValueData<V> }, K extends keyof TRecord, V> (key: K, source: FixedRecordData<TRecord>): V;
  export function getValue (key: any, source: FixedRecordData<any>) {
    if (isFixedRecordSource(source)) return FixedRecordSource.getAndUnboxValueDataField(key, source);
    if (isAsync(source)) return Async.map((_source: any) => getValue(key, _source), source);
    if (isOnDemandAsync(source)) return source.map((_source: any) => getValue(key, _source));
    return source[key];
  }
}

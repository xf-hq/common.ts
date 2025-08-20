import type { Async } from '../../async/async';
import type { OnDemandAsync } from '../../async/on-demand-async';
import { AssociativeRecordSource, isAssociativeRecordSource } from '../../sources';
import type { AsyncData } from '../variant-types';

// export type MapData<K, V> = MapData.ExplicitAsync<K, V> | MapData.NotAsync<K, V>;
// export namespace MapData {
//   export type ExplicitAsync<K, V> = Async<NotAsync<K, V>> | OnDemandAsync<NotAsync<K, V>>;
//   export type NotAsync<K, V> = MapSource<K, V> | Map<K, V>;
//   export type Immediate<K, V> =
//     | MapSource.Immediate<K, V>
//     | Map<K, V>;
//   export function snapshot<K, V> (source: Immediate<K, V>): ReadonlyMap<K, V> {
//     return isMapSource(source) ? source.__map : source;
//   }
// }

export type AssociativeRecordData<T> = AssociativeRecordData.ExplicitAsync<T> | AssociativeRecordData.NotAsync<T>;
export namespace AssociativeRecordData {
  export type ExplicitAsync<T> = Async<NotAsync<T>> | OnDemandAsync<NotAsync<T>>;
  export type NotAsync<T> = AssociativeRecordSource<T> | Record<string, T>;
  export type Immediate<T> =
    | AssociativeRecordSource.Immediate<T>
    | Record<string, T>;
  export function snapshot<T> (source: Immediate<T>): Record<string, T> {
    return isAssociativeRecordSource(source) ? source.__record : source;
  }
}

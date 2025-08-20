import type { Async } from '../../async/async';
import type { OnDemandAsync } from '../../async/on-demand-async';
import { isMapSource, MapSource } from '../../sources';

export type MapData<K, V> = MapData.ExplicitAsync<K, V> | MapData.NotAsync<K, V>;
export namespace MapData {
  export type ExplicitAsync<K, V> = Async<NotAsync<K, V>> | OnDemandAsync<NotAsync<K, V>>;
  export type NotAsync<K, V> = MapSource<K, V> | Map<K, V>;
  export type Immediate<K, V> =
    | MapSource.Immediate<K, V>
    | Map<K, V>;
  export function snapshot<K, V> (source: Immediate<K, V>): ReadonlyMap<K, V> {
    return isMapSource(source) ? source.__map : source;
  }
}

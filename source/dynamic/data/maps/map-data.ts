import { isMapSource, MapSource } from '../../sources';
import type { AsyncData } from '../variant-types';

export type MapData<K, V> =
  | MapData.Immediate<K, V>
  | AsyncData<MapData.Immediate<K, V>>;
export namespace MapData {
  export type IsAsync<K, V> = Exclude<MapData<K, V>, AsyncData>;
  export type NotAsync<K, V> = Exclude<MapData<K, V>, AsyncData>;
  export type Immediate<K, V> =
    | MapSource.Immediate<K, V>
    | Map<K, V>;
  export function snapshot<K, V> (source: Immediate<K, V>): ReadonlyMap<K, V> {
    return isMapSource(source) ? source.__map : source;
  }
}

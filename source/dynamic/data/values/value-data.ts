import { isValueSource, ValueSource } from '../../sources';
import type { AsyncData } from '../variant-types';

export type ValueData<T> =
  | ValueData.Immediate<T>
  | AsyncData<ValueData.Immediate<T>>;
export namespace ValueData {
  export type IsAsync<T> = Exclude<T, AsyncData>;
  export type NotAsync<T> = Exclude<T, AsyncData>;
  export type Immediate<T> =
    | ValueSource.Immediate<T>
    | Exclude<T, ValueSource.Immediate<T>>;
  export function snapshot<T> (source: Immediate<T>): T {
    return isValueSource(source) ? source.value : source;
  }
}

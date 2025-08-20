import { ArraySource, isArraySource } from '../../sources';
import type { AsyncData } from '../variant-types';

export type ArrayData<T> =
  | ArrayData.Immediate<T>
  | AsyncData<ArrayData.Immediate<T>>;
export namespace ArrayData {
  export type IsAsync<T> = Exclude<ArrayData<T>, AsyncData>;
  export type NotAsync<T> = Exclude<ArrayData<T>, AsyncData>;
  export type Immediate<T> =
    | ArraySource.Immediate<T>
    | readonly T[];
  export function snapshot<T> (source: Immediate<T>): readonly T[] {
    return isArraySource(source) ? source.__array : source;
  }
}

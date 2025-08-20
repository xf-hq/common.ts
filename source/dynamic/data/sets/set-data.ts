import { isSetSource, SetSource } from '../../sources';
import type { AsyncData } from '../variant-types';

export type SetData<T> =
  | SetData.Immediate<T>
  | AsyncData<SetData.Immediate<T>>;
export namespace SetData {
  export type IsAsync<T> = Exclude<SetData<T>, AsyncData>;
  export type NotAsync<T> = Exclude<SetData<T>, AsyncData>;
  export type Immediate<T> =
    | SetSource.Immediate<T>
    | Set<T>;
  export function snapshot<T> (source: Immediate<T>): ReadonlySet<T> {
    return isSetSource(source) ? source.__set : source;
  }
}

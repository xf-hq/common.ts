import { Async } from '../../async/async';
import { OnDemandAsync } from '../../async/on-demand-async';
import { ArraySource, isArraySource } from '../../sources';

export type ArrayData<T> = ArrayData.ExplicitAsync<T> | ArrayData.NotAsync<T>;
export namespace ArrayData {
  export type ExplicitAsync<T> = Async<NotAsync<T>> | OnDemandAsync<NotAsync<T>>;
  export type NotAsync<T> = ArraySource<T> | readonly T[];
  export type Immediate<T> =
    | ArraySource.Immediate<T>
    | readonly T[];
  export function snapshot<T> (source: Immediate<T>): readonly T[] {
    return isArraySource(source) ? source.__array : source;
  }
}

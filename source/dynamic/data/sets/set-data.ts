import { Async } from '../../async/async';
import { OnDemandAsync } from '../../async/on-demand-async';
import { isSetSource, SetSource } from '../../sources';

export type SetData<T> = SetData.ExplicitAsync<T> | SetData.NotAsync<T>;
export namespace SetData {
  export type ExplicitAsync<T> = Async<NotAsync<T>> | OnDemandAsync<NotAsync<T>>;
  export type NotAsync<T> = SetSource<T> | Set<T>;
  export type Immediate<T> =
    | SetSource.Immediate<T>
    | Set<T>;
  export function snapshot<T> (source: Immediate<T>): ReadonlySet<T> {
    return isSetSource(source) ? source.__set : source;
  }
}

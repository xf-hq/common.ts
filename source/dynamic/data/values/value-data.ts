import { Async } from '../../async/async';
import { OnDemandAsync } from '../../async/on-demand-async';
import { isValueSource, ValueSource } from '../../sources';

export type ValueData<T> = ValueData.ExplicitAsync<T> | ValueData.NotAsync<T>;
export namespace ValueData {
  export type ExplicitAsync<T> = Async<NotAsync<T>> | OnDemandAsync<NotAsync<T>>;
  export type NotAsync<T> = ValueSource<T> | Exclude<T, ValueSource<T>>;
  export type Immediate<T> =
    | ValueSource.Immediate<T>
    | Exclude<T, ValueSource.Immediate<T>>;
  export function snapshot<T> (source: Immediate<T>): T {
    return isValueSource(source) ? source.value : source;
  }
}

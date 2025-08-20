import { Async } from '../../async/async';
import { OnDemandAsync } from '../../async/on-demand-async';
import { type NumberSource } from '../../sources';
import { ValueData } from './value-data';

export type NumberData = NumberData.ExplicitAsync | NumberData.NotAsync;
export namespace NumberData {
  export type ExplicitAsync = Async<NumberData.NotAsync> | OnDemandAsync<NumberData.NotAsync>;
  export type NotAsync = NumberSource | number;
  export type Immediate =
    | NumberSource.Immediate
    | number;
  export const snapshot: <T extends number>(source: ValueData.Immediate<T>) => T = ValueData.snapshot;
}

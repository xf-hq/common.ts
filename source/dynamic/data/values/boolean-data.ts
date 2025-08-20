import { Async } from '../../async/async';
import { OnDemandAsync } from '../../async/on-demand-async';
import { BooleanSource } from '../../sources';
import { ValueData } from './value-data';

export type BooleanData = BooleanData.ExplicitAsync | BooleanData.NotAsync;
export namespace BooleanData {
  export type ExplicitAsync = Async<BooleanData.NotAsync> | OnDemandAsync<BooleanData.NotAsync>;
  export type NotAsync = BooleanSource | boolean;
  export type Immediate =
    | BooleanSource.Immediate
    | boolean;
  export const snapshot: <T extends boolean>(source: ValueData.Immediate<T>) => T = ValueData.snapshot;
}

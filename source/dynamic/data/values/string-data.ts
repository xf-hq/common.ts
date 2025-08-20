import { Async } from '../../async/async';
import { OnDemandAsync } from '../../async/on-demand-async';
import { type StringSource } from '../../sources';
import { ValueData } from './value-data';

export type StringData = StringData.ExplicitAsync | StringData.NotAsync;
export namespace StringData {
  export type ExplicitAsync = Async<StringData.NotAsync> | OnDemandAsync<StringData.NotAsync>;
  export type NotAsync = StringSource | string;
  export type Immediate =
    | StringSource.Immediate
    | string;
  export const snapshot: <T extends string>(source: ValueData.Immediate<T>) => T = ValueData.snapshot;
}

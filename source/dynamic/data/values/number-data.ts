import { type NumberSource } from '../../sources';
import { type AsyncData } from '../variant-types';
import { ValueData } from './value-data';

export type NumberData =
  | NumberData.Immediate
  | AsyncData<NumberData.Immediate>;
export namespace NumberData {
  export type IsAsync = Exclude<NumberData, AsyncData>;
  export type NotAsync = Exclude<NumberData, AsyncData>;
  export type Immediate =
    | NumberSource.Immediate
    | number;
  export const snapshot: <T extends number>(source: ValueData<T>) => T = ValueData.snapshot;
}

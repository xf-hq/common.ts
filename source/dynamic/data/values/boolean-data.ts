import { BooleanSource } from '../../sources';
import type { AsyncData } from '../variant-types';
import { ValueData } from './value-data';

export type BooleanData =
  | BooleanData.Immediate
  | AsyncData<BooleanData.Immediate>;
export namespace BooleanData {
  export type IsAsync = Exclude<BooleanData, AsyncData>;
  export type NotAsync = BooleanSource | boolean;
  export type Immediate =
    | BooleanSource.Immediate
    | boolean;
  export const snapshot: <T extends boolean>(source: ValueData<T>) => T = ValueData.snapshot;
}

import { type StringSource } from '../../sources';
import type { AsyncData } from '../variant-types';
import { ValueData } from './value-data';

export type StringData =
  | StringData.Immediate
  | AsyncData<StringData.Immediate>;
export namespace StringData {
  export type IsAsync = Exclude<StringData, AsyncData>;
  export type NotAsync = Exclude<StringData, AsyncData>;
  export type Immediate =
    | StringSource.Immediate
    | string;
  export const snapshot: <T extends string>(source: ValueData<T>) => T = ValueData.snapshot;
}

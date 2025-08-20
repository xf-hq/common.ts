import { AssociativeRecordSource, isAssociativeRecordSource } from '../../sources';
import type { AsyncData } from '../variant-types';

export type AssociativeRecordData<T> =
  | AssociativeRecordData.Immediate<T>
  | AsyncData<AssociativeRecordData.Immediate<T>>;
export namespace AssociativeRecordData {
  export type IsAsync<T> = Exclude<AssociativeRecordData<T>, AsyncData>;
  export type NotAsync<T> = Exclude<AssociativeRecordData<T>, AsyncData>;
  export type Immediate<T> =
    | AssociativeRecordSource.Immediate<T>
    | Record<string, T>;
  export function snapshot<T> (source: Immediate<T>): Record<string, T> {
    return isAssociativeRecordSource(source) ? source.__record : source;
  }
}

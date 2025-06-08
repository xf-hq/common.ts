export * from './array/array-source';
export * from './associative-record/associative-record-source';
export * from './fixed-record/fixed-record-source';
export * from './map-source/map-source';
export * from './set-source/set-source';
export * from './value-source/boolean-source';
export * from './value-source/number-source';
export * from './value-source/string-source';
export * from './value-source/value-source';

import { ArraySource } from './array/array-source';
import { AssociativeRecordSource } from './associative-record/associative-record-source';
import { FixedRecordSource } from './fixed-record/fixed-record-source';
import { MapSource } from './map-source/map-source';
import { SetSource } from './set-source/set-source';
import { BooleanSource } from './value-source/boolean-source';
import { NumberSource } from './value-source/number-source';
import { StringSource } from './value-source/string-source';
import { ValueSource } from './value-source/value-source';

export type Source =
  | ArraySource<any>
  | AssociativeRecordSource<any>
  | FixedRecordSource<any>
  | MapSource<any, any>
  | SetSource<any>
  | BooleanSource
  | NumberSource
  | StringSource
  | ValueSource
;

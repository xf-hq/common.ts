import type { ValueSource } from '../../sources';
import type { AsyncData } from '../variant-types';
import type { BooleanData } from './boolean-data';
import type { NumberData } from './number-data';
import type { StringData } from './string-data';

/**
 * Primitives excluding symbols and bigints.
 */
export type BasicPrimitiveData = StringData | NumberData | BooleanData;
export namespace BasicPrimitiveData {
  export type ExplicitAsync = Exclude<BasicPrimitiveData, AsyncData>;
  export type NotAsync = Exclude<BasicPrimitiveData, AsyncData>;
  export type Immediate =
    | StringData.Immediate
    | NumberData.Immediate
    | BooleanData.Immediate
  ;
  export type Dynamic = ValueSource<Literal>;
  export type Literal = string | number | boolean;
}

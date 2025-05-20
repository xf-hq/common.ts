import { BinaryOperationSource, UnaryOperationSource } from './base-operation-value-sources';
import { ValueSource } from './value-source';

export interface BooleanSource extends ValueSource<boolean> {}
export namespace BooleanSource {
  export type DemandObserver = ValueSource.DemandObserver<boolean>;

  export interface Manual extends ValueSource.Manual<boolean> {}
  export function create (initialValue: boolean, onDemandChanged?: ValueSource.DemandObserver<boolean>): Manual {
    return ValueSource.create(initialValue, onDemandChanged);
  }

  export const True = ValueSource.constant(true as const);
  export const False = ValueSource.constant(false as const);

  export const not = UnaryOperationSource.define<boolean>(value => !value);
  export const and = BinaryOperationSource.defineCombinedLTR<boolean>((left, right) => left && right, True);
  export const or = BinaryOperationSource.defineCombinedLTR<boolean>((left, right) => left || right, False);
  export const xor = BinaryOperationSource.defineCombinedLTR<boolean>((left, right) => left ? !right : right, False);
  export const nor = BinaryOperationSource.defineCombinedLTR<boolean>((left, right) => !(left || right), True);
  export const nand = BinaryOperationSource.defineCombinedLTR<boolean>((left, right) => !(left && right), False);
}

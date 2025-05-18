import { BinaryOperationSource, UnaryOperationSource } from './base-operation-value-sources';
import { ValueSource } from './value-source';

export interface NumberSource extends ValueSource<number> {}
export namespace NumberSource {
  export type DemandObserver = ValueSource.DemandObserver<number>;

  export function constant (value: number): ValueSource<number> {
    switch (value) {
      case 0: return Zero;
      case 1: return One;
      case 2: return Two;
      default: return ValueSource.constant(value);
    }
  }
  export interface Manual extends ValueSource.Manual<number> {}
  export function create (initialValue: number, onDemandChanged?: ValueSource.DemandObserver<number>): Manual {
    return ValueSource.create(initialValue, onDemandChanged);
  }

  export const Zero = ValueSource.constant(0);
  export const One = ValueSource.constant(1);
  export const Two = ValueSource.constant(2);

  export const negate = UnaryOperationSource.define<number>(value => -value);
  export const add = BinaryOperationSource.defineCombinedLTR<number>((left, right) => left + right);
  export const subtract = BinaryOperationSource.defineCombinedLTR<number>((left, right) => left - right);
  export const multiply = BinaryOperationSource.defineCombinedLTR<number>((left, right) => left * right);
  export const divide = BinaryOperationSource.defineCombinedLTR<number>((left, right) => left / right);
  export const modulo = BinaryOperationSource.defineCombinedLTR<number>((left, right) => left % right);
}

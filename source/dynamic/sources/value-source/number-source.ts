import { ComputedValueSourceA1 } from './computed-value-source-a1';
import { ComputedValueSourceA2 } from './computed-value-source-a2';
import { ValueSource } from './value-source';

export interface NumberSource extends ValueSource<number> {}
export namespace NumberSource {
  export interface Receiver<A extends any[] = []> extends ValueSource.Receiver<number, A> {}
  export interface Subscription extends ValueSource.Subscription<number> {}
  export type DemandObserver = ValueSource.Manual.DemandObserver<number>;
  export interface Immediate extends ValueSource.Immediate<number> {}

  export function constant (value: number): ValueSource<number> {
    switch (value) {
      case 0: return Zero;
      case 1: return One;
      case 2: return Two;
      default: return ValueSource.constant(value);
    }
  }
  export interface Manual extends ValueSource.Manual<number> {}
  export function create (initialValue: number, onDemandChanged?: ValueSource.Manual.DemandObserver<number>): Manual {
    return ValueSource.create(initialValue, onDemandChanged);
  }
  export function onDemand (onDemandChanged: ValueSource.DemandObserver<number>): NumberSource {
    return ValueSource.onDemand(onDemandChanged);
  }

  export const Zero = ValueSource.constant(0);
  export const One = ValueSource.constant(1);
  export const Two = ValueSource.constant(2);

  export const negate = ComputedValueSourceA1.define<number>(value => -value);
  export const add = ComputedValueSourceA2.defineCombinedLTR<number>((left, right) => left + right);
  export const subtract = ComputedValueSourceA2.defineCombinedLTR<number>((left, right) => left - right);
  export const multiply = ComputedValueSourceA2.defineCombinedLTR<number>((left, right) => left * right);
  export const divide = ComputedValueSourceA2.defineCombinedLTR<number>((left, right) => left / right);
  export const modulo = ComputedValueSourceA2.defineCombinedLTR<number>((left, right) => left % right);
}

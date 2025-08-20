import { ComputedValueSourceA1 } from './computed-value-source-a1';
import { ComputedValueSourceA2 } from './computed-value-source-a2';
import { ValueSource } from './value-source';

export interface BooleanSource extends ValueSource<boolean> {}
export namespace BooleanSource {
  export interface Receiver<A extends any[] = []> extends ValueSource.Receiver<boolean, A> {}
  export interface Subscription extends ValueSource.Subscription<boolean> {}
  export type DemandObserver = ValueSource.DemandObserver<boolean>;
  export interface Immediate extends ValueSource.Immediate<boolean> {}

  export interface Manual extends ValueSource.Manual<boolean> {}
  export function create (initialValue: boolean, onDemandChanged?: ValueSource.DemandObserver<boolean>): Manual {
    return ValueSource.create(initialValue, onDemandChanged);
  }

  export const True = ValueSource.constant(true as const);
  export const False = ValueSource.constant(false as const);

  export const not = ComputedValueSourceA1.define<boolean>(value => !value);
  export const and = ComputedValueSourceA2.defineCombinedLTR<boolean>((left, right) => left && right, True);
  export const or = ComputedValueSourceA2.defineCombinedLTR<boolean>((left, right) => left || right, False);
  export const xor = ComputedValueSourceA2.defineCombinedLTR<boolean>((left, right) => left ? !right : right, False);
  export const nor = ComputedValueSourceA2.defineCombinedLTR<boolean>((left, right) => !(left || right), True);
  export const nand = ComputedValueSourceA2.defineCombinedLTR<boolean>((left, right) => !(left && right), False);
}

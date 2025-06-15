import { isFunction } from '../../../general/type-checking';
import type { ValueSource } from './value-source';

export const ValueSourceTag: unique symbol = Symbol('ValueSource');

export function normalizeValueSourceReceiverArg<T, A extends any[]> (
  receiverArg: ValueSource.Receiver<T, A> | ValueSource.Receiver<T, A>['event']
): ValueSource.Receiver<T, A> {
  return isFunction(receiverArg) ? { event: receiverArg } : receiverArg;
}

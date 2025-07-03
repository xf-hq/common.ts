import { dispose } from '../../../general/disposables';
import type { Subscribable } from '../../core';
import type { ArraySource } from './array-source';

export const ArraySourceTag: unique symbol = Symbol('ArraySource');

export function createArraySourceSubscription<T, A extends any[]> (
  source: { readonly __array: readonly T[] | undefined },
  emitter: Subscribable<[event: ArraySource.Event<T>]>,
  subscriber: ArraySource.Subscriber<T, A>,
  args: A
): ArraySource.Subscription<T> {
  const receiver: ArraySource.Receiver<T, A> = typeof subscriber === 'function' ? { event: subscriber } : subscriber;
  const disposable = emitter.subscribe(receiver, ...args);
  const subscription = new ArraySourceSubscription<T>(source, disposable);
  receiver.init?.(subscription, ...args);
  return subscription;
}

export class ArraySourceSubscription<T> implements ArraySource.Subscription<T> {
  constructor (
    private readonly source: { readonly __array: readonly T[] | undefined },
    private readonly subscription: Disposable
  ) {}

  get __array () {
    if (this.#disposed) {
      throw new Error(`Cannot access array after the view has been disposed`);
    }
    return this.source.__array!;
  }

  #disposed = false;
  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    dispose(this.subscription);
  }
}

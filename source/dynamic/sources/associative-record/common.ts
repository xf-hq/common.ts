import { dispose } from '../../../general/disposables';
import type { Subscribable } from '../../core';
import type { AssociativeRecordSource } from './associative-record-source';

export function createAssociativeRecordSourceSubscription<V, A extends any[]> (
  source: { readonly __record: Readonly<Record<string, V>> },
  emitter: Subscribable<[event: AssociativeRecordSource.Event<V>]>,
  subscriber: AssociativeRecordSource.Subscriber<V, A>,
  args: A
): AssociativeRecordSource.Subscription<V> {
  const receiver = typeof subscriber === 'function' ? { event: subscriber } : subscriber;
  const disposable = emitter.subscribe(subscriber, ...args);
  const subscription = new AssociativeRecordSourceSubscription<V>(source, disposable);
  receiver.init?.(subscription);
  return subscription;
}

export const AssociativeRecordSourceTag: unique symbol = Symbol('AssociativeRecordSource');
export class AssociativeRecordSourceSubscription<V> implements AssociativeRecordSource.Subscription<V> {
  constructor (
    private readonly source: { readonly __record: Readonly<Record<string, V>> },
    private readonly subscription: Disposable
  ) {}

  get __record () {
    if (this.#disposed) {
      throw new Error(`Cannot access record after the view has been disposed`);
    }
    return this.source.__record;
  }

  #disposed = false;
  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    dispose(this.subscription);
  }
}

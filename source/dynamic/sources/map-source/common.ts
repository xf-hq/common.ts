import { dispose } from '../../../general/disposables';
import type { Subscribable } from '../../core';
import type { MapSource } from './map-source';

export function createMapSourceSubscription<K, V, A extends any[]> (
  source: { readonly __map: ReadonlyMap<K, V> | undefined },
  emitter: Subscribable<[event: MapSource.Event<K, V>]>,
  subscriber: MapSource.Subscriber<K, V, A>,
  args: A
): MapSource.Subscription<K, V> {
  const receiver: MapSource.Receiver<K, V, A> = typeof subscriber === 'function' ? { event: subscriber } : subscriber;
  const disposable = emitter.subscribe(receiver, ...args);
  const subscription = new MapSourceSubscription<K, V>(source, disposable);
  receiver.init?.(subscription, ...args);
  return subscription;
}

export const MapSourceTag: unique symbol = Symbol('MapSource');
export class MapSourceSubscription<K, V> implements MapSource.Subscription<K, V> {
  constructor (
    private readonly source: { readonly __map: ReadonlyMap<K, V> | undefined },
    private readonly subscription: Disposable
  ) {}

  get __map () {
    if (this.#disposed) {
      throw new Error(`Cannot access map after the view has been disposed`);
    }
    return this.source.__map!;
  }

  #disposed = false;
  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    dispose(this.subscription);
  }
}

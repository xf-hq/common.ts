import { dispose } from '../../../general/disposables';
import type { MapSource } from './map-source';

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

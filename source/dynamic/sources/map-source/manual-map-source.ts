import { Subscribable } from '../../core/subscribable';
import { MapSourceSubscription, MapSourceTag } from './common';
import { MapSource } from './map-source';

export class ManualMapSource<K, V> implements MapSource.Immediate<K, V>, MapSource.Manual<K, V> {
  constructor (initialMap: Map<K, V>, onDemandChanged?: MapSource.Manual.DemandObserver<K, V>) {
    this.#map = initialMap;
    this.#emitter = onDemandChanged
      ? new Subscribable.Controller<[event: MapSource.Event<K, V>]>(new ManualMapSource.DemandObserverAdapter(this, onDemandChanged))
      : new Subscribable.Controller<[event: MapSource.Event<K, V>]>();
  }
  readonly #emitter: Subscribable.Controller<[event: MapSource.Event<K, V>]>;
  readonly #map: Map<K, V>;

  get [MapSourceTag] () { return true as const; }

  get __emitter () { return this.#emitter; }
  get __map () { return this.#map; }
  get size () { return this.#map.size; }

  subscribe<A extends any[]> (onChange: Subscribable.Subscriber<[event: MapSource.Event<K, V>], A>, ...args: A): MapSource.Subscription<K, V> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new MapSourceSubscription(this, subscription);
  }

  set (key: K, value: V): boolean {
    const previousSize = this.#map.size;
    this.#map.set(key, value);
    if (this.#map.size === previousSize) return false;
    this.#emitter.signal({ kind: 'set', key, value });
    return true;
  }
  delete (key: K): boolean {
    const value = this.#map.get(key)!;
    if (!this.#map.delete(key)) return false;
    this.#emitter.signal({ kind: 'delete', key, value });
    return true;
  }
  clear (): void {
    const previousSize = this.#map.size;
    if (previousSize === 0) return;
    this.#map.clear();
    this.#emitter.signal({ kind: 'clear', previousSize });
  }

  get (key: K): V | undefined { return this.#map.get(key); }
  has (key: K): boolean { return this.#map.has(key); }
  keys (): Iterable<K> { return this.#map.keys(); }
  values (): Iterable<V> { return this.#map.values(); }
  entries (): Iterable<[K, V]> { return this.#map.entries(); }

  __incrementDemand (): void { this.#emitter.__incrementDemand(); }
  __decrementDemand (): void { this.#emitter.__decrementDemand(); }

  static DemandObserverAdapter = class DemandObserverAdapter<K, V> implements Subscribable.DemandObserver.ListenerInterface<[event: MapSource.Event<K, V>]> {
    constructor (
      private readonly source: ManualMapSource<K, V>,
      private readonly onDemandChanged: MapSource.Manual.DemandObserver<K, V>
    ) {}
    online (): void { this.onDemandChanged.online?.(this.source); }
    offline (): void { this.onDemandChanged.offline?.(this.source); }
    subscribe (receiver: MapSource.Receiver<K, V, any[]>): void { this.onDemandChanged.subscribe?.(this.source, receiver); }
    unsubscribe (receiver: MapSource.Receiver<K, V, any[]>): void { this.onDemandChanged.unsubscribe?.(this.source, receiver); }
  };
}

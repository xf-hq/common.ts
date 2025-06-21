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

  hold (): void {
    this.#emitter.hold();
  }
  release (): void {
    this.#emitter.release();
  }

  set (key: K, value: V): boolean {
    const wasExisting = this.#map.has(key);
    this.#map.set(key, value);

    if (wasExisting) {
      this.#emitter.event({ add: null, change: new Map([[key, value]]), delete: null });
    }
    else {
      this.#emitter.event({ add: new Map([[key, value]]), change: null, delete: null });
    }
    return true;
  }
  delete (key: K): boolean {
    if (!this.#map.delete(key)) return false;
    this.#emitter.event({ add: null, change: null, delete: [key] });
    return true;
  }
  clear (): void {
    if (this.#map.size === 0) return;
    const allKeys = Array.from(this.#map.keys());
    this.modify(null, allKeys);
  }
  modify (assignments: ReadonlyMap<K, V> | null, deletions: ReadonlyArray<K> | null): void {
    let additions: Map<K, V> | null = null;
    let modifications: Map<K, V> | null = null;

    // Categorize changes into additions vs modifications
    if (assignments) {
      for (const [key, value] of assignments) {
        if (this.#map.has(key)) {
          (modifications ??= new Map()).set(key, value);
        }
        else if (this.#map.get(key) !== value) {
          (additions ??= new Map()).set(key, value);
        }
        else {
          continue;
        }
        this.#map.set(key, value);
      }
    }

    // Handle deletions if provided
    let deletionKeys: K[] | null = null;
    if (deletions) {
      for (const key of deletions) {
        if (this.#map.has(key)) {
          this.#map.delete(key);
          (deletionKeys ??= []).push(key);
        }
      }
    }

    if (additions || modifications || deletionKeys) {
      this.#emitter.event({
        add: additions,
        change: modifications,
        delete: deletionKeys,
      });
    }
  }

  has (key: K): boolean { return this.#map.has(key); }
  get (key: K): V | undefined { return this.#map.get(key); }
  getOrThrow (key: K): V {
    if (!this.#map.has(key)) {
      throw new Error(`The specified key does not exist in the map`);
    }
    return this.#map.get(key)!;
  }
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

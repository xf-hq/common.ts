import { dispose } from '../../../general/disposables';
import { throwError } from '../../../general/errors';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import { type InternalMapSource, MapSourceSubscription, MapSourceTag } from './common';
import { MapSource } from './map-source';

export class FilteredMapSource<K, V> implements InternalMapSource<K, V>, Subscribable.Receiver<[event: MapSource.Event<K, V>]> {
  constructor (f: (value: V, key: K) => boolean, source: MapSource<K, V>) {
    this.#f = f;
    this.#source = source;
  }
  readonly #f: (value: V, key: K) => boolean;
  readonly #source: MapSource<K, V>;
  readonly #emitter = new Subscribable.Controller<[event: MapSource.Event<K, V>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: MapSource.Subscription<K, V> | undefined;
  #filteredMap: Map<K, V> | undefined;

    get [MapSourceTag] () { return true as const; }

  /** @internal */
  get __map () { return this.#filteredMap ??= throwError('Internal map not initialized.'); }

  subscribe<A extends any[]> (onChange: Subscribable.Subscriber<[event: MapSource.Event<K, V>], A>, ...args: A): MapSource.Subscription<K, V> {
    const subscription = this.#emitter.subscribe(onChange, ...args);
    return new MapSourceSubscription(this, subscription);
  }

  onDemandChange (event: Subscribable.DemandObserver.Event): void {
    switch (event) {
      case 'online': this.online(); break;
      case 'offline': this.offline(); break;
    }
  }

  online () {
    this.#upstreamSubscription = this.#source.subscribe(this);
    this.#filteredMap = new Map(
      Array.from(this.#upstreamSubscription.__map.entries())
        .filter(([k, v]) => this.testValue(v, k))
    );
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#filteredMap = undefined;
  }

  signal (event: MapSource.Event<K, V>): void {
    const map = this.#filteredMap!;
    switch (event.kind) {
      case 'set': {
        const passes = this.testValue(event.value, event.key);
        if (passes) {
          map.set(event.key, event.value);
          this.#emitter.signal(event);
        }
        else if (map.has(event.key)) {
          const value = map.get(event.key)!;
          map.delete(event.key);
          this.#emitter.signal({ kind: 'delete', key: event.key, value });
        }
        break;
      }
      case 'delete': {
        if (map.has(event.key)) {
          map.delete(event.key);
          this.#emitter.signal(event);
        }
        break;
      }
      case 'clear': {
        const previousSize = map.size;
        if (previousSize > 0) {
          map.clear();
          this.#emitter.signal({ kind: 'clear', previousSize });
        }
        break;
      }
    }
  }

  testValue (value: V, key: K): boolean {
    return this.#f(value, key);
  }
}

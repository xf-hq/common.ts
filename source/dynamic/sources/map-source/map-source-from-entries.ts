import { dispose } from '../../../general/disposables';
import { bindMethod } from '../../../general/functional';
import { Subscribable } from '../../core/subscribable';
import type { ArraySource } from '../array/array-source';
import { MapSourceSubscription, MapSourceTag } from './common';
import { MapSource } from './map-source';

export class MapSourceFromEntries<K, V> implements MapSource<K, V>, Subscribable.Receiver<[event: ArraySource.Event<readonly [K, V]>]> {
  constructor (source: ArraySource<readonly [K, V]>) {
    this.#source = source;
  }
  readonly #source: ArraySource<readonly [K, V]>;
  readonly #emitter = new Subscribable.Controller<[event: MapSource.Event<K, V>]>(bindMethod(this.onDemandChange, this));
  #upstreamSubscription: ArraySource.Subscription<readonly [K, V]> | undefined;
  #map: Map<K, V> | undefined;

  get [MapSourceTag] () { return true as const; }

  get __map () { return this.#map; }

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
    this.#map = new Map(this.#upstreamSubscription.__array);
  }

  offline () {
    dispose(this.#upstreamSubscription!);
    this.#upstreamSubscription = undefined;
    this.#map = undefined;
  }

  signal (event: ArraySource.Event<readonly [K, V]>): void {
    const map = this.#map!;
    switch (event.kind) {
      case 'push': {
        for (const [key, value] of event.values) {
          map.set(key, value);
          this.#emitter.signal({ kind: 'set', key, value });
        }
        break;
      }
      case 'splice': {
        const { index, deletions, insertions } = event;
        for (let i = 0; i < deletions; i++) {
          const [key, value] = this.#upstreamSubscription!.__array[index + i];
          map.delete(key);
          this.#emitter.signal({ kind: 'delete', key, value });
        }
        for (const [key, value] of insertions) {
          map.set(key, value);
          this.#emitter.signal({ kind: 'set', key, value });
        }
        break;
      }
      case 'set': {
        const { index, value: [key, value] } = event;
        map.set(key, value);
        this.#emitter.signal({ kind: 'set', key, value });
        break;
      }
      case 'pop': {
        const [key, value] = this.#upstreamSubscription!.__array[this.#upstreamSubscription!.__array.length - 1];
        map.delete(key);
        this.#emitter.signal({ kind: 'delete', key, value });
        break;
      }
      case 'shift': {
        const [key, value] = this.#upstreamSubscription!.__array[0];
        map.delete(key);
        this.#emitter.signal({ kind: 'delete', key, value });
        break;
      }
      case 'unshift': {
        for (const [key, value] of event.values) {
          map.set(key, value);
          this.#emitter.signal({ kind: 'set', key, value });
        }
        break;
      }
      case 'batch': {
        for (const batchEvent of event.events) {
          this.signal(batchEvent);
        }
        break;
      }
    }
  }
}
